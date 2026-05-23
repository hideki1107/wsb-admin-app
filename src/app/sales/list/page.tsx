"use client";

import { useEffect, useMemo, useState } from "react";
import {
  deleteSale,
  listProductsWithVariants,
  listSales,
  updateSale,
  type UpdateSaleInput,
} from "@/lib/repo";
import {
  SALES_CHANNELS,
  type Sale,
  type SalesChannel,
  type ProductWithVariants,
} from "@/lib/types";
import { CHANNEL_THEME } from "@/lib/theme";
import { yen } from "@/lib/format";

const REQUIRES_VARIANT: SalesChannel[] = ["venue", "online"];

type ChannelFilter = SalesChannel | "all";

export default function SalesListPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<ProductWithVariants[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingSale, setDeletingSale] = useState<Sale | null>(null);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [filter, setFilter] = useState<ChannelFilter>("all");

  const filteredSales = useMemo(
    () => (filter === "all" ? sales : sales.filter((s) => s.channel === filter)),
    [sales, filter],
  );

  async function refresh() {
    const [s, p] = await Promise.all([
      listSales(),
      listProductsWithVariants(),
    ]);
    setSales(s);
    setProducts(p);
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
    return <p className="text-center text-base text-zinc-500">読み込み中…</p>;
  if (error)
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-base text-rose-700">
        {error}
      </div>
    );

  const productMap = new Map(products.map((p) => [p.id, p]));
  const total = filteredSales.reduce((sum, s) => sum + s.amount, 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900">
          収入一覧
        </h1>
        <p className="mt-1 text-base text-zinc-500">
          {filteredSales.length}件 ・ 合計
          <span className="ml-1 font-bold text-violet-700">
            {yen(total)}
          </span>
        </p>
      </div>

      <div>
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold uppercase tracking-wider text-zinc-500">
            カテゴリで絞り込み
          </span>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as ChannelFilter)}
            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base font-semibold outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 sm:w-72"
          >
            <option value="all">全カテゴリ</option>
            {SALES_CHANNELS.map((ch) => {
              const t = CHANNEL_THEME[ch];
              return (
                <option key={ch} value={ch}>
                  {t.emoji} {t.label}
                </option>
              );
            })}
          </select>
        </label>
      </div>

      {filteredSales.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center text-base text-zinc-500 shadow-md">
          {sales.length === 0
            ? "まだ記録がありません"
            : "該当する記録がありません"}
        </div>
      ) : (
        <ul className="space-y-2.5">
          {filteredSales.map((s) => {
            const product = s.productId ? productMap.get(s.productId) : null;
            const variant =
              product && s.variantId
                ? product.variants.find((v) => v.id === s.variantId)
                : null;
            const t = CHANNEL_THEME[s.channel];
            return (
              <li
                key={s.id}
                className="flex items-start gap-3 rounded-2xl bg-white p-4 shadow-md ring-1 ring-zinc-100 transition hover:shadow-lg sm:p-5"
              >
                <div
                  className={
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-2xl shadow " +
                    t.gradient
                  }
                >
                  {t.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span
                      className={
                        "rounded-full px-2.5 py-0.5 font-semibold " + t.badge
                      }
                    >
                      {t.label}
                    </span>
                    <span className="text-zinc-500">{s.occurredOn}</span>
                  </div>
                  <div className="mt-1 text-base font-semibold text-zinc-900 sm:text-lg">
                    {product ? product.name : "—"}
                    {variant &&
                      ` (${[variant.color, variant.size]
                        .filter((x) => x && x !== "-")
                        .join("/")})`}
                  </div>
                  {s.memo && (
                    <div className="mt-0.5 truncate text-sm text-zinc-500">
                      {s.memo}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <div className="text-right">
                    <div className="text-xl font-bold text-zinc-900 sm:text-2xl">
                      {yen(s.amount)}
                    </div>
                    {s.quantity > 1 && (
                      <div className="text-sm text-zinc-500">×{s.quantity}</div>
                    )}
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEditingSale(s)}
                      className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 transition hover:bg-sky-100 active:scale-95"
                    >
                      編集
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingSale(s)}
                      className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-100 active:scale-95"
                    >
                      削除
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editingSale && (
        <EditSaleModal
          sale={editingSale}
          products={products}
          onClose={() => setEditingSale(null)}
          onDone={async () => {
            setEditingSale(null);
            await refresh();
          }}
        />
      )}

      {deletingSale && (
        <DeleteSaleModal
          sale={deletingSale}
          product={
            deletingSale.productId
              ? productMap.get(deletingSale.productId) ?? null
              : null
          }
          onClose={() => setDeletingSale(null)}
          onDone={async () => {
            setDeletingSale(null);
            await refresh();
          }}
        />
      )}
    </div>
  );
}

function EditSaleModal({
  sale,
  products,
  onClose,
  onDone,
}: {
  sale: Sale;
  products: ProductWithVariants[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [channel, setChannel] = useState<SalesChannel>(sale.channel);
  const [occurredOn, setOccurredOn] = useState(sale.occurredOn);
  const [productId, setProductId] = useState<string>(sale.productId ?? "");
  const [variantId, setVariantId] = useState<string>(sale.variantId ?? "");
  const [quantity, setQuantity] = useState<number>(sale.quantity);
  const [amount, setAmount] = useState<number | "">(sale.amount);
  const [memo, setMemo] = useState(sale.memo ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requiresVariant = REQUIRES_VARIANT.includes(channel);
  const theme = CHANNEL_THEME[channel];

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === productId) ?? null,
    [products, productId],
  );

  function onChangeChannel(next: SalesChannel) {
    setChannel(next);
    if (!REQUIRES_VARIANT.includes(next)) {
      setProductId("");
      setVariantId("");
      setQuantity(1);
    }
  }

  function onChangeProduct(nextProductId: string) {
    setProductId(nextProductId);
    setVariantId("");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (amount === "" || Number(amount) <= 0) {
      setError("金額を入力してください");
      return;
    }
    if (requiresVariant && (!productId || !variantId)) {
      setError("商品とバリエーションを選択してください");
      return;
    }

    const input: UpdateSaleInput = {
      occurredOn,
      channel,
      productId: requiresVariant ? productId : null,
      variantId: requiresVariant ? variantId : null,
      quantity: requiresVariant ? quantity : 1,
      amount: Number(amount),
      memo: memo.trim() || null,
    };

    setSubmitting(true);
    try {
      await updateSale(sale, input);
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
              theme.gradient
            }
          >
            {theme.emoji}
          </div>
          <div>
            <div className="text-lg font-extrabold text-zinc-900">
              収入を編集
            </div>
            <div className="text-xs text-zinc-500">{sale.occurredOn}</div>
          </div>
        </header>

        <div>
          <div className="mb-1.5 text-sm font-bold text-zinc-500">カテゴリ</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {SALES_CHANNELS.map((ch) => {
              const t = CHANNEL_THEME[ch];
              const active = channel === ch;
              return (
                <button
                  type="button"
                  key={ch}
                  onClick={() => onChangeChannel(ch)}
                  className={
                    "rounded-xl px-2 py-2.5 text-sm font-medium transition " +
                    (active
                      ? "bg-gradient-to-br text-white shadow scale-105 " +
                        t.gradient
                      : "bg-white text-zinc-700 ring-1 ring-zinc-200")
                  }
                >
                  <div className="text-lg">{t.emoji}</div>
                  <div className="text-xs">{t.label}</div>
                </button>
              );
            })}
          </div>
        </div>

        <label className="block">
          <div className="mb-1.5 text-sm font-bold text-zinc-500">日付</div>
          <input
            type="date"
            value={occurredOn}
            onChange={(e) => setOccurredOn(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
          />
        </label>

        {requiresVariant && (
          <>
            <label className="block">
              <div className="mb-1.5 text-sm font-bold text-zinc-500">
                商品
              </div>
              <select
                value={productId}
                onChange={(e) => onChangeProduct(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              >
                <option value="">選択してください</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({yen(p.basePrice)})
                  </option>
                ))}
              </select>
            </label>

            {selectedProduct && (
              <div>
                <div className="mb-1.5 text-sm font-bold text-zinc-500">
                  バリエーション
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {selectedProduct.variants.map((v) => {
                    const label =
                      v.color === "-" && v.size === "-"
                        ? "標準"
                        : [v.color, v.size]
                            .filter((x) => x !== "-")
                            .join(" / ");
                    const active = v.id === variantId;
                    return (
                      <button
                        type="button"
                        key={v.id}
                        onClick={() => setVariantId(v.id)}
                        className={
                          "rounded-xl px-3 py-2.5 text-base transition " +
                          (active
                            ? "bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow scale-105"
                            : "bg-white text-zinc-700 ring-1 ring-zinc-200")
                        }
                      >
                        <div className="font-medium">{label}</div>
                        <div
                          className={
                            "text-xs " +
                            (active ? "text-white/80" : "text-zinc-500")
                          }
                        >
                          残 {v.stock}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <label className="block">
              <div className="mb-1.5 text-sm font-bold text-zinc-500">
                数量
              </div>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) =>
                  setQuantity(Math.max(1, Number(e.target.value) || 1))
                }
                className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              />
            </label>
          </>
        )}

        <label className="block">
          <div className="mb-1.5 text-sm font-bold text-zinc-500">
            金額 (円)
          </div>
          <input
            type="number"
            min={0}
            value={amount}
            onChange={(e) =>
              setAmount(e.target.value === "" ? "" : Number(e.target.value))
            }
            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-lg font-bold outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
          />
        </label>

        <label className="block">
          <div className="mb-1.5 text-sm font-bold text-zinc-500">
            メモ (任意)
          </div>
          <input
            type="text"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
          />
        </label>

        {requiresVariant && (
          <p className="rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-700">
            💡 物販の商品/数量を変更すると在庫が自動で再計算されます
          </p>
        )}

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

function DeleteSaleModal({
  sale,
  product,
  onClose,
  onDone,
}: {
  sale: Sale;
  product: ProductWithVariants | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const restoresStock = !!sale.variantId && !!sale.productId;

  async function handleDelete() {
    setSubmitting(true);
    setError(null);
    try {
      await deleteSale(sale);
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
            この収入を削除しますか？
          </h2>
          <p className="mt-3 text-sm text-zinc-600">
            <span className="font-semibold text-zinc-900">
              {sale.occurredOn} ・ {yen(sale.amount)}
              {product && ` (${product.name})`}
            </span>
            {restoresStock && (
              <>
                <br />
                在庫を {sale.quantity} 個 復元します。
              </>
            )}
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
