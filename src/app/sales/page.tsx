"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  listProductsWithVariants,
  recordSale,
  type CreateSaleInput,
} from "@/lib/repo";
import {
  SALES_CHANNELS,
  type ProductWithVariants,
  type SalesChannel,
} from "@/lib/types";
import { CHANNEL_THEME } from "@/lib/theme";
import { yen, todayIso } from "@/lib/format";
import { auth } from "@/lib/firebase";

const REQUIRES_VARIANT: SalesChannel[] = ["venue", "online"];

export default function SalesEntryPage() {
  const router = useRouter();
  const [products, setProducts] = useState<ProductWithVariants[]>([]);
  const [loading, setLoading] = useState(true);

  const [channel, setChannel] = useState<SalesChannel>("venue");
  const [occurredOn, setOccurredOn] = useState(todayIso());
  const [productId, setProductId] = useState<string>("");
  const [variantId, setVariantId] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [amount, setAmount] = useState<number | "">("");
  const [memo, setMemo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const list = await listProductsWithVariants();
        setProducts(list);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const requiresVariant = REQUIRES_VARIANT.includes(channel);
  const theme = CHANNEL_THEME[channel];

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === productId) ?? null,
    [products, productId],
  );

  const selectedVariant = useMemo(
    () => selectedProduct?.variants.find((v) => v.id === variantId) ?? null,
    [selectedProduct, variantId],
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
    const p = products.find((p) => p.id === nextProductId);
    if (p) setAmount(p.basePrice * quantity);
  }

  function onChangeVariant(nextVariantId: string) {
    setVariantId(nextVariantId);
    if (selectedProduct) setAmount(selectedProduct.basePrice * quantity);
  }

  function onChangeQuantity(nextQty: number) {
    const q = Math.max(1, nextQty || 1);
    setQuantity(q);
    if (selectedProduct) setAmount(selectedProduct.basePrice * q);
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
    if (
      requiresVariant &&
      selectedVariant &&
      selectedVariant.stock < quantity
    ) {
      const ok = confirm(
        `在庫が${selectedVariant.stock}個しかありませんが、${quantity}個分の収入として記録しますか？`,
      );
      if (!ok) return;
    }

    const input: CreateSaleInput = {
      occurredOn,
      channel,
      productId: requiresVariant ? productId : null,
      variantId: requiresVariant ? variantId : null,
      quantity: requiresVariant ? quantity : 1,
      amount: Number(amount),
      memo: memo.trim() || null,
      createdBy: auth.currentUser?.uid ?? null,
    };

    setSubmitting(true);
    try {
      await recordSale(input);
      router.push("/sales/list");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSubmitting(false);
    }
  }

  if (loading)
    return <p className="text-center text-base text-zinc-500">読み込み中…</p>;

  return (
    <form onSubmit={onSubmit} className="space-y-6 sm:space-y-7">
      <div className="flex items-center gap-3">
        <div
          className={
            "inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br text-3xl shadow-lg " +
            theme.gradient
          }
        >
          {theme.emoji}
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900">
            収入を記録
          </h1>
          <p className="text-sm text-zinc-500 sm:text-base">
            カテゴリを選んで金額を入力
          </p>
        </div>
      </div>

      <Field label="カテゴリ">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
          {SALES_CHANNELS.map((ch) => {
            const t = CHANNEL_THEME[ch];
            const active = channel === ch;
            return (
              <button
                type="button"
                key={ch}
                onClick={() => onChangeChannel(ch)}
                className={
                  "rounded-2xl px-3 py-4 text-base font-medium transition " +
                  (active
                    ? "bg-gradient-to-br text-white shadow-lg scale-105 " +
                      t.gradient
                    : "bg-white text-zinc-700 shadow-sm hover:shadow-md hover:scale-[1.02] ring-1 " +
                      t.ring)
                }
              >
                <div className="text-2xl">{t.emoji}</div>
                <div className="mt-1.5 text-sm">{t.label}</div>
              </button>
            );
          })}
        </div>
      </Field>

      <Card>
        <Field label="日付">
          <input
            type="date"
            value={occurredOn}
            onChange={(e) => setOccurredOn(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
          />
        </Field>

        {requiresVariant && (
          <>
            <Field label="商品">
              <select
                value={productId}
                onChange={(e) => onChangeProduct(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
              >
                <option value="">選択してください</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({yen(p.basePrice)})
                  </option>
                ))}
              </select>
            </Field>

            {selectedProduct && (
              <Field label="バリエーション">
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {selectedProduct.variants.map((v) => {
                    const label =
                      v.color === "-" && v.size === "-"
                        ? "標準"
                        : [v.color, v.size]
                            .filter((x) => x !== "-")
                            .join(" / ");
                    const isSelected = v.id === variantId;
                    return (
                      <button
                        type="button"
                        key={v.id}
                        onClick={() => onChangeVariant(v.id)}
                        className={
                          "rounded-xl px-3 py-3 text-base transition " +
                          (isSelected
                            ? "bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-md scale-105"
                            : "bg-white text-zinc-700 ring-1 ring-zinc-200 hover:ring-violet-300 hover:shadow-sm")
                        }
                      >
                        <div className="font-medium">{label}</div>
                        <div
                          className={
                            "text-sm " +
                            (isSelected ? "text-white/80" : "text-zinc-500")
                          }
                        >
                          残 {v.stock}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Field>
            )}

            <Field label="数量">
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => onChangeQuantity(Number(e.target.value))}
                className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
              />
            </Field>
          </>
        )}

        <Field label="金額 (円)">
          <input
            type="number"
            min={0}
            value={amount}
            onChange={(e) =>
              setAmount(e.target.value === "" ? "" : Number(e.target.value))
            }
            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xl font-bold outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            placeholder="例: 5000"
          />
        </Field>

        <Field label="メモ (任意)">
          <input
            type="text"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="例: 渋谷WWW物販、Spotify印税"
            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
          />
        </Field>
      </Card>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-base text-rose-700">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-4 text-lg font-bold text-white shadow-xl shadow-fuchsia-200 transition hover:scale-[1.02] active:scale-95 disabled:opacity-50 sm:flex-none sm:px-12"
        >
          {submitting ? "登録中…" : "登録する"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-full border border-zinc-200 bg-white px-6 py-4 text-base text-zinc-700 hover:bg-zinc-50"
        >
          キャンセル
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-bold uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      {children}
    </label>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-5 rounded-2xl bg-white p-5 shadow-xl sm:p-6">
      {children}
    </div>
  );
}
