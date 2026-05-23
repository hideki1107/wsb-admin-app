"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  listProductsWithVariants,
  recordOnlineOrder,
  recordSale,
  type CreateSaleInput,
} from "@/lib/repo";
import {
  SALES_CHANNELS,
  type ProductWithVariants,
  type SaleItem,
  type SalesChannel,
} from "@/lib/types";
import { CHANNEL_THEME } from "@/lib/theme";
import { yen, todayIso } from "@/lib/format";
import { auth } from "@/lib/firebase";

interface ItemRow {
  id: string;
  productId: string;
  variantId: string;
  quantity: number;
}

function newItem(): ItemRow {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : String(Math.random()),
    productId: "",
    variantId: "",
    quantity: 1,
  };
}

export default function SalesEntryPage() {
  const router = useRouter();
  const [products, setProducts] = useState<ProductWithVariants[]>([]);
  const [loading, setLoading] = useState(true);

  const [channel, setChannel] = useState<SalesChannel>("venue");
  const [occurredOn, setOccurredOn] = useState(todayIso());

  // 会場物販用: 単一商品 (旧UI)
  const [productId, setProductId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [venueQuantity, setVenueQuantity] = useState(1);

  // 通販用: 複数商品
  const [onlineItems, setOnlineItems] = useState<ItemRow[]>([newItem()]);

  // 共通: 金額 (会場/非物販は単品額、通販は合計額)
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

  const theme = CHANNEL_THEME[channel];
  const isVenue = channel === "venue";
  const isOnline = channel === "online";

  // 会場物販: 選択中の商品/variant
  const venueSelectedProduct = useMemo(
    () => products.find((p) => p.id === productId) ?? null,
    [products, productId],
  );

  // 通販: 合計金額の自動候補 (basePrice * quantity の総和)
  const onlineSuggestedTotal = useMemo(() => {
    let total = 0;
    for (const it of onlineItems) {
      const p = products.find((x) => x.id === it.productId);
      if (!p) continue;
      total += p.basePrice * it.quantity;
    }
    return total;
  }, [onlineItems, products]);

  function onChangeChannel(next: SalesChannel) {
    setChannel(next);
    // フォームをリセット
    setProductId("");
    setVariantId("");
    setVenueQuantity(1);
    setOnlineItems([newItem()]);
    setAmount("");
  }

  // 会場物販: 商品変更
  function onChangeVenueProduct(nextProductId: string) {
    setProductId(nextProductId);
    setVariantId("");
    const p = products.find((p) => p.id === nextProductId);
    if (p) setAmount(p.basePrice * venueQuantity);
  }
  function onChangeVenueVariant(nextVariantId: string) {
    setVariantId(nextVariantId);
    if (venueSelectedProduct)
      setAmount(venueSelectedProduct.basePrice * venueQuantity);
  }
  function onChangeVenueQuantity(nextQty: number) {
    const q = Math.max(1, nextQty || 1);
    setVenueQuantity(q);
    if (venueSelectedProduct) setAmount(venueSelectedProduct.basePrice * q);
  }

  // 通販: items 操作
  function updateOnlineItem(id: string, patch: Partial<ItemRow>) {
    setOnlineItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    );
  }
  function onChangeOnlineProduct(id: string, nextProductId: string) {
    const p = products.find((x) => x.id === nextProductId);
    setOnlineItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const autoVariantId =
          p && p.variants.length === 1 ? p.variants[0]!.id : "";
        return {
          ...it,
          productId: nextProductId,
          variantId: autoVariantId,
        };
      }),
    );
  }
  function addOnlineRow() {
    setOnlineItems((prev) => [...prev, newItem()]);
  }
  function removeOnlineRow(id: string) {
    setOnlineItems((prev) =>
      prev.length > 1 ? prev.filter((i) => i.id !== id) : prev,
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (amount === "" || Number(amount) <= 0) {
      setError("金額を入力してください");
      return;
    }

    // 通販: items[] で1注文として登録
    if (isOnline) {
      for (const it of onlineItems) {
        if (!it.productId || !it.variantId) {
          setError("すべての行で商品とバリエーションを選択してください");
          return;
        }
      }
      setSubmitting(true);
      try {
        const items: SaleItem[] = onlineItems.map((it) => ({
          productId: it.productId,
          variantId: it.variantId,
          quantity: it.quantity,
        }));
        await recordOnlineOrder({
          occurredOn,
          items,
          amount: Number(amount),
          memo: memo.trim() || null,
          createdBy: auth.currentUser?.uid ?? null,
        });
        router.push("/sales/list");
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setSubmitting(false);
      }
      return;
    }

    // 会場物販: 単一商品
    if (isVenue) {
      if (!productId || !variantId) {
        setError("商品とバリエーションを選択してください");
        return;
      }
      setSubmitting(true);
      const input: CreateSaleInput = {
        occurredOn,
        channel,
        productId,
        variantId,
        quantity: venueQuantity,
        amount: Number(amount),
        memo: memo.trim() || null,
        createdBy: auth.currentUser?.uid ?? null,
      };
      try {
        await recordSale(input);
        router.push("/sales/list");
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setSubmitting(false);
      }
      return;
    }

    // ライブ/音源/広告/入金: 単一金額のみ
    setSubmitting(true);
    const input: CreateSaleInput = {
      occurredOn,
      channel,
      productId: null,
      variantId: null,
      quantity: 1,
      amount: Number(amount),
      memo: memo.trim() || null,
      createdBy: auth.currentUser?.uid ?? null,
    };
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

        {/* ===== 会場物販: 単一商品 ===== */}
        {isVenue && (
          <>
            <Field label="商品">
              <select
                value={productId}
                onChange={(e) => onChangeVenueProduct(e.target.value)}
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

            {venueSelectedProduct && (
              <Field label="バリエーション">
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {venueSelectedProduct.variants.map((v) => {
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
                        onClick={() => onChangeVenueVariant(v.id)}
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
                value={venueQuantity}
                onChange={(e) => onChangeVenueQuantity(Number(e.target.value))}
                className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
              />
            </Field>
          </>
        )}
      </Card>

      {/* ===== 通販: 複数商品 ===== */}
      {isOnline && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-bold uppercase tracking-wider text-zinc-500">
              商品 ({onlineItems.length}点)
            </span>
            {onlineSuggestedTotal > 0 && (
              <span className="text-sm text-zinc-500">
                単価合計の目安{" "}
                <span className="font-bold text-zinc-700">
                  {yen(onlineSuggestedTotal)}
                </span>
              </span>
            )}
          </div>

          <div className="space-y-3">
            {onlineItems.map((it, idx) => {
              const selectedProduct = products.find(
                (p) => p.id === it.productId,
              );
              return (
                <div
                  key={it.id}
                  className="space-y-3 rounded-2xl bg-white p-4 shadow ring-1 ring-zinc-100"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                      #{idx + 1}
                    </span>
                    {onlineItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeOnlineRow(it.id)}
                        className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-100"
                      >
                        削除
                      </button>
                    )}
                  </div>

                  <label className="block">
                    <div className="mb-1 text-xs font-bold text-zinc-500">
                      商品
                    </div>
                    <select
                      value={it.productId}
                      onChange={(e) =>
                        onChangeOnlineProduct(it.id, e.target.value)
                      }
                      className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-base outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                    >
                      <option value="">選択してください</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({yen(p.basePrice)})
                        </option>
                      ))}
                    </select>
                  </label>

                  {selectedProduct && selectedProduct.variants.length > 1 && (
                    <div>
                      <div className="mb-1 text-xs font-bold text-zinc-500">
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
                          const isSelected = v.id === it.variantId;
                          return (
                            <button
                              type="button"
                              key={v.id}
                              onClick={() =>
                                updateOnlineItem(it.id, { variantId: v.id })
                              }
                              className={
                                "rounded-xl px-2 py-2 text-sm transition " +
                                (isSelected
                                  ? "bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow scale-105"
                                  : "bg-white text-zinc-700 ring-1 ring-zinc-200")
                              }
                            >
                              <div className="font-medium">{label}</div>
                              <div
                                className={
                                  "text-xs " +
                                  (isSelected
                                    ? "text-white/80"
                                    : "text-zinc-500")
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
                    <div className="mb-1 text-xs font-bold text-zinc-500">
                      数量
                    </div>
                    <input
                      type="number"
                      min={1}
                      value={it.quantity}
                      onChange={(e) =>
                        updateOnlineItem(it.id, {
                          quantity: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                      className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-base outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                    />
                  </label>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={addOnlineRow}
            className="mt-3 w-full rounded-2xl border-2 border-dashed border-sky-300 bg-white px-4 py-3 text-base font-semibold text-sky-700 hover:border-sky-500 hover:bg-sky-50"
          >
            + 商品を追加
          </button>
        </div>
      )}

      <Card>
        <Field
          label={isOnline ? "合計金額 (円)" : "金額 (円)"}
        >
          <input
            type="number"
            min={0}
            value={amount}
            onChange={(e) =>
              setAmount(e.target.value === "" ? "" : Number(e.target.value))
            }
            placeholder={
              isOnline && onlineSuggestedTotal > 0
                ? String(onlineSuggestedTotal)
                : "例: 5000"
            }
            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xl font-bold outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
          />
          {isOnline && onlineSuggestedTotal > 0 && (
            <button
              type="button"
              onClick={() => setAmount(onlineSuggestedTotal)}
              className="mt-2 text-sm text-sky-700 hover:underline"
            >
              単価合計 {yen(onlineSuggestedTotal)} を使う
            </button>
          )}
        </Field>

        <Field label="メモ (任意)">
          <input
            type="text"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="例: 渋谷WWW物販、宛先ダグさん、阿部入金"
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
