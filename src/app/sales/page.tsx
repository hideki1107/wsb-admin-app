"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  listProductsWithVariants,
  recordMultipleSales,
  recordSale,
  type CreateSaleInput,
  type MultiSaleItem,
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

interface ItemRow {
  id: string;
  productId: string;
  variantId: string;
  quantity: number;
  amount: number | "";
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
    amount: "",
  };
}

export default function SalesEntryPage() {
  const router = useRouter();
  const [products, setProducts] = useState<ProductWithVariants[]>([]);
  const [loading, setLoading] = useState(true);

  const [channel, setChannel] = useState<SalesChannel>("venue");
  const [occurredOn, setOccurredOn] = useState(todayIso());

  // 物販用: 複数商品リスト
  const [items, setItems] = useState<ItemRow[]>([newItem()]);

  // 非物販用: 単一金額
  const [singleAmount, setSingleAmount] = useState<number | "">("");

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

  function onChangeChannel(next: SalesChannel) {
    setChannel(next);
    if (!REQUIRES_VARIANT.includes(next)) {
      // 非物販に切り替えるときは items をリセット
      setItems([newItem()]);
    }
  }

  function updateItem(id: string, patch: Partial<ItemRow>) {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    );
  }

  function onChangeItemProduct(id: string, nextProductId: string) {
    const p = products.find((x) => x.id === nextProductId);
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        // variantが1個しかなければ自動選択
        const autoVariantId =
          p && p.variants.length === 1 ? p.variants[0]!.id : "";
        const amount = p && autoVariantId ? p.basePrice * it.quantity : "";
        return {
          ...it,
          productId: nextProductId,
          variantId: autoVariantId,
          amount: amount === "" ? it.amount : amount,
        };
      }),
    );
  }

  function onChangeItemVariant(id: string, nextVariantId: string) {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const p = products.find((x) => x.id === it.productId);
        const amount = p ? p.basePrice * it.quantity : it.amount;
        return { ...it, variantId: nextVariantId, amount };
      }),
    );
  }

  function onChangeItemQuantity(id: string, nextQty: number) {
    const q = Math.max(1, nextQty || 1);
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const p = products.find((x) => x.id === it.productId);
        const amount = p ? p.basePrice * q : it.amount;
        return { ...it, quantity: q, amount };
      }),
    );
  }

  function addItemRow() {
    setItems((prev) => [...prev, newItem()]);
  }

  function removeItemRow(id: string) {
    setItems((prev) => (prev.length > 1 ? prev.filter((i) => i.id !== id) : prev));
  }

  const itemsTotal = items.reduce(
    (sum, it) => sum + (Number(it.amount) || 0),
    0,
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (requiresVariant) {
      // バリデーション: 全行に商品+バリエーション+金額があるか
      for (const it of items) {
        if (!it.productId || !it.variantId) {
          setError("すべての行で商品とバリエーションを選択してください");
          return;
        }
        if (it.amount === "" || Number(it.amount) <= 0) {
          setError("すべての行の金額を入力してください");
          return;
        }
      }
      setSubmitting(true);
      try {
        const multiItems: MultiSaleItem[] = items.map((it) => ({
          productId: it.productId,
          variantId: it.variantId,
          quantity: it.quantity,
          amount: Number(it.amount),
        }));
        await recordMultipleSales({
          occurredOn,
          channel,
          items: multiItems,
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

    // 非物販: 単一金額
    if (singleAmount === "" || Number(singleAmount) <= 0) {
      setError("金額を入力してください");
      return;
    }
    const input: CreateSaleInput = {
      occurredOn,
      channel,
      productId: null,
      variantId: null,
      quantity: 1,
      amount: Number(singleAmount),
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
      </Card>

      {requiresVariant ? (
        <>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-bold uppercase tracking-wider text-zinc-500">
                商品 ({items.length}点)
              </span>
              <span className="text-sm text-zinc-500">
                合計{" "}
                <span className="text-lg font-extrabold text-zinc-900">
                  {yen(itemsTotal)}
                </span>
              </span>
            </div>

            <div className="space-y-3">
              {items.map((it, idx) => {
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
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItemRow(it.id)}
                          className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-100"
                          aria-label="行を削除"
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
                          onChangeItemProduct(it.id, e.target.value)
                        }
                        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-base outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
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
                                  onChangeItemVariant(it.id, v.id)
                                }
                                className={
                                  "rounded-xl px-2 py-2 text-sm transition " +
                                  (isSelected
                                    ? "bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow scale-105"
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

                    <div className="grid grid-cols-2 gap-3">
                      <label className="block">
                        <div className="mb-1 text-xs font-bold text-zinc-500">
                          数量
                        </div>
                        <input
                          type="number"
                          min={1}
                          value={it.quantity}
                          onChange={(e) =>
                            onChangeItemQuantity(
                              it.id,
                              Number(e.target.value),
                            )
                          }
                          className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-base outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                        />
                      </label>
                      <label className="block">
                        <div className="mb-1 text-xs font-bold text-zinc-500">
                          金額 (円)
                        </div>
                        <input
                          type="number"
                          min={0}
                          value={it.amount}
                          onChange={(e) =>
                            updateItem(it.id, {
                              amount:
                                e.target.value === ""
                                  ? ""
                                  : Number(e.target.value),
                            })
                          }
                          className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-base font-bold outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={addItemRow}
              className="mt-3 w-full rounded-2xl border-2 border-dashed border-violet-300 bg-white px-4 py-3 text-base font-semibold text-violet-700 hover:border-violet-500 hover:bg-violet-50"
            >
              + 商品を追加
            </button>
          </div>
        </>
      ) : (
        <Card>
          <Field label="金額 (円)">
            <input
              type="number"
              min={0}
              value={singleAmount}
              onChange={(e) =>
                setSingleAmount(
                  e.target.value === "" ? "" : Number(e.target.value),
                )
              }
              className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xl font-bold outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
              placeholder="例: 5000"
            />
          </Field>
        </Card>
      )}

      <Card>
        <Field label="メモ (任意)">
          <input
            type="text"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="例: 渋谷WWW物販、Spotify印税、阿部入金"
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
          {submitting
            ? "登録中…"
            : requiresVariant && items.length > 1
              ? `${items.length}件をまとめて登録`
              : "登録する"}
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
