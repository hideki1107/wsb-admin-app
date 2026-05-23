// 既存の expenses コレクションを全削除する (再投入用)
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
  console.log("deleting", snap.size);
  for (const d of snap.docs) await d.ref.delete();
  console.log("done");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
