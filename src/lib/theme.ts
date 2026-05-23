// カラーテーマ - 収入/支出のカテゴリごとの絵文字・グラデーションをまとめる
//
// Tailwind v4 はビルド時に使われたクラスを抽出するので、
// 動的補間 (`bg-${color}-50`) は不可。フル文字列で記述すること。

import type {
  SalesChannel,
  ExpenseCategory,
  ProductColorKey,
  ProductCategory,
} from "./types";

export interface Theme {
  emoji: string;
  label: string;
  gradient: string;   // "from-... to-..."
  ring: string;       // "ring-...-200"
  text: string;       // "text-...-700"
  badge: string;      // 小さい色つきbadge
}

export const CHANNEL_THEME: Record<SalesChannel, Theme> = {
  venue: {
    emoji: "🎤",
    label: "会場物販",
    gradient: "from-orange-400 to-amber-500",
    ring: "ring-orange-200",
    text: "text-orange-700",
    badge: "bg-orange-100 text-orange-700",
  },
  online: {
    emoji: "📦",
    label: "通販",
    gradient: "from-sky-400 to-blue-500",
    ring: "ring-sky-200",
    text: "text-sky-700",
    badge: "bg-sky-100 text-sky-700",
  },
  live: {
    emoji: "🎸",
    label: "ライブ利益",
    gradient: "from-violet-500 to-purple-600",
    ring: "ring-violet-200",
    text: "text-violet-700",
    badge: "bg-violet-100 text-violet-700",
  },
  music: {
    emoji: "🎵",
    label: "音源収入",
    gradient: "from-emerald-400 to-teal-500",
    ring: "ring-emerald-200",
    text: "text-emerald-700",
    badge: "bg-emerald-100 text-emerald-700",
  },
  ad: {
    emoji: "📣",
    label: "広告収入",
    gradient: "from-yellow-400 to-amber-500",
    ring: "ring-yellow-200",
    text: "text-yellow-700",
    badge: "bg-yellow-100 text-yellow-800",
  },
  deposit: {
    emoji: "💴",
    label: "入金",
    gradient: "from-lime-400 to-green-500",
    ring: "ring-lime-200",
    text: "text-lime-700",
    badge: "bg-lime-100 text-lime-800",
  },
};

// 商品アイコンの色パレット (新規商品登録で選択可)
export const PRODUCT_COLORS: Record<
  ProductColorKey,
  { gradient: string; ring: string; label: string }
> = {
  violet: { gradient: "from-violet-400 to-fuchsia-500", ring: "ring-violet-200", label: "バイオレット" },
  fuchsia: { gradient: "from-fuchsia-400 to-pink-500", ring: "ring-fuchsia-200", label: "ピンク" },
  rose: { gradient: "from-rose-400 to-red-500", ring: "ring-rose-200", label: "ローズ" },
  orange: { gradient: "from-orange-400 to-amber-500", ring: "ring-orange-200", label: "オレンジ" },
  amber: { gradient: "from-amber-400 to-yellow-500", ring: "ring-amber-200", label: "アンバー" },
  emerald: { gradient: "from-emerald-400 to-teal-500", ring: "ring-emerald-200", label: "グリーン" },
  teal: { gradient: "from-teal-400 to-cyan-500", ring: "ring-teal-200", label: "ティール" },
  sky: { gradient: "from-sky-400 to-blue-500", ring: "ring-sky-200", label: "スカイ" },
  indigo: { gradient: "from-indigo-400 to-blue-600", ring: "ring-indigo-200", label: "インディゴ" },
  slate: { gradient: "from-slate-400 to-zinc-500", ring: "ring-slate-200", label: "グレー" },
};

// カテゴリのデフォルト (iconEmoji や colorKey が未設定の商品向け)
export const PRODUCT_CATEGORY_DEFAULTS: Record<
  ProductCategory,
  { emoji: string; colorKey: ProductColorKey }
> = {
  music: { emoji: "🎵", colorKey: "emerald" },
  apparel: { emoji: "👕", colorKey: "violet" },
  accessory: { emoji: "🎁", colorKey: "amber" },
  other: { emoji: "📦", colorKey: "slate" },
};

// 商品の表示用テーマを返す (商品個別の設定 > カテゴリのデフォルト)
export function getProductTheme(p: {
  category: ProductCategory;
  iconEmoji?: string | null;
  colorKey?: ProductColorKey | null;
}): { emoji: string; gradient: string; ring: string } {
  const def = PRODUCT_CATEGORY_DEFAULTS[p.category];
  const emoji = p.iconEmoji || def.emoji;
  const palette = PRODUCT_COLORS[p.colorKey ?? def.colorKey];
  return { emoji, gradient: palette.gradient, ring: palette.ring };
}

export const EXPENSE_THEME: Record<ExpenseCategory, Theme> = {
  production: {
    emoji: "🎬",
    label: "制作費",
    gradient: "from-indigo-400 to-blue-500",
    ring: "ring-indigo-200",
    text: "text-indigo-700",
    badge: "bg-indigo-100 text-indigo-700",
  },
  staff: {
    emoji: "👥",
    label: "スタッフ",
    gradient: "from-cyan-400 to-teal-500",
    ring: "ring-cyan-200",
    text: "text-cyan-700",
    badge: "bg-cyan-100 text-cyan-700",
  },
  venue: {
    emoji: "🏛️",
    label: "会場費",
    gradient: "from-orange-400 to-red-500",
    ring: "ring-orange-200",
    text: "text-orange-700",
    badge: "bg-orange-100 text-orange-700",
  },
  studio: {
    emoji: "🎙️",
    label: "スタジオ代",
    gradient: "from-stone-400 to-zinc-600",
    ring: "ring-stone-200",
    text: "text-stone-700",
    badge: "bg-stone-100 text-stone-700",
  },
  shipping: {
    emoji: "🚚",
    label: "通販送料",
    gradient: "from-green-400 to-emerald-500",
    ring: "ring-green-200",
    text: "text-green-700",
    badge: "bg-green-100 text-green-700",
  },
  promo: {
    emoji: "📣",
    label: "宣伝",
    gradient: "from-pink-400 to-fuchsia-500",
    ring: "ring-pink-200",
    text: "text-pink-700",
    badge: "bg-pink-100 text-pink-700",
  },
  party: {
    emoji: "🍻",
    label: "打ち上げ",
    gradient: "from-yellow-400 to-orange-500",
    ring: "ring-yellow-200",
    text: "text-yellow-800",
    badge: "bg-yellow-100 text-yellow-800",
  },
  other: {
    emoji: "📝",
    label: "その他",
    gradient: "from-slate-400 to-gray-500",
    ring: "ring-slate-200",
    text: "text-slate-700",
    badge: "bg-slate-100 text-slate-700",
  },
};
