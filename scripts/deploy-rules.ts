/**
 * Firestore セキュリティルールを Firebase Rules REST API 経由で公開する。
 *
 * 実行:
 *   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json \
 *   FIREBASE_PROJECT_ID=wsb-admin-app \
 *   npx tsx scripts/deploy-rules.ts
 *
 * 参考: https://firebase.google.com/docs/reference/rules/rest
 */

import { readFileSync } from "node:fs";
import { GoogleAuth } from "google-auth-library";

const projectId = process.env.FIREBASE_PROJECT_ID;
const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!projectId || !credPath) {
  console.error(
    "Usage: GOOGLE_APPLICATION_CREDENTIALS=... FIREBASE_PROJECT_ID=... npx tsx scripts/deploy-rules.ts",
  );
  process.exit(1);
}

const rulesText = readFileSync("./firestore.rules", "utf-8");

const auth = new GoogleAuth({
  keyFile: credPath,
  scopes: [
    "https://www.googleapis.com/auth/firebase",
    "https://www.googleapis.com/auth/cloud-platform",
  ],
});

async function main() {
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token.token) throw new Error("failed to get access token");
  const headers = {
    Authorization: `Bearer ${token.token}`,
    "Content-Type": "application/json",
  };

  // 1) ruleset を作成
  const rulesetRes = await fetch(
    `https://firebaserules.googleapis.com/v1/projects/${projectId}/rulesets`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        source: {
          files: [{ name: "firestore.rules", content: rulesText }],
        },
      }),
    },
  );
  if (!rulesetRes.ok) {
    const body = await rulesetRes.text();
    throw new Error(`create ruleset failed: ${rulesetRes.status} ${body}`);
  }
  const ruleset = (await rulesetRes.json()) as { name: string };
  console.log("created ruleset:", ruleset.name);

  // 2) cloud.firestore release を更新 (PATCH)、無ければ POST で作成
  const releaseName = `projects/${projectId}/releases/cloud.firestore`;
  const patchRes = await fetch(
    `https://firebaserules.googleapis.com/v1/${releaseName}`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        release: { name: releaseName, rulesetName: ruleset.name },
      }),
    },
  );

  if (patchRes.ok) {
    console.log("updated release:", releaseName);
  } else if (patchRes.status === 404) {
    // 初回 release 作成
    const postRes = await fetch(
      `https://firebaserules.googleapis.com/v1/projects/${projectId}/releases`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: releaseName,
          rulesetName: ruleset.name,
        }),
      },
    );
    if (!postRes.ok) {
      const body = await postRes.text();
      throw new Error(`create release failed: ${postRes.status} ${body}`);
    }
    console.log("created release:", releaseName);
  } else {
    const body = await patchRes.text();
    throw new Error(`patch release failed: ${patchRes.status} ${body}`);
  }

  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
