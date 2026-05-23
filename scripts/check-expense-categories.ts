// 既存の expenses で旧カテゴリ(transport/equipment)が残っていないかチェック
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";

async function main() {
  const sa = JSON.parse(
    readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS!, "utf-8"),
  );
  if (!getApps().length)
    initializeApp({
      credential: cert(sa),
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
  const db = getFirestore();
  const snap = await db.collection("expenses").get();
  const counts = new Map<string, number>();
  const olds: Array<{ id: string; category: string; memo?: string }> = [];
  for (const d of snap.docs) {
    const data = d.data();
    counts.set(data.category, (counts.get(data.category) ?? 0) + 1);
    if (data.category === "transport" || data.category === "equipment") {
      olds.push({ id: d.id, category: data.category, memo: data.memo });
    }
  }
  console.log("category counts:");
  for (const [k, v] of counts.entries()) console.log(`  ${k}: ${v}`);
  if (olds.length) {
    console.log("\n旧カテゴリのレコード:");
    for (const o of olds) console.log("  ", o);
  } else {
    console.log("\n旧カテゴリのレコードなし ✓");
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
