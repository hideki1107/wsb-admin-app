"use client";

import { useEffect, useState } from "react";
import {
  deleteProductCascade,
  listProductsWithVariants,
  recordStockMovement,
  updateProduct,
  updateVariantStock,
} from "@/lib/repo";
import {
  PRODUCT_CATEGORY_LABELS,
  PRODUCT_COLOR_KEYS,
  type ProductCategory,
  type ProductColorKey,
  type ProductWithVariants,
  type ProductVariant,
} from "@/lib/types";
import { yen, todayIso } from "@/lib/format";
import { auth } from "@/lib/firebase";
import { getProductTheme, PRODUCT_COLORS } from "@/lib/theme";

const EMOJI_PALETTE: string[] = [
  "🎵", "💿", "📀", "🎸", "🎤", "🥁", "🎹", "🎼",
  "👕", "👚", "🧢", "🎽", "🧦", "👜", "🎒", "🪖",
  "🎁", "✨", "⭐", "🔥", "🏷️", "🎀", "📿", "🪪",
  "📦", "📝", "🍀", "🌟", "🍻", "📚", "🖼️", "🎬",
];

const CATEGORIES: ProductCategory[] = ["music", "apparel", "accessory", "other"];

export default function InventoryPage() {
  const [products, setProducts] = useState<ProductWithVariants[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{
    product: ProductWithVariants;
    variant: ProductVariant;
  } | null>(null);
  const [editingProduct, setEditingProduct] =
    useState<ProductWithVariants | null>(null);
  const [deletingProduct, setDeletingProduct] =
    useState<ProductWithVariants | null>(null);

  async function refresh() {
    setProducts(await listProductsWithVariants());
  }

  useEffect(() => {
    (async () => {
      try {
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading)
    return <p className="text-center text-sm text-zinc-500">読み込み中…</p>;
  if (error)
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        {error}
      </div>
    );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900">
          在庫一覧
        </h1>
        <p className="mt-1 text-base text-zinc-500">
          商品ごとに残数と入荷・棚卸補正ができます
        </p>
      </div>

      {products.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center text-base text-zinc-500 shadow-md">
          商品が登録されていません
        </div>
      ) : (
        products.map((p) => {
          const ct = getProductTheme(p);
          const total = p.variants.reduce((s, v) => s + v.stock, 0);
          return (
            <section
              key={p.id}
              className="overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-zinc-100"
            >
              <header className="flex items-start gap-3 border-b border-zinc-100 px-4 py-4 sm:px-6">
                <div
                  className={
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-2xl shadow " +
                    ct.gradient
                  }
                >
                  {ct.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-base font-bold text-zinc-900 sm:text-lg">
                    {p.name}
                  </div>
                  <div className="text-sm text-zinc-500">
                    {PRODUCT_CATEGORY_LABELS[p.category]} ・ {yen(p.basePrice)}
                  </div>
                  {p.variants.length > 1 && (
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                        合計
                      </span>
                      <span
                        className={
                          "text-3xl sm:text-4xl font-black tabular-nums leading-none " +
                          (total === 0
                            ? "text-rose-600"
                            : total <= 5
                              ? "text-amber-600"
                              : "text-emerald-700")
                        }
                      >
                        {total}
                      </span>
                      <span className="text-sm text-zinc-500">個</span>
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEditingProduct(p)}
                    className="rounded-full bg-gradient-to-r from-sky-500 to-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:scale-105 active:scale-95 sm:text-sm sm:px-4"
                  >
                    編集
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingProduct(p)}
                    className="rounded-full bg-gradient-to-r from-rose-500 to-pink-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:scale-105 active:scale-95 sm:text-sm sm:px-4"
                  >
                    削除
                  </button>
                </div>
              </header>
              <ul className="divide-y divide-zinc-100">
                {p.variants.map((v) => {
                  const label =
                    v.color === "-" && v.size === "-"
                      ? "標準"
                      : [v.color, v.size]
                          .filter((x) => x !== "-")
                          .join(" / ");
                  return (
                    <li
                      key={v.id}
                      className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-6 sm:py-4"
                    >
                      <div className="min-w-0 flex-1 text-base font-medium text-zinc-700 sm:text-lg">
                        {label}
                      </div>
                      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                        <div
                          className={
                            "flex min-w-[4.5rem] flex-col items-center justify-center rounded-2xl px-3 py-2 shadow-md ring-1 " +
                            (v.stock === 0
                              ? "bg-gradient-to-br from-rose-500 to-pink-600 text-white ring-rose-200"
                              : v.stock <= 5
                                ? "bg-gradient-to-br from-amber-400 to-orange-500 text-white ring-amber-200"
                                : "bg-gradient-to-br from-emerald-400 to-teal-500 text-white ring-emerald-200")
                          }
                        >
                          <span className="text-3xl font-black leading-none tabular-nums sm:text-4xl">
                            {v.stock}
                          </span>
                          <span className="mt-0.5 text-[10px] font-bold tracking-widest opacity-90">
                            残個数
                          </span>
                        </div>
                        <button
                          onClick={() =>
                            setEditing({ product: p, variant: v })
                          }
                          className="rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50"
                        >
                          入荷/補正
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      )}

      {editing && (
        <MovementModal
          product={editing.product}
          variant={editing.variant}
          onClose={() => setEditing(null)}
          onDone={async () => {
            setEditing(null);
            await refresh();
          }}
        />
      )}

      {editingProduct && (
        <EditProductModal
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onDone={async () => {
            setEditingProduct(null);
            await refresh();
          }}
        />
      )}

      {deletingProduct && (
        <DeleteConfirmModal
          product={deletingProduct}
          onClose={() => setDeletingProduct(null)}
          onDone={async () => {
            setDeletingProduct(null);
            await refresh();
          }}
        />
      )}
    </div>
  );
}

function MovementModal({
  product,
  variant,
  onClose,
  onDone,
}: {
  product: ProductWithVariants;
  variant: ProductVariant;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState<"restock" | "adjust">("restock");
  const [delta, setDelta] = useState<number | "">("");
  const [memo, setMemo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (delta === "" || delta === 0) {
      setError("増減数を入力してください");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await recordStockMovement({
        productId: product.id,
        variantId: variant.id,
        delta: Number(delta),
        reason,
        memo: memo.trim() || null,
        occurredOn: todayIso(),
        createdBy: auth.currentUser?.uid ?? null,
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSubmitting(false);
    }
  }

  const label =
    variant.color === "-" && variant.size === "-"
      ? "標準"
      : [variant.color, variant.size].filter((x) => x !== "-").join(" / ");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-900/50 p-4 backdrop-blur-sm sm:items-center">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md space-y-4 rounded-3xl bg-white p-6 shadow-2xl"
      >
        <header>
          <div className="font-bold text-zinc-900">{product.name}</div>
          <div className="text-xs text-zinc-500">
            {label} ・ 現在の在庫 {variant.stock}
          </div>
        </header>

        <div>
          <div className="mb-1.5 text-xs font-bold uppercase tracking-wider text-zinc-500">
            理由
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setReason("restock")}
              className={
                "flex-1 rounded-xl px-3 py-2.5 text-sm font-medium transition " +
                (reason === "restock"
                  ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow"
                  : "bg-white text-zinc-700 ring-1 ring-zinc-200")
              }
            >
              📥 入荷
            </button>
            <button
              type="button"
              onClick={() => setReason("adjust")}
              className={
                "flex-1 rounded-xl px-3 py-2.5 text-sm font-medium transition " +
                (reason === "adjust"
                  ? "bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow"
                  : "bg-white text-zinc-700 ring-1 ring-zinc-200")
              }
            >
              📝 棚卸補正
            </button>
          </div>
        </div>

        <label className="block">
          <div className="mb-1.5 text-xs font-bold uppercase tracking-wider text-zinc-500">
            増減数 (入荷+20, 補正-3 など)
          </div>
          <input
            type="number"
            value={delta}
            onChange={(e) =>
              setDelta(e.target.value === "" ? "" : Number(e.target.value))
            }
            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-lg font-semibold outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            placeholder="20"
          />
        </label>

        <label className="block">
          <div className="mb-1.5 text-xs font-bold uppercase tracking-wider text-zinc-500">
            メモ (任意)
          </div>
          <input
            type="text"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
          />
        </label>

        {error && (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-3 text-sm font-semibold text-white shadow-lg disabled:opacity-50"
          >
            {submitting ? "登録中…" : "登録"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700"
          >
            キャンセル
          </button>
        </div>
      </form>
    </div>
  );
}

// =========================================
// 商品編集モーダル
// =========================================
function EditProductModal({
  product,
  onClose,
  onDone,
}: {
  product: ProductWithVariants;
  onClose: () => void;
  onDone: () => void;
}) {
  const initialTheme = getProductTheme(product);
  const [name, setName] = useState(product.name);
  const [category, setCategory] = useState<ProductCategory>(product.category);
  const [iconEmoji, setIconEmoji] = useState<string>(initialTheme.emoji);
  const [colorKey, setColorKey] = useState<ProductColorKey>(
    product.colorKey ??
      (product.category === "music"
        ? "emerald"
        : product.category === "apparel"
          ? "violet"
          : product.category === "accessory"
            ? "amber"
            : "slate"),
  );
  const [price, setPrice] = useState<number | "">(product.basePrice);
  // 各variantの仕入数 (現在の在庫を編集)
  const [variantStocks, setVariantStocks] = useState<Record<string, number>>(
    () =>
      Object.fromEntries(product.variants.map((v) => [v.id, v.stock])),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("商品名を入力してください");
      return;
    }
    if (price === "" || Number(price) < 0) {
      setError("値段は0以上で入力してください");
      return;
    }
    setSubmitting(true);
    try {
      await updateProduct(product.id, {
        name: name.trim(),
        category,
        basePrice: Number(price),
        iconEmoji,
        colorKey,
      });
      // 各variantの在庫を更新 (変更があったものだけ)
      for (const v of product.variants) {
        const next = variantStocks[v.id] ?? v.stock;
        if (next !== v.stock) {
          await updateVariantStock(product.id, v.id, next);
        }
      }
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-zinc-900/50 p-4 backdrop-blur-sm sm:items-center">
      <form
        onSubmit={onSubmit}
        className="my-4 w-full max-w-lg space-y-4 rounded-3xl bg-white p-5 shadow-2xl sm:p-6"
      >
        <header className="flex items-center gap-3">
          <div
            className={
              "flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br text-2xl shadow " +
              PRODUCT_COLORS[colorKey].gradient
            }
          >
            {iconEmoji}
          </div>
          <div>
            <div className="text-lg font-extrabold text-zinc-900">
              商品を編集
            </div>
            <div className="text-xs text-zinc-500">{product.name}</div>
          </div>
        </header>

        <label className="block">
          <div className="mb-1.5 text-sm font-bold text-zinc-500">商品名</div>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
          />
        </label>

        <div>
          <div className="mb-1.5 text-sm font-bold text-zinc-500">カテゴリ</div>
          <div className="grid grid-cols-4 gap-2">
            {CATEGORIES.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setCategory(c)}
                className={
                  "rounded-xl px-2 py-2 text-sm font-medium transition " +
                  (category === c
                    ? "bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow"
                    : "bg-white text-zinc-700 ring-1 ring-zinc-200")
                }
              >
                {PRODUCT_CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-sm font-bold text-zinc-500">アイコン</div>
          <div className="grid grid-cols-8 gap-1.5">
            {EMOJI_PALETTE.map((e) => (
              <button
                type="button"
                key={e}
                onClick={() => setIconEmoji(e)}
                className={
                  "flex h-10 w-full items-center justify-center rounded-lg text-xl transition " +
                  (iconEmoji === e
                    ? "bg-gradient-to-br from-sky-500 to-blue-600 shadow scale-105"
                    : "bg-zinc-50 hover:bg-zinc-100")
                }
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-sm font-bold text-zinc-500">
            アイコン背景色
          </div>
          <div className="grid grid-cols-10 gap-1.5">
            {PRODUCT_COLOR_KEYS.map((key) => (
              <button
                type="button"
                key={key}
                onClick={() => setColorKey(key)}
                className={
                  "flex h-10 w-full items-center justify-center rounded-lg bg-gradient-to-br text-base shadow transition " +
                  PRODUCT_COLORS[key].gradient +
                  (colorKey === key
                    ? " ring-4 ring-offset-2 ring-zinc-900 scale-110"
                    : " hover:scale-105")
                }
              >
                {iconEmoji}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <div className="mb-1.5 text-sm font-bold text-zinc-500">値段 (円)</div>
          <input
            type="number"
            min={0}
            value={price}
            onChange={(e) =>
              setPrice(e.target.value === "" ? "" : Number(e.target.value))
            }
            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-lg font-bold outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
          />
        </label>

        <div>
          <div className="mb-1.5 text-sm font-bold text-zinc-500">
            仕入数 (現在の在庫)
          </div>
          <div className="space-y-2">
            {product.variants.map((v) => {
              const label =
                v.color === "-" && v.size === "-"
                  ? "標準"
                  : [v.color, v.size]
                      .filter((x) => x !== "-")
                      .join(" / ");
              return (
                <div
                  key={v.id}
                  className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2"
                >
                  <span className="flex-1 text-sm font-medium text-zinc-700">
                    {label}
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={variantStocks[v.id] ?? v.stock}
                    onChange={(e) =>
                      setVariantStocks((prev) => ({
                        ...prev,
                        [v.id]: Number(e.target.value) || 0,
                      }))
                    }
                    className="w-24 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-base font-bold outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                  />
                </div>
              );
            })}
          </div>
        </div>

        {error && (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 rounded-full bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-3 text-base font-bold text-white shadow-lg disabled:opacity-50"
          >
            {submitting ? "保存中…" : "保存"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-700"
          >
            キャンセル
          </button>
        </div>
      </form>
    </div>
  );
}

// =========================================
// 削除確認モーダル
// =========================================
function DeleteConfirmModal({
  product,
  onClose,
  onDone,
}: {
  product: ProductWithVariants;
  onClose: () => void;
  onDone: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setSubmitting(true);
    setError(null);
    try {
      await deleteProductCascade(product.id);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md space-y-4 rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex justify-center text-5xl">⚠️</div>
        <div className="text-center">
          <h2 className="text-xl font-extrabold text-zinc-900">
            本当に削除しますか？
          </h2>
          <p className="mt-2 text-sm text-zinc-600">
            <span className="font-semibold text-zinc-900">
              「{product.name}」
            </span>
            <br />
            この商品と全てのバリエーション (
            {product.variants.length}件) を削除します。
            <br />
            この操作は取り消せません。
          </p>
        </div>

        {error && (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 rounded-full border border-zinc-200 bg-white px-4 py-3 text-base font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={submitting}
            className="flex-1 rounded-full bg-gradient-to-r from-rose-500 to-pink-600 px-4 py-3 text-base font-bold text-white shadow-lg disabled:opacity-50"
          >
            {submitting ? "削除中…" : "削除"}
          </button>
        </div>
      </div>
    </div>
  );
}
