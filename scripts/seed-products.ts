/**
 * 商品マスタの初期投入スクリプト
 *
 * 実行:
 *   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json \
 *   FIREBASE_PROJECT_ID=your-project-id \
 *   npx tsx scripts/seed-products.ts
 *
 * https://w-s-b.jp/goods/ にある商品を Firestore に投入する。
 * 既存の同名 product があれば skip。
 */

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";

const projectId = process.env.FIREBASE_PROJECT_ID;
const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!projectId) {
  console.error("FIREBASE_PROJECT_ID を環境変数で指定してください");
  process.exit(1);
}
if (!credPath) {
  console.error(
    "GOOGLE_APPLICATION_CREDENTIALS でサービスアカウントJSONのパスを指定してください",
  );
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(credPath, "utf-8"));

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
    projectId,
  });
}

const db = getFirestore();

interface SeedVariant {
  size: string;
  color: string;
  stock: number;
}
interface SeedProduct {
  name: string;
  category: "music" | "apparel" | "accessory" | "other";
  basePrice: number;
  variants: SeedVariant[];
}

const PRODUCTS: SeedProduct[] = [
  {
    name: "1ST MINI ALBUM「the flotsam」CD",
    category: "music",
    basePrice: 2500,
    variants: [{ size: "-", color: "-", stock: 0 }],
  },
  {
    name: "ORIGINAL LOGO TEE",
    category: "apparel",
    basePrice: 3000,
    variants: [
      { size: "L", color: "Black", stock: 0 },
      { size: "XL", color: "Black", stock: 0 },
      { size: "L", color: "White", stock: 0 },
      { size: "XL", color: "White", stock: 0 },
    ],
  },
  {
    name: "ORIGINAL LOGO TOWEL",
    category: "accessory",
    basePrice: 2500,
    variants: [{ size: "-", color: "-", stock: 0 }],
  },
  {
    name: "ORIGINAL PINS",
    category: "accessory",
    basePrice: 500,
    variants: [{ size: "-", color: "-", stock: 0 }],
  },
  {
    name: "Random Sticker (3枚入り)",
    category: "accessory",
    basePrice: 300,
    variants: [{ size: "-", color: "-", stock: 0 }],
  },
  {
    name: "Lighter",
    category: "accessory",
    basePrice: 500,
    variants: [{ size: "-", color: "-", stock: 0 }],
  },
];

async function main() {
  for (const p of PRODUCTS) {
    const existing = await db
      .collection("products")
      .where("name", "==", p.name)
      .limit(1)
      .get();
    if (!existing.empty) {
      console.log(`skip: ${p.name} (already exists)`);
      continue;
    }
    const ref = await db.collection("products").add({
      name: p.name,
      category: p.category,
      basePrice: p.basePrice,
      isActive: true,
      createdAt: Timestamp.now(),
    });
    for (const v of p.variants) {
      await ref.collection("variants").add({
        size: v.size,
        color: v.color,
        stock: v.stock,
        skuCode: null,
        createdAt: Timestamp.now(),
      });
    }
    console.log(`created: ${p.name} (${p.variants.length} variants)`);
  }
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
