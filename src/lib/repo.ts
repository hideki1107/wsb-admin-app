// Firestore CRUD ヘルパー
//
// コレクション構造:
//   products/{productId}
//   products/{productId}/variants/{variantId}
//   sales/{saleId}
//   stockMovements/{movementId}
//
// 売上時の在庫減算と入荷時の在庫加算はクライアント側 transaction で行う
// (本来は Cloud Functions が安全だが、MVP では認証済みユーザーのみアクセス可とする)

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
  updateDoc,
  runTransaction,
  serverTimestamp,
  Timestamp,
  type DocumentData,
  type DocumentReference,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "./firebase";
import type {
  Expense,
  ExpenseCategory,
  Product,
  ProductVariant,
  ProductWithVariants,
  Sale,
  SaleItem,
  SalesChannel,
  StockMovement,
} from "./types";

const toMillis = (v: unknown): number => {
  if (v instanceof Timestamp) return v.toMillis();
  if (typeof v === "number") return v;
  return Date.now();
};

const productFromDoc = (snap: QueryDocumentSnapshot<DocumentData>): Product => {
  const d = snap.data();
  return {
    id: snap.id,
    name: d.name,
    category: d.category,
    basePrice: d.basePrice,
    isActive: d.isActive ?? true,
    iconEmoji: d.iconEmoji ?? null,
    colorKey: d.colorKey ?? null,
    memo: d.memo ?? null,
    createdAt: toMillis(d.createdAt),
  };
};

const variantFromDoc = (
  snap: QueryDocumentSnapshot<DocumentData>,
  productId: string,
): ProductVariant => {
  const d = snap.data();
  return {
    id: snap.id,
    productId,
    size: d.size ?? "-",
    color: d.color ?? "-",
    stock: d.stock ?? 0,
    skuCode: d.skuCode ?? null,
    createdAt: toMillis(d.createdAt),
  };
};

const saleFromDoc = (snap: QueryDocumentSnapshot<DocumentData>): Sale => {
  const d = snap.data();
  return {
    id: snap.id,
    occurredOn: d.occurredOn,
    channel: d.channel,
    productId: d.productId ?? null,
    variantId: d.variantId ?? null,
    quantity: d.quantity ?? 1,
    items: Array.isArray(d.items) ? (d.items as SaleItem[]) : null,
    amount: d.amount ?? 0,
    memo: d.memo ?? null,
    createdBy: d.createdBy ?? null,
    createdAt: toMillis(d.createdAt),
  };
};

const expenseFromDoc = (
  snap: QueryDocumentSnapshot<DocumentData>,
): Expense => {
  const d = snap.data();
  return {
    id: snap.id,
    occurredOn: d.occurredOn,
    category: d.category,
    amount: d.amount ?? 0,
    memo: d.memo ?? null,
    createdBy: d.createdBy ?? null,
    createdAt: toMillis(d.createdAt),
  };
};

const movementFromDoc = (
  snap: QueryDocumentSnapshot<DocumentData>,
): StockMovement => {
  const d = snap.data();
  return {
    id: snap.id,
    variantId: d.variantId,
    productId: d.productId,
    delta: d.delta,
    reason: d.reason,
    memo: d.memo ?? null,
    occurredOn: d.occurredOn,
    createdBy: d.createdBy ?? null,
    createdAt: toMillis(d.createdAt),
  };
};

// =========================================
// Products
// =========================================
export async function listProductsWithVariants(): Promise<ProductWithVariants[]> {
  const productsSnap = await getDocs(collection(db, "products"));
  const products = productsSnap.docs
    .map(productFromDoc)
    .sort((a, b) =>
      a.category === b.category
        ? a.name.localeCompare(b.name)
        : a.category.localeCompare(b.category),
    );

  const result: ProductWithVariants[] = [];
  for (const p of products) {
    const variantsSnap = await getDocs(
      collection(db, "products", p.id, "variants"),
    );
    const variants = variantsSnap.docs.map((v) => variantFromDoc(v, p.id));
    variants.sort((a, b) =>
      a.size === b.size ? a.color.localeCompare(b.color) : a.size.localeCompare(b.size),
    );
    result.push({ ...p, variants });
  }
  return result;
}

