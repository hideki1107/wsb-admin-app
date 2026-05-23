"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createProductWithInitialStock } from "@/lib/repo";
import {
  PRODUCT_COLOR_KEYS,
  PRODUCT_CATEGORY_LABELS,
  type ProductCategory,
  type ProductColorKey,
} from "@/lib/types";
import { PRODUCT_COLORS } from "@/lib/theme";
import { todayIso } from "@/lib/format";
import { auth } from "@/lib/firebase";

// 商品アイコン候補
const EMOJI_PALETTE: string[] = [
  "🎵", "💿", "📀", "🎸", "🎤", "🥁", "🎹", "🎼",
  "👕", "👚", "🧢", "🎽", "🧦", "👜", "🎒", "🪖",
  "🎁", "✨", "⭐", "🔥", "🏷️", "🎀", "📿", "🪪",
  "📦", "📝", "🍀", "🌟", "🍻", "📚", "🖼️", "🎬",
];

const CATEGORIES: ProductCategory[] = ["music", "apparel", "accessory", "other"];

interface VariantInput {
  size: string;
  color: string;
  initialStock: number;
}

export default function NewProductPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ProductCategory>("accessory");
  const [iconEmoji, setIconEmoji] = useState<string>("🎁");
  const [colorKey, setColorKey] = useState<ProductColorKey>("amber");
  const [price, setPrice] = useState<number | "">("");
  const [hasVariants, setHasVariants] = useState(false);
  const [singleStock, setSingleStock] = useState<number | "">("");
  const [variants, setVariants] = useState<VariantInput[]>([
    { size: "S", color: "Black", initialStock: 0 },
  ]);
  const [occurredOn, setOccurredOn] = useState(todayIso());
  const [memo, setMemo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const theme = PRODUCT_COLORS[colorKey];

  function updateVariant(index: number, patch: Partial<VariantInput>) {
    setVariants((prev) =>
      prev.map((v, i) => (i === index ? { ...v, ...patch } : v)),
    );
  }

  function addVariant() {
    setVariants((prev) => [
      ...prev,
      { size: "M", color: "Black", initialStock: 0 },
    ]);
  }

  function removeVariant(index: number) {
    setVariants((prev) => prev.filter((_, i) => i !== index));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("商品名を入力してください");
      return;
    }
    if (price === "" || Number(price) <= 0) {
      setError("値段を入力してください");
      return;
    }

    let variantsToSave: VariantInput[];
    if (hasVariants) {
      if (variants.length === 0) {
        setError("バリエーションを1つ以上追加してください");
        return;
      }
      variantsToSave = variants.map((v) => ({
        size: v.size || "-",
        color: v.color || "-",
        initialStock: Math.max(0, v.initialStock || 0),
      }));
    } else {
      const qty = singleStock === "" ? 0 : Number(singleStock);
      if (qty < 0) {
        setError("仕入数は0以上で入力してください");
        return;
      }
      variantsToSave = [
        { size: "-", color: "-", initialStock: qty },
      ];
    }

    setSubmitting(true);
    try {
      await createProductWithInitialStock({
        name: name.trim(),
        category,
        basePrice: Number(price),
        iconEmoji,
        colorKey,
        memo: memo.trim() || null,
        variants: variantsToSave,
        occurredOn,
        createdBy: auth.currentUser?.uid ?? null,
      });
      router.push("/inventory");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 sm:space-y-7">
      <div className="flex items-center gap-3">
        <div
          className={
            "inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br text-3xl shadow-lg " +
            theme.gradient
          }
        >
          {iconEmoji}
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900">
            商品を新規登録
          </h1>
          <p className="text-sm text-zinc-500 sm:text-base">
            新しい物販商品をマスタに追加します
          </p>
        </div>
      </div>

      <Card>
        <Field label="商品名">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: ORIGINAL TOTE BAG"
            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          />
        </Field>

        <Field label="カテゴリ">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {CATEGORIES.map((cat) => {
              const active = category === cat;
              return (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={
                    "rounded-xl px-3 py-3 text-base font-medium transition " +
                    (active
                      ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md scale-105"
                      : "bg-white text-zinc-700 ring-1 ring-zinc-200 hover:ring-emerald-300")
                  }
                >
                  {PRODUCT_CATEGORY_LABELS[cat]}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="アイコン">
          <div className="grid grid-cols-8 gap-2">
            {EMOJI_PALETTE.map((e) => {
              const active = iconEmoji === e;
              return (
                <button
                  type="button"
                  key={e}
                  onClick={() => setIconEmoji(e)}
                  className={
                    "flex h-11 w-full items-center justify-center rounded-lg text-2xl transition " +
                    (active
                      ? "bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md scale-105"
                      : "bg-zinc-50 hover:bg-zinc-100")
                  }
                >
                  {e}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="アイコン背景色">
          <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
            {PRODUCT_COLOR_KEYS.map((key) => {
              const t = PRODUCT_COLORS[key];
              const active = colorKey === key;
              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => setColorKey(key)}
                  className={
                    "flex h-11 w-full items-center justify-center rounded-xl bg-gradient-to-br text-xl shadow transition " +
                    t.gradient +
                    (active
                      ? " ring-4 ring-offset-2 ring-zinc-900 scale-110"
                      : " hover:scale-105")
                  }
                  title={t.label}
                >
                  {iconEmoji}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="値段 (円)">
          <input
            type="number"
            min={0}
            value={price}
            onChange={(e) =>
              setPrice(e.target.value === "" ? "" : Number(e.target.value))
            }
            placeholder="例: 3000"
            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xl font-bold outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          />
        </Field>

        <Field label="バリエーション">
          <div className="mb-3 flex gap-2">
            <button
              type="button"
              onClick={() => setHasVariants(false)}
              className={
                "flex-1 rounded-xl px-3 py-2.5 text-base font-medium transition " +
                (!hasVariants
                  ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow"
                  : "bg-white text-zinc-700 ring-1 ring-zinc-200")
              }
            >
              単一SKU
            </button>
            <button
              type="button"
              onClick={() => setHasVariants(true)}
              className={
                "flex-1 rounded-xl px-3 py-2.5 text-base font-medium transition " +
                (hasVariants
                  ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow"
                  : "bg-white text-zinc-700 ring-1 ring-zinc-200")
              }
            >
              サイズ/色あり
            </button>
          </div>

          {!hasVariants ? (
            <div>
              <div className="mb-1.5 text-sm font-bold text-zinc-500">
                仕入数
              </div>
              <input
                type="number"
                min={0}
                value={singleStock}
                onChange={(e) =>
                  setSingleStock(
                    e.target.value === "" ? "" : Number(e.target.value),
                  )
                }
                placeholder="例: 20"
                className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xl font-bold outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </div>
          ) : (
            <div className="space-y-2">
              {variants.map((v, i) => (
                <div
                  key={i}
                  className="grid grid-cols-12 gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-2"
                >
                  <input
                    type="text"
                    value={v.size}
                    onChange={(e) =>
                      updateVariant(i, { size: e.target.value })
                    }
                    placeholder="サイズ"
                    className="col-span-4 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-base"
                  />
                  <input
                    type="text"
                    value={v.color}
                    onChange={(e) =>
                      updateVariant(i, { color: e.target.value })
                    }
                    placeholder="色"
                    className="col-span-4 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-base"
                  />
                  <input
                    type="number"
                    min={0}
                    value={v.initialStock}
                    onChange={(e) =>
                      updateVariant(i, {
                        initialStock: Number(e.target.value) || 0,
                      })
                    }
                    placeholder="数"
                    className="col-span-3 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-base"
                  />
                  <button
                    type="button"
                    onClick={() => removeVariant(i)}
                    className="col-span-1 rounded-lg text-zinc-400 hover:bg-rose-100 hover:text-rose-600"
                    aria-label="削除"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addVariant}
                className="w-full rounded-xl border border-dashed border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-600 hover:border-emerald-400 hover:text-emerald-700"
              >
                + バリエーションを追加
              </button>
            </div>
          )}
        </Field>

        <Field label="仕入日">
          <input
            type="date"
            value={occurredOn}
            onChange={(e) => setOccurredOn(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          />
        </Field>

        <Field label="メモ (任意)">
          <input
            type="text"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="例: 仕入先・発注ロット番号"
            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
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
          className="flex-1 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-4 text-lg font-bold text-white shadow-xl shadow-emerald-200 transition hover:scale-[1.02] active:scale-95 disabled:opacity-50 sm:flex-none sm:px-12"
        >
          {submitting ? "登録中…" : "商品を登録"}
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
