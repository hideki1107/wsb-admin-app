// WSB 物販・経理アプリ ドメイン型

export type ProductCategory = "music" | "apparel" | "accessory" | "other";

export type SalesChannel =
  | "venue"   // 会場物販
  | "online"  // 通販
  | "live"    // ライブ利益
  | "music"   // 音源収入
  | "ad";     // 広告収入

export const SALES_CHANNEL_LABELS: Record<SalesChannel, string> = {
  venue: "会場物販",
  online: "通販",
  live: "ライブ利益",
  music: "音源収入",
  ad: "広告収入",
};

export const SALES_CHANNELS: SalesChannel[] = [
  "venue",
  "online",
  "live",
  "music",
  "ad",
];

export type ExpenseCategory =
  | "production"   // 制作費 (録音/MV/ジャケ等)
  | "staff"        // スタッフ・カメラマン代
  | "venue"        // 会場費・スタジオ
  | "transport"    // 交通費
  | "promo"        // 宣伝・広告費
  | "party"        // 打ち上げ
  | "equipment"    // 機材
  | "other";       // その他

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  production: "制作費",
  staff: "スタッフ",
  venue: "会場費",
  transport: "交通費",
  promo: "宣伝",
  party: "打ち上げ",
  equipment: "機材",
  other: "その他",
};

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "production",
  "staff",
  "venue",
  "transport",
  "promo",
  "party",
  "equipment",
  "other",
];

export const PRODUCT_CATEGORY_LABELS: Record<ProductCategory, string> = {
  music: "音楽",
  apparel: "衣類",
  accessory: "雑貨",
  other: "その他",
};

export type ProductColorKey =
  | "violet"
  | "fuchsia"
  | "rose"
  | "orange"
  | "amber"
  | "emerald"
  | "teal"
  | "sky"
  | "indigo"
  | "slate";

export const PRODUCT_COLOR_KEYS: ProductColorKey[] = [
  "violet",
  "fuchsia",
  "rose",
  "orange",
  "amber",
  "emerald",
  "teal",
  "sky",
  "indigo",
  "slate",
];

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  basePrice: number;
  isActive: boolean;
  iconEmoji?: string | null;       // 絵文字
  colorKey?: ProductColorKey | null;
  memo?: string | null;
  createdAt: number;
}

export interface ProductVariant {
  id: string;
  productId: string;
  size: string;
  color: string;
  stock: number;
  skuCode?: string | null;
  createdAt: number;
}

export interface ProductWithVariants extends Product {
  variants: ProductVariant[];
}

export interface Sale {
  id: string;
  occurredOn: string;
  channel: SalesChannel;
  productId?: string | null;
  variantId?: string | null;
  quantity: number;
  amount: number;
  memo?: string | null;
  createdBy?: string | null;
  createdAt: number;
}

export interface Expense {
  id: string;
  occurredOn: string;
  category: ExpenseCategory;
  amount: number;          // 正の数で保存 (支出額)
  memo?: string | null;
  createdBy?: string | null;
  createdAt: number;
}

export interface StockMovement {
  id: string;
  variantId: string;
  productId: string;
  delta: number;
  reason: "restock" | "adjust" | "other";
  memo?: string | null;
  occurredOn: string;
  createdBy?: string | null;
  createdAt: number;
}
