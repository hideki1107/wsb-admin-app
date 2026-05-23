// WSB 物販・経理アプリ ドメイン型

export type ProductCategory = "music" | "apparel" | "accessory" | "other";

export type SalesChannel =
  | "venue"   // 会場物販
  | "online"  // 通販
  | "live"    // ライブ利益
  | "music"   // 音源収入
  | "ad"      // 広告収入
  | "deposit"; // 入金 (メンバーからの資金提供)

export const SALES_CHANNEL_LABELS: Record<SalesChannel, string> = {
  venue: "会場物販",
  online: "通販",
  live: "ライブ利益",
  music: "音源収入",
  ad: "広告収入",
  deposit: "入金",
};

export const SALES_CHANNELS: SalesChannel[] = [
  "venue",
  "online",
  "live",
  "music",
  "ad",
  "deposit",
];

export type ExpenseCategory =
  | "production"   // 制作費 (録音/MV/ジャケ等)
  | "staff"        // スタッフ・カメラマン代
  | "venue"        // 会場費
  | "studio"       // スタジオ代
  | "shipping"     // 通販送料
  | "promo"        // 宣伝・広告費
  | "party"        // 打ち上げ
  | "other";       // その他

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  production: "制作費",
  staff: "スタッフ",
  venue: "会場費",
  studio: "スタジオ代",
  shipping: "通販送料",
  promo: "宣伝",
  party: "打ち上げ",
  other: "その他",
};

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "production",
  "staff",
  "venue",
  "studio",
  "shipping",
  "promo",
  "party",
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

// 1注文に複数商品が含まれるケース (通販で複数選択時) の各商品行
export interface SaleItem {
  productId: string;
  variantId: string;
  quantity: number;
}

export interface Sale {
  id: string;
  occurredOn: string;
  channel: SalesChannel;
  // 単一商品時 (会場物販/通販1点/非物販時)
  productId?: string | null;
  variantId?: string | null;
  quantity: number;
  // 複数商品時 (通販で2点以上) - 設定されていれば items を優先表示
  items?: SaleItem[] | null;
  // amount は注文全体の合計
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
