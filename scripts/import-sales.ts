/**
 * スプレッドシート(CSV)からの売上データ移行スクリプト (汎用テンプレート)
 *
 * 実行:
 *   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json \
 *   FIREBASE_PROJECT_ID=your-project-id \
 *   npx tsx scripts/import-sales.ts ~/Desktop/sales.csv
 *
 * 期待するCSVヘッダ (順不同, 一部欠けてもOK):
 *   date,channel,product,size,color,quantity,amount,memo
 *
 * channel: venue | online | live | music | ad  (日本語の場合は本ファイル下部のmapで対応)
 * date: YYYY-MM-DD あるいは YYYY/MM/DD
 *
 * 実際のCSV列名が分かったらこのスクリプトをカスタマイズする予定。
 */

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";
import { parse } from "csv-parse/sync";

const projectId = process.env.FIREBASE_PROJECT_ID;
const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const csvPath = process.argv[2];

if (!projectId || !credPath || !csvPath) {
  console.error(
    "Usage: GOOGLE_APPLICATION_CREDENTIALS=... FIREBASE_PROJECT_ID=... npx tsx scripts/import-sales.ts <csv-path>",
  );
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(credPath, "utf-8"));
if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount), projectId });
}
const db = getFirestore();

// 日本語チャネル名 → DB上のenum
const CHANNEL_MAP: Record<string, string> = {
  会場物販: "venue",
  会場: "venue",
  通販: "online",
  オンライン: "online",
  ライブ: "live",
  ライブ利益: "live",
  音源: "music",
  音源収入: "music",
  広告: "ad",
  広告収入: "ad",
};

function normalizeChannel(raw: string): string {
  const t = raw.trim();
  if (CHANNEL_MAP[t]) return CHANNEL_MAP[t];
  if (["venue", "online", "live", "music", "ad"].includes(t)) return t;
  throw new Error(`unknown channel: ${raw}`);
}

function normalizeDate(raw: string): string {
  const t = raw.trim().replace(/\//g, "-");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    throw new Error(`invalid date: ${raw}`);
  }
  return t;
}

interface Row {
  date?: string;
  channel?: string;
  product?: string;
  size?: string;
  color?: string;
  quantity?: string;
  amount?: string;
  memo?: string;
  [k: string]: string | undefined;
}

async function main() {
  const text = readFileSync(csvPath, "utf-8");
  const rows: Row[] = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  // 商品マスタを事前ロード (name → product, (productId,size,color) → variant)
  const productsSnap = await db.collection("products").get();
  const productsByName = new Map<
    string,
    { id: string; basePrice: number }
  >();
  const variantsByKey = new Map<string, string>(); // `${productId}|${size}|${color}` → variantId

  for (const ps of productsSnap.docs) {
    const data = ps.data();
    productsByName.set(data.name, { id: ps.id, basePrice: data.basePrice });
    const variantsSnap = await ps.ref.collection("variants").get();
    for (const vs of variantsSnap.docs) {
      const v = vs.data();
      variantsByKey.set(
        `${ps.id}|${v.size ?? "-"}|${v.color ?? "-"}`,
        vs.id,
      );
    }
  }

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const [i, row] of rows.entries()) {
    try {
      const channel = normalizeChannel(row.channel ?? "");
      const date = normalizeDate(row.date ?? "");
      const qty = row.quantity ? Number(row.quantity) : 1;
      const amount = row.amount ? Number(row.amount) : 0;

      let productId: string | null = null;
      let variantId: string | null = null;
      if (row.product && row.product.trim()) {
        const product = productsByName.get(row.product.trim());
        if (!product) throw new Error(`unknown product: ${row.product}`);
        productId = product.id;
        const size = row.size?.trim() || "-";
        const color = row.color?.trim() || "-";
        variantId =
          variantsByKey.get(`${productId}|${size}|${color}`) ?? null;
        if (!variantId) {
          throw new Error(
            `unknown variant: ${row.product} / ${size} / ${color}`,
          );
        }
      }

      await db.collection("sales").add({
        occurredOn: date,
        channel,
        productId,
        variantId,
        quantity: qty,
        amount,
        memo: row.memo?.trim() || null,
        createdBy: null,
        createdAt: Timestamp.now(),
      });
      created++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`row ${i + 2}: ${msg}`);
      skipped++;
    }
  }

  console.log(`created: ${created}`);
  console.log(`skipped: ${skipped}`);
  if (errors.length) {
    console.log("errors:");
    for (const e of errors) console.log("  " + e);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
