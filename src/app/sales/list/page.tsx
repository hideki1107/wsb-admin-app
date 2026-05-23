"use client";

import { useEffect, useState } from "react";
import {
  deleteSale,
  listProductsWithVariants,
  listSales,
} from "@/lib/repo";
import {
  type Sale,
  type ProductWithVariants,
} from "@/lib/types";
import { CHANNEL_THEME } from "@/lib/theme";
import { yen } from "@/lib/format";

export default function SalesListPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<ProductWithVariants[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingSale, setDeletingSale] = useState<Sale | null>(null);

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
  const total = sales.reduce((sum, s) => sum + s.amount, 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900">
          収入一覧
        </h1>
        <p className="mt-1 text-base text-zinc-500">
          {sales.length}件 ・ 合計
          <span className="ml-1 font-bold text-violet-700">
            {yen(total)}
          </span>
        </p>
      </div>

      {sales.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center text-base text-zinc-500 shadow-md">
          まだ記録がありません
        </div>
      ) : (
        <ul className="space-y-2.5">
          {sales.map((s) => {
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
                  <button
                    type="button"
                    onClick={() => setDeletingSale(s)}
                    className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-100 active:scale-95"
                    aria-label="削除"
                  >
                    削除
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
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
