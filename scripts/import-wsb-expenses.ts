/**
 * WSB スプレッドシートの支出セクションを Firestore (expenses) に投入する
 *
 * 実行:
 *   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json \
 *   FIREBASE_PROJECT_ID=wsb-admin-app \
 *   npx tsx scripts/import-wsb-expenses.ts ~/Desktop/sales.csv
 *
 * 取り込み対象: ライブ/制作セクション (列C-H) で「支出」フラグが立つ行
 * 詳細テキストからカテゴリを推定:
 *   "打ち上げ"      → party
 *   "スタッフ" 系   → staff
 *   "カメラ"        → staff
 *   "会場" "スタジオ" → venue
 *   "交通" "ガソリン" → transport
 *   "宣伝" "印刷"   → promo
 *   "機材"          → equipment
 *   "録音" "制作"   → production
 *   それ以外          → other
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
    "Usage: GOOGLE_APPLICATION_CREDENTIALS=... FIREBASE_PROJECT_ID=... npx tsx scripts/import-wsb-expenses.ts <csv-path>",
  );
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(credPath, "utf-8"));
if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount), projectId });
}
const db = getFirestore();

const DEFAULT_YEAR = 2025;

type Category =
  | "production"
  | "staff"
  | "venue"
  | "transport"
  | "promo"
  | "party"
  | "equipment"
  | "other";

function categorize(detail: string): Category {
  const t = detail;
  if (t.includes("打ち上げ") || t.includes("食事")) return "party";
  if (
    t.includes("スタッフ") ||
    t.includes("カメラ") ||
    t.includes("サポート")
  )
    return "staff";
  if (t.includes("会場") || t.includes("スタジオ") || t.includes("ハウス"))
    return "venue";
  if (t.includes("交通") || t.includes("ガソリン") || t.includes("電車"))
    return "transport";
  if (t.includes("宣伝") || t.includes("印刷") || t.includes("広告"))
    return "promo";
  if (t.includes("機材") || t.includes("楽器")) return "equipment";
  if (t.includes("録音") || t.includes("制作") || t.includes("MV")) return "production";
  return "other";
}

function parseAmount(raw: unknown): number {
  if (raw === undefined || raw === null) return 0;
  const t = String(raw).replace(/[¥,\s]/g, "");
  if (t === "" || t === "-") return 0;
  const n = Number(t);
  if (Number.isNaN(n)) return 0;
  return Math.abs(n); // 支出額は正の数で保存
}

function parseDate(raw: string | undefined, fallback?: string): string | null {
  if (!raw) return fallback ?? null;
  const firstLine = raw.split(/\r?\n/)[0]?.trim() ?? "";
  if (!firstLine) return fallback ?? null;
  let m = firstLine.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (m)
    return `${m[1]}-${m[2]!.padStart(2, "0")}-${m[3]!.padStart(2, "0")}`;
  m = firstLine.match(/^(\d{1,2})\/(\d{1,2})/);
  if (m)
    return `${DEFAULT_YEAR}-${m[1]!.padStart(2, "0")}-${m[2]!.padStart(2, "0")}`;
  return fallback ?? null;
}

function parseVenueName(raw: string | undefined): string | null {
  if (!raw) return null;
  const lines = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  if (lines.length < 2) return null;
  return lines.slice(1).join(" ");
}

async function main() {
  const text = readFileSync(csvPath, "utf-8");
  const rows: string[][] = parse(text, {
    skip_empty_lines: false,
    trim: false,
    relax_column_count: true,
  });

  // ヘッダ検出
  let dataStartRow = -1;
  for (let i = 0; i < Math.min(20, rows.length); i++) {
    const r = rows[i] ?? [];
    if (
      (r[2]?.trim() === "No." || r[10]?.trim() === "No.") &&
      (r[16]?.trim() === "No." || r[25]?.trim() === "品名")
    ) {
      dataStartRow = i + 1;
      break;
    }
  }
  if (dataStartRow < 0) {
    console.error("ヘッダ行が見つかりませんでした");
    process.exit(1);
  }

  // 既存expensesと重複しないかチェック (occurredOn + category + amount + memoでマッチ)
  const existingSnap = await db.collection("expenses").get();
  const existingKeys = new Set<string>();
  for (const d of existingSnap.docs) {
    const data = d.data();
    existingKeys.add(
      `${data.occurredOn}|${data.category}|${data.amount}|${data.memo ?? ""}`,
    );
  }

  let lastDate: string | null = null;
  let lastVenue: string | null = null;
  let created = 0;
  let skippedDup = 0;

  for (let i = dataStartRow; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const liveNo = r[2]?.trim();
    const liveDateRaw = r[3];
    const liveKind = r[4]?.trim();
    const liveDetail = r[5]?.trim() ?? "";
    const liveAmountRaw = r[6];

    if (!liveNo) continue;

    // 日付・会場は収入/支出に関係なくトラック (空欄行は前の値を継承)
    const date: string | null = parseDate(liveDateRaw, lastDate ?? undefined);
    const venue: string | null = parseVenueName(liveDateRaw) ?? lastVenue;
    if (liveDateRaw && parseDate(liveDateRaw)) {
      lastDate = date;
      lastVenue = venue;
    }

    if (liveKind !== "支出") continue;

    const amount = parseAmount(liveAmountRaw);
    if (amount <= 0) continue;

    const category = categorize(liveDetail);
    const memo = [venue, liveDetail].filter(Boolean).join(" / ") || null;

    const key = `${date ?? ""}|${category}|${amount}|${memo ?? ""}`;
    if (existingKeys.has(key)) {
      skippedDup++;
      console.log(`skip dup: ${date} ${category} ¥${amount} (${memo})`);
      continue;
    }

    await db.collection("expenses").add({
      occurredOn: date ?? `${DEFAULT_YEAR}-01-01`,
      category,
      amount,
      memo,
      createdBy: null,
      createdAt: Timestamp.now(),
    });
    console.log(`created: ${date} ${category} ¥${amount} (${memo})`);
    created++;
  }

  console.log(`---- summary ----`);
  console.log(`created: ${created}`);
  console.log(`skipped (already existed): ${skippedDup}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
