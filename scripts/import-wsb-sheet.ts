/**
 * WSB専用 移行スクリプト
 *
 * `~/Desktop/sales.csv` (WSB_収益・支出簡易管理表 を CSV エクスポートしたもの)
 * を Firestore に投入する。
 *
 * 実行:
 *   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json \
 *   FIREBASE_PROJECT_ID=wsb-admin-app \
 *   npx tsx scripts/import-wsb-sheet.ts ~/Desktop/sales.csv
 *
 * スプレッドシートのレイアウト (4テーブル横並び):
 *   列C-H: ライブ/制作 (No, 日付/場所, 収入/支出, 詳細, 金額, 備考)
 *   列K-O: 会場物販     (No, 日付, 物品, 個数, 金額)
 *   列Q-X: 通販         (No, 日付, 物品, 個数, 金額, 発送, 宛先, 対応者)
 *   列Z-AA: 在庫        (品名, 残数)
 *
 * 方針:
 *  - 経費(支出)行はスキップ (ユーザー指示)
 *  - "グッズ" は会場物販の集計値なので二重計上を避けるため取り込まない
 *  - "ライブ収益" など物販以外の収入のみライブチャネルとして取り込む
 *  - 会場物販・通販は明細をそのまま取り込み
 *  - 在庫スナップショット → 既存variantのstockに上書き
 */

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";
import { parse } from "csv-parse/sync";

const projectId = process.env.FIREBASE_PROJECT_ID;
const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const csvPath = process.argv[2];

if (!projectId || !credPath || !csvPath) {
  console.error(
    "Usage: GOOGLE_APPLICATION_CREDENTIALS=... FIREBASE_PROJECT_ID=... npx tsx scripts/import-wsb-sheet.ts <csv-path>",
  );
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(credPath, "utf-8"));
if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount), projectId });
}
const db = getFirestore();

const DEFAULT_YEAR = 2025;

// スプレッドシート上の商品名 → DB上の (productName, size, color)
const ITEM_MAP: Record<
  string,
  { productName: string; size: string; color: string }
> = {
  タオル: {
    productName: "ORIGINAL LOGO TOWEL",
    size: "-",
    color: "-",
  },
  ピンズ: {
    productName: "ORIGINAL PINS",
    size: "-",
    color: "-",
  },
  ライター: {
    productName: "Lighter",
    size: "-",
    color: "-",
  },
  ステッカー: {
    productName: "Random Sticker (3枚入り)",
    size: "-",
    color: "-",
  },
  "1st mini album CD": {
    productName: "1ST MINI ALBUM「the flotsam」CD",
    size: "-",
    color: "-",
  },
  Tシャツ_WT_L: {
    productName: "ORIGINAL LOGO TEE",
    size: "L",
    color: "White",
  },
  Tシャツ_WT_XL: {
    productName: "ORIGINAL LOGO TEE",
    size: "XL",
    color: "White",
  },
  Tシャツ_BK_L: {
    productName: "ORIGINAL LOGO TEE",
    size: "L",
    color: "Black",
  },
  Tシャツ_BK_XL: {
    productName: "ORIGINAL LOGO TEE",
    size: "XL",
    color: "Black",
  },
};

// "1,234" "¥1,234" "-1000" などをintにする
function parseAmount(raw: unknown): number {
  if (raw === undefined || raw === null) return 0;
  const t = String(raw).replace(/[¥,\s]/g, "");
  if (t === "" || t === "-") return 0;
  const n = Number(t);
  if (Number.isNaN(n)) return 0;
  return n;
}

// "2025/05/15\n新宿アンチノック" or "5/15" → "YYYY-MM-DD"
function parseDate(raw: string | undefined, fallback?: string): string | null {
  if (!raw) return fallback ?? null;
  const firstLine = raw.split(/\r?\n/)[0]?.trim() ?? "";
  if (!firstLine) return fallback ?? null;
  // 完全 yyyy/mm/dd
  let m = firstLine.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (m) {
    return `${m[1]}-${m[2]!.padStart(2, "0")}-${m[3]!.padStart(2, "0")}`;
  }
  // 短縮 mm/dd or m/d
  m = firstLine.match(/^(\d{1,2})\/(\d{1,2})/);
  if (m) {
    return `${DEFAULT_YEAR}-${m[1]!.padStart(2, "0")}-${m[2]!.padStart(2, "0")}`;
  }
  return fallback ?? null;
}

// "2025/05/15\n新宿アンチノック" → "新宿アンチノック"
function parseVenueName(raw: string | undefined): string | null {
  if (!raw) return null;
  const lines = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  if (lines.length < 2) return null;
  return lines.slice(1).join(" ");
}