export async function getProduct(productId: string): Promise<Product | null> {
  const snap = await getDoc(doc(db, "products", productId));
  if (!snap.exists()) return null;
  return productFromDoc(snap as QueryDocumentSnapshot<DocumentData>);
}

export async function createProduct(
  input: Omit<Product, "id" | "createdAt"> & { id?: string },
): Promise<string> {
  const ref: DocumentReference = input.id
    ? doc(db, "products", input.id)
    : doc(collection(db, "products"));
  await setDoc(ref, {
    name: input.name,
    category: input.category,
    basePrice: input.basePrice,
    isActive: input.isActive,
    iconEmoji: input.iconEmoji ?? null,
    colorKey: input.colorKey ?? null,
    memo: input.memo ?? null,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function createVariant(
  productId: string,
  input: Omit<ProductVariant, "id" | "productId" | "createdAt"> & {
    id?: string;
  },
): Promise<string> {
  const ref: DocumentReference = input.id
    ? doc(db, "products", productId, "variants", input.id)
    : doc(collection(db, "products", productId, "variants"));
  await setDoc(ref, {
    size: input.size,
    color: input.color,
    stock: input.stock,
    skuCode: input.skuCode ?? null,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export interface NewProductInput {
  name: string;
  category: Product["category"];
  basePrice: number;
  iconEmoji?: string | null;
  colorKey?: Product["colorKey"];
  memo?: string | null;
  // バリエーション (size/color/初期在庫) を1個以上。シンプルな商品は1個でOK
  variants: Array<{
    size: string;
    color: string;
    initialStock: number;
  }>;
  occurredOn: string;  // 仕入日
  createdBy?: string | null;
}

// 新規商品 + variant + 初期在庫の movement を一括登録
export async function createProductWithInitialStock(
  input: NewProductInput,
): Promise<string> {
  // 1) 商品本体作成
  const productId = await createProduct({
    name: input.name,
    category: input.category,
    basePrice: input.basePrice,
    isActive: true,
    iconEmoji: input.iconEmoji ?? null,
    colorKey: input.colorKey ?? null,
    memo: input.memo ?? null,
  });

  // 2) 各 variant 作成 + 仕入を stock_movement に記録
  for (const v of input.variants) {
    const variantId = await createVariant(productId, {
      size: v.size,
      color: v.color,
      stock: v.initialStock,
      skuCode: null,
    });
    if (v.initialStock > 0) {
      await setDoc(doc(collection(db, "stockMovements")), {
        productId,
        variantId,
        delta: v.initialStock,
        reason: "restock",
        memo: input.memo ?? "新規商品登録",
        occurredOn: input.occurredOn,
        createdBy: input.createdBy ?? null,
        createdAt: serverTimestamp(),
      });
    }
  }
  return productId;
}

// 商品マスタを部分更新 (name, category, basePrice, iconEmoji, colorKey, memo)
export async function updateProduct(
  productId: string,
  patch: Partial<
    Pick<
      Product,
      "name" | "category" | "basePrice" | "iconEmoji" | "colorKey" | "memo"
    >
  >,
): Promise<void> {
  await updateDoc(doc(db, "products", productId), patch);
}

// バリエーション (SKU) の在庫数を直接書き換える
export async function updateVariantStock(
  productId: string,
  variantId: string,
  newStock: number,
): Promise<void> {
  await updateDoc(doc(db, "products", productId, "variants", variantId), {
    stock: newStock,
  });
}

// 商品を完全削除 (variants サブコレクション含む)
// 注: 過去の sales / stockMovements は残るが、商品IDの参照は無効になる
//     -> 一覧画面では商品名が "—" 表示になる (既存の挙動)
export async function deleteProductCascade(productId: string): Promise<void> {
  const variantsSnap = await getDocs(
    collection(db, "products", productId, "variants"),
  );
  await Promise.all(variantsSnap.docs.map((d) => deleteDoc(d.ref)));
  await deleteDoc(doc(db, "products", productId));
}

// =========================================
// Sales
// =========================================
export interface CreateSaleInput {
  occurredOn: string;
  channel: SalesChannel;
  productId?: string | null;
  variantId?: string | null;
  quantity: number;
  amount: number;
  memo?: string | null;
  createdBy?: string | null;
}

// 売上を登録し、物販の場合は在庫を減算する (transaction)
export async function recordSale(input: CreateSaleInput): Promise<string> {
  return await runTransaction(db, async (tx) => {
    // 在庫減算
    if (input.variantId && input.productId) {
      const variantRef = doc(
        db,
        "products",
        input.productId,
        "variants",
        input.variantId,
      );
      const variantSnap = await tx.get(variantRef);
      if (!variantSnap.exists()) {
        throw new Error("対象のバリエーションが見つかりません");
      }
      const currentStock: number = variantSnap.data().stock ?? 0;
      const next = currentStock - input.quantity;
      tx.update(variantRef, { stock: next });
    }

    const saleRef = doc(collection(db, "sales"));
    tx.set(saleRef, {
      occurredOn: input.occurredOn,
      channel: input.channel,
      productId: input.productId ?? null,
      variantId: input.variantId ?? null,
      quantity: input.quantity,
      amount: input.amount,
      memo: input.memo ?? null,
      createdBy: input.createdBy ?? null,
      createdAt: serverTimestamp(),
    });
    return saleRef.id;
  });
}

export async function listSales(opts?: {
  channel?: SalesChannel;
  limit?: number;
}): Promise<Sale[]> {
  // 複合インデックス不要にするため where のみサーバ側、ソートはクライアント側で実行
  // 主キー: occurredOn 降順、第2キー: createdAt 降順 (同日内は新しい登録順)
  const snap = opts?.channel
    ? await getDocs(
        query(collection(db, "sales"), where("channel", "==", opts.channel)),
      )
    : await getDocs(collection(db, "sales"));
  return snap.docs.map(saleFromDoc).sort((a, b) => {
    if (a.occurredOn !== b.occurredOn)
      return a.occurredOn < b.occurredOn ? 1 : -1;
    return b.createdAt - a.createdAt;
  });
}

// 通販で複数商品を含む 1 注文を登録する。
// sales コレクションに 1 ドキュメント (items[] 付き、amount = 合計金額)
// 在庫は items 各行の variant に対して transaction で減算
export interface CreateOnlineOrderInput {
  occurredOn: string;
  items: SaleItem[];
  amount: number;
  memo?: string | null;
  createdBy?: string | null;
}

export async function recordOnlineOrder(
  input: CreateOnlineOrderInput,
): Promise<string> {
  if (input.items.length === 0)
    throw new Error("商品が指定されていません");

  return await runTransaction(db, async (tx) => {
    // 同じ variant への減算を集約
    const stockDeltas = new Map<string, number>();
    const refByPath = new Map<string, DocumentReference>();
    for (const item of input.items) {
      const ref = doc(
        db,
        "products",
        item.productId,
        "variants",
        item.variantId,
      );
      refByPath.set(ref.path, ref);
      stockDeltas.set(
        ref.path,
        (stockDeltas.get(ref.path) ?? 0) + item.quantity,
      );
    }

    // 全 variant を読み込み
    const reads = await Promise.all(
      Array.from(refByPath.values()).map((ref) => tx.get(ref)),
    );
    const currentStocks = new Map<string, number>();
    for (const snap of reads) {
      if (!snap.exists())
        throw new Error("対象のバリエーションが見つかりません");
      currentStocks.set(snap.ref.path, snap.data().stock ?? 0);
    }

    // 在庫を一括更新
    for (const [path, delta] of stockDeltas.entries()) {
      const ref = refByPath.get(path)!;
      const cur = currentStocks.get(path) ?? 0;
      tx.update(ref, { stock: cur - delta });
    }

    // sales ドキュメント1件作成 (items[] 付き)
    const saleRef = doc(collection(db, "sales"));
    tx.set(saleRef, {
      occurredOn: input.occurredOn,
      channel: "online",
      productId: null,
      variantId: null,
      quantity: input.items.reduce((s, i) => s + i.quantity, 0),
      items: input.items,
      amount: input.amount,
      memo: input.memo ?? null,
      createdBy: input.createdBy ?? null,
      createdAt: serverTimestamp(),
    });
    return saleRef.id;
  });
}

// 物販系収入で複数商品を一括登録する。
// 全行の在庫減算 + sales 作成を 1 transaction で行う。
// 同じ variant が複数行に出てくる場合も合算して減算。
export interface MultiSaleItem {
  productId: string;
  variantId: string;
  quantity: number;
  amount: number;
}

export interface CreateMultipleSalesInput {
  occurredOn: string;
  channel: SalesChannel;
  items: MultiSaleItem[];
  memo?: string | null;
  createdBy?: string | null;
}

export async function recordMultipleSales(
  input: CreateMultipleSalesInput,
): Promise<string[]> {
  if (input.items.length === 0) throw new Error("商品が指定されていません");

  return await runTransaction(db, async (tx) => {
    // 1) 同じ variant への減算を集約
    const stockDeltas = new Map<string, number>(); // path -> 減算量
    const refByPath = new Map<string, DocumentReference>();
    for (const item of input.items) {
      const ref = doc(
        db,
        "products",
        item.productId,
        "variants",
        item.variantId,
      );
      refByPath.set(ref.path, ref);
      stockDeltas.set(
        ref.path,
        (stockDeltas.get(ref.path) ?? 0) + item.quantity,
      );
    }

    // 2) 全 variant を読み込み (transaction では read 先行が必須)
    const reads = await Promise.all(
      Array.from(refByPath.values()).map((ref) => tx.get(ref)),
    );
    const currentStocks = new Map<string, number>();
    for (const snap of reads) {
      if (!snap.exists()) {
        throw new Error("対象のバリエーションが見つかりません");
      }
      currentStocks.set(snap.ref.path, snap.data().stock ?? 0);
    }

    // 3) 在庫を一括更新
    for (const [path, delta] of stockDeltas.entries()) {
      const ref = refByPath.get(path)!;
      const cur = currentStocks.get(path) ?? 0;
      tx.update(ref, { stock: cur - delta });
    }

    // 4) sales 作成 (商品ごとに1ドキュメント)
    const saleIds: string[] = [];
    for (const item of input.items) {
      const saleRef = doc(collection(db, "sales"));
      tx.set(saleRef, {
        occurredOn: input.occurredOn,
        channel: input.channel,
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        amount: item.amount,
        memo: input.memo ?? null,
        createdBy: input.createdBy ?? null,
        createdAt: serverTimestamp(),
      });
      saleIds.push(saleRef.id);
    }

    return saleIds;
  });
}

// 売上を編集。物販の場合は旧/新の在庫差分を一括 transaction で再計算する
export interface UpdateSaleInput {
  occurredOn: string;
  channel: SalesChannel;
  productId?: string | null;
  variantId?: string | null;
  quantity: number;
  amount: number;
  memo?: string | null;
}

// 複数商品オーダー (items[]) の編集。items 自体は変更せず、
// 日付・合計金額・メモのみ更新する (在庫の再計算は不要)
export interface UpdateOnlineOrderInput {
  occurredOn: string;
  amount: number;
  memo?: string | null;
}

export async function updateOnlineOrder(
  saleId: string,
  next: UpdateOnlineOrderInput,
): Promise<void> {
  await updateDoc(doc(db, "sales", saleId), {
    occurredOn: next.occurredOn,
    amount: next.amount,
    memo: next.memo ?? null,
  });
}

export async function updateSale(
  oldSale: Sale,
  next: UpdateSaleInput,
): Promise<void> {
  await runTransaction(db, async (tx) => {
    const saleRef = doc(db, "sales", oldSale.id);

    // 旧 variant の在庫を巻き戻し、新 variant の在庫を減算
    const oldVariantRef =
      oldSale.variantId && oldSale.productId
        ? doc(
            db,
            "products",
            oldSale.productId,
            "variants",
            oldSale.variantId,
          )
        : null;
    const newVariantRef =
      next.variantId && next.productId
        ? doc(db, "products", next.productId, "variants", next.variantId)
        : null;

    if (
      oldVariantRef &&
      newVariantRef &&
      oldVariantRef.path === newVariantRef.path
    ) {
      // 同じ variant: net 差分のみ適用 (+oldQty -newQty)
      const snap = await tx.get(oldVariantRef);
      if (snap.exists()) {
        const cur: number = snap.data().stock ?? 0;
        tx.update(oldVariantRef, {
          stock: cur + oldSale.quantity - next.quantity,
        });
      }
    } else {
      if (oldVariantRef) {
        const snap = await tx.get(oldVariantRef);
        if (snap.exists()) {
          const cur: number = snap.data().stock ?? 0;
          tx.update(oldVariantRef, { stock: cur + oldSale.quantity });
        }
      }
      if (newVariantRef) {
        const snap = await tx.get(newVariantRef);
        if (snap.exists()) {
          const cur: number = snap.data().stock ?? 0;
          tx.update(newVariantRef, { stock: cur - next.quantity });
        }
      }
    }

    tx.update(saleRef, {
      occurredOn: next.occurredOn,
      channel: next.channel,
      productId: next.productId ?? null,
      variantId: next.variantId ?? null,
      quantity: next.quantity,
      amount: next.amount,
      memo: next.memo ?? null,
    });
  });
}

// 売上を削除。物販に紐づく場合は variant の在庫を復元する (transaction)
// items[] がある場合は各 variant にそれぞれ復元する
export async function deleteSale(sale: Sale): Promise<void> {
  await runTransaction(db, async (tx) => {
    const saleRef = doc(db, "sales", sale.id);

    // 復元対象を収集 (同じvariantは合算)
    const restoreDeltas = new Map<string, number>();
    const refByPath = new Map<string, DocumentReference>();

    if (sale.items && sale.items.length > 0) {
      for (const item of sale.items) {
        const ref = doc(
          db,
          "products",
          item.productId,
          "variants",
          item.variantId,
        );
        refByPath.set(ref.path, ref);
        restoreDeltas.set(
          ref.path,
          (restoreDeltas.get(ref.path) ?? 0) + item.quantity,
        );
      }
    } else if (sale.variantId && sale.productId) {
      const ref = doc(
        db,
        "products",
        sale.productId,
        "variants",
        sale.variantId,
      );
      refByPath.set(ref.path, ref);
      restoreDeltas.set(ref.path, sale.quantity);
    }

    // 読み込み (transactionでは reads first)
    const reads = await Promise.all(
      Array.from(refByPath.values()).map((ref) => tx.get(ref)),
    );
    const currentStocks = new Map<string, number>();
    for (const snap of reads) {
      if (snap.exists()) {
        currentStocks.set(snap.ref.path, snap.data().stock ?? 0);
      }
    }

    // 在庫復元
    for (const [path, delta] of restoreDeltas.entries()) {
      const ref = refByPath.get(path)!;
      const cur = currentStocks.get(path);
      if (cur !== undefined) {
        tx.update(ref, { stock: cur + delta });
      }
    }

    tx.delete(saleRef);
  });
}

// =========================================
// Expenses (支出)
// =========================================
export interface CreateExpenseInput {
  occurredOn: string;
  category: ExpenseCategory;
  amount: number;
  memo?: string | null;
  createdBy?: string | null;
}

export async function recordExpense(input: CreateExpenseInput): Promise<string> {
  const ref = doc(collection(db, "expenses"));
  await setDoc(ref, {
    occurredOn: input.occurredOn,
    category: input.category,
    amount: input.amount,
    memo: input.memo ?? null,
    createdBy: input.createdBy ?? null,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function listExpenses(opts?: {
  category?: ExpenseCategory;
}): Promise<Expense[]> {
  // 主キー: occurredOn 降順、第2キー: createdAt 降順
  const snap = opts?.category
    ? await getDocs(
        query(collection(db, "expenses"), where("category", "==", opts.category)),
      )
    : await getDocs(collection(db, "expenses"));
  return snap.docs.map(expenseFromDoc).sort((a, b) => {
    if (a.occurredOn !== b.occurredOn)
      return a.occurredOn < b.occurredOn ? 1 : -1;
    return b.createdAt - a.createdAt;
  });
}

export interface UpdateExpenseInput {
  occurredOn: string;
  category: ExpenseCategory;
  amount: number;
  memo?: string | null;
}

export async function updateExpense(
  expenseId: string,
  next: UpdateExpenseInput,
): Promise<void> {
  await updateDoc(doc(db, "expenses", expenseId), {
    occurredOn: next.occurredOn,
    category: next.category,
    amount: next.amount,
    memo: next.memo ?? null,
  });
}

export async function deleteExpense(expenseId: string): Promise<void> {
  await deleteDoc(doc(db, "expenses", expenseId));
}

export interface ExpenseCategorySummary {
  category: ExpenseCategory;
  txCount: number;
  amountTotal: number;
}

export function summarizeByCategory(
  expenses: Expense[],
): ExpenseCategorySummary[] {
  const map = new Map<ExpenseCategory, ExpenseCategorySummary>();
  for (const e of expenses) {
    const cur = map.get(e.category) ?? {
      category: e.category,
      txCount: 0,
      amountTotal: 0,
    };
    cur.txCount += 1;
    cur.amountTotal += e.amount;
    map.set(e.category, cur);
  }
  return Array.from(map.values());
}

export function totalExpense(expenses: Expense[]): number {
  return expenses.reduce((sum, e) => sum + e.amount, 0);
}

// =========================================
// Stock Movements (restock / adjust)
// =========================================
export interface CreateMovementInput {
  productId: string;
  variantId: string;
  delta: number;
  reason: "restock" | "adjust" | "other";
  memo?: string | null;
  occurredOn: string;
  createdBy?: string | null;
}

export async function recordStockMovement(
  input: CreateMovementInput,
): Promise<string> {
  return await runTransaction(db, async (tx) => {
    const variantRef = doc(
      db,
      "products",
      input.productId,
      "variants",
      input.variantId,
    );
    const variantSnap = await tx.get(variantRef);
    if (!variantSnap.exists()) {
      throw new Error("対象のバリエーションが見つかりません");
    }
    const currentStock: number = variantSnap.data().stock ?? 0;
    tx.update(variantRef, { stock: currentStock + input.delta });

    const movRef = doc(collection(db, "stockMovements"));
    tx.set(movRef, {
      productId: input.productId,
      variantId: input.variantId,
      delta: input.delta,
      reason: input.reason,
      memo: input.memo ?? null,
      occurredOn: input.occurredOn,
      createdBy: input.createdBy ?? null,
      createdAt: serverTimestamp(),
    });
    return movRef.id;
  });
}

export async function listMovements(): Promise<StockMovement[]> {
  const snap = await getDocs(collection(db, "stockMovements"));
  return snap.docs.map(movementFromDoc).sort((a, b) => {
    if (a.occurredOn !== b.occurredOn)
      return a.occurredOn < b.occurredOn ? 1 : -1;
    return b.createdAt - a.createdAt;
  });
}

// =========================================
// Aggregations (クライアント側集計 - MVP)
// =========================================
export interface ChannelSummary {
  channel: SalesChannel;
  txCount: number;
  qtyTotal: number;
  amountTotal: number;
}

export function summarizeByChannel(sales: Sale[]): ChannelSummary[] {
  const map = new Map<SalesChannel, ChannelSummary>();
  for (const s of sales) {
    const cur = map.get(s.channel) ?? {
      channel: s.channel,
      txCount: 0,
      qtyTotal: 0,
      amountTotal: 0,
    };
    cur.txCount += 1;
    cur.qtyTotal += s.quantity;
    cur.amountTotal += s.amount;
    map.set(s.channel, cur);
  }
  return Array.from(map.values());
}

export function totalRevenue(sales: Sale[]): number {
  return sales.reduce((sum, s) => sum + s.amount, 0);
}