interface SaleRow {
  occurredOn: string;
  channel: "venue" | "online" | "live" | "music" | "ad";
  productId?: string | null;
  variantId?: string | null;
  quantity: number;
  amount: number;
  memo?: string | null;
}

async function main() {
  const text = readFileSync(csvPath, "utf-8");
  const rows: string[][] = parse(text, {
    skip_empty_lines: false,
    trim: false,
    relax_column_count: true,
  });

  // 商品マスタ事前ロード
  const productsSnap = await db.collection("products").get();
  if (productsSnap.empty) {
    console.error(
      "No products in Firestore. Run `npx tsx scripts/seed-products.ts` first.",
    );
    process.exit(1);
  }
  const productsByName = new Map<string, { id: string }>();
  const variantsByKey = new Map<string, string>(); // `${productName}|${size}|${color}` → variantId
  const variantIdToRef = new Map<
    string,
    FirebaseFirestore.DocumentReference
  >();
  for (const ps of productsSnap.docs) {
    const data = ps.data();
    productsByName.set(data.name, { id: ps.id });
    const variantsSnap = await ps.ref.collection("variants").get();
    for (const vs of variantsSnap.docs) {
      const v = vs.data();
      const key = `${data.name}|${v.size ?? "-"}|${v.color ?? "-"}`;
      variantsByKey.set(key, vs.id);
      variantIdToRef.set(vs.id, vs.ref);
    }
  }

  function lookupVariant(itemRaw: string): {
    productId: string;
    variantId: string;
  } | null {
    const key = itemRaw.trim();
    const map = ITEM_MAP[key];
    if (!map) return null;
    const product = productsByName.get(map.productName);
    if (!product) return null;
    const variantId = variantsByKey.get(
      `${map.productName}|${map.size}|${map.color}`,
    );
    if (!variantId) return null;
    return { productId: product.id, variantId };
  }

  const sales: SaleRow[] = [];
  const unmatchedItems: string[] = [];
  const skipped: string[] = [];

  // ヘッダ行を見つける (row 9 / index 8 が想定)
  // ベース列: ライブ(C=2), 会場(K=10), 通販(Q=16), 在庫(Z=25)
  // 念のため "No." を探す
  let dataStartRow = -1;
  for (let i = 0; i < Math.min(20, rows.length); i++) {
    const r = rows[i] ?? [];
    if (
      (r[2]?.trim() === "No." || r[10]?.trim() === "No.") &&
      (r[16]?.trim() === "No." || r[25]?.trim() === "品名")
    ) {
      dataStartRow = i + 1;
      break;
    }
  }
  if (dataStartRow < 0) {
    console.error("ヘッダ行が見つかりませんでした");
    process.exit(1);
  }
  console.log(`detected header at row ${dataStartRow}`);

  // ライブ収入の日付継承 (空欄なら前の値を使う)
  let lastLiveDate: string | null = null;
  let lastLiveVenue: string | null = null;

  // 在庫スナップショット
  const stockUpdates: { itemRaw: string; stock: number }[] = [];

  for (let i = dataStartRow; i < rows.length; i++) {
    const r = rows[i] ?? [];

    // -------- ライブ/制作 (C=2 .. H=7) --------
    const liveNo = r[2]?.trim();
    const liveDateRaw = r[3];
    const liveKind = r[4]?.trim();
    const liveDetail = r[5]?.trim() ?? "";
    const liveAmountRaw = r[6];

    if (liveNo && liveKind && liveKind !== "未入力") {
      const date: string | null = parseDate(
        liveDateRaw,
        lastLiveDate ?? undefined,
      );
      const venue: string | null = parseVenueName(liveDateRaw) ?? lastLiveVenue;
      if (liveDateRaw && parseDate(liveDateRaw)) {
        lastLiveDate = date;
        lastLiveVenue = venue;
      }

      const amount = parseAmount(liveAmountRaw);
      if (liveKind === "収入" && amount > 0 && liveDetail !== "グッズ") {
        // "ライブ収益" 等の物販以外の収入のみ live チャネルとして取り込む
        sales.push({
          occurredOn: date ?? `${DEFAULT_YEAR}-01-01`,
          channel: "live",
          quantity: 1,
          amount,
          memo: [venue, liveDetail].filter(Boolean).join(" / ") || null,
        });
      } else if (liveKind === "支出") {
        skipped.push(`live #${liveNo} 支出 ${liveDetail} (経費は対象外)`);
      } else if (liveKind === "収入" && liveDetail === "グッズ") {
        skipped.push(
          `live #${liveNo} グッズ集計 ¥${amount} (会場物販明細と重複するためスキップ)`,
        );
      }
    }

    // -------- 会場物販 (K=10 .. O=14) --------
    const venueNo = r[10]?.trim();
    const venueDateRaw = r[11]?.trim();
    const venueItem = r[12]?.trim();
    const venueQtyRaw = r[13]?.trim();
    const venueAmountRaw = r[14]?.trim();
    if (venueNo && venueItem) {
      const date = parseDate(venueDateRaw);
      const qty = Number(venueQtyRaw || "1") || 1;
      const amount = parseAmount(venueAmountRaw);
      const v = lookupVariant(venueItem);
      if (!v) {
        unmatchedItems.push(`venue: ${venueItem}`);
      } else {
        sales.push({
          occurredOn: date ?? `${DEFAULT_YEAR}-01-01`,
          channel: "venue",
          productId: v.productId,
          variantId: v.variantId,
          quantity: qty,
          amount,
          memo: null,
        });
      }
    }

    // -------- 通販 (Q=16 .. X=23) --------
    const onlineNo = r[16]?.trim();
    const onlineDateRaw = r[17]?.trim();
    const onlineItem = r[18]?.trim();
    const onlineQtyRaw = r[19]?.trim();
    const onlineAmountRaw = r[20]?.trim();
    const onlineShipping = r[21]?.trim();
    const onlineRecipient = r[22]?.trim();
    const onlineHandler = r[23]?.trim();
    if (onlineNo && onlineItem) {
      const date = parseDate(onlineDateRaw);
      const qty = Number(onlineQtyRaw || "1") || 1;
      const amount = parseAmount(onlineAmountRaw);
      const v = lookupVariant(onlineItem);
      const memoParts: string[] = [];
      if (onlineRecipient) memoParts.push(`宛先: ${onlineRecipient}`);
      if (onlineHandler) memoParts.push(`担当: ${onlineHandler}`);
      if (onlineShipping) memoParts.push(`発送: ${onlineShipping}`);
      if (!v) {
        unmatchedItems.push(`online: ${onlineItem}`);
      } else {
        sales.push({
          occurredOn: date ?? `${DEFAULT_YEAR}-01-01`,
          channel: "online",
          productId: v.productId,
          variantId: v.variantId,
          quantity: qty,
          amount,
          memo: memoParts.length ? memoParts.join(" / ") : null,
        });
      }
    }

    // -------- 在庫 (Z=25, AA=26) --------
    const stockName = r[25]?.trim();
    const stockQtyRaw = r[26]?.trim();
    if (stockName && stockQtyRaw) {
      const stock = Number(stockQtyRaw);
      if (!Number.isNaN(stock)) {
        stockUpdates.push({ itemRaw: stockName, stock });
      }
    }
  }

  console.log("---- summary ----");
  console.log(`sales rows to insert: ${sales.length}`);
  console.log(`stock snapshots: ${stockUpdates.length}`);
  if (unmatchedItems.length) {
    console.log(`unmatched items (skipped): ${unmatchedItems.length}`);
    for (const u of new Set(unmatchedItems)) console.log("  - " + u);
  }
  if (skipped.length) {
    console.log("skipped:");
    for (const s of skipped) console.log("  - " + s);
  }

  // 売上を投入 (Firestore trigger が無いため、stock 減算は in-memory で計算してから一括上書きする)
  // ただし「在庫スナップショット」が真の最新値なので、stock は最後にスナップショットで上書き
  let createdSales = 0;
  for (const s of sales) {
    await db.collection("sales").add({
      occurredOn: s.occurredOn,
      channel: s.channel,
      productId: s.productId ?? null,
      variantId: s.variantId ?? null,
      quantity: s.quantity,
      amount: s.amount,
      memo: s.memo ?? null,
      createdBy: null,
      createdAt: Timestamp.now(),
    });
    createdSales++;
  }
  console.log(`inserted ${createdSales} sales rows`);

  // 在庫スナップショットを適用
  let updatedStock = 0;
  const unmatchedStock: string[] = [];
  for (const s of stockUpdates) {
    const v = lookupVariant(s.itemRaw);
    if (!v) {
      unmatchedStock.push(s.itemRaw);
      continue;
    }
    const ref = db
      .collection("products")
      .doc(v.productId)
      .collection("variants")
      .doc(v.variantId);
    await ref.update({ stock: s.stock });
    updatedStock++;
  }
  console.log(`updated stock for ${updatedStock} variants`);
  if (unmatchedStock.length) {
    console.log("unmatched stock items:");
    for (const u of unmatchedStock) console.log("  - " + u);
  }

  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
