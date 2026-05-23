/**
 * Firebase Authentication の Authorized Domains に新しいドメインを追加する
 *
 * 実行:
 *   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json \
 *   FIREBASE_PROJECT_ID=wsb-admin-app \
 *   npx tsx scripts/add-auth-domains.ts wsb-admin-app.vercel.app other-domain.com
 */

import { GoogleAuth } from "google-auth-library";

const projectId = process.env.FIREBASE_PROJECT_ID;
const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const domainsToAdd = process.argv.slice(2);

if (!projectId || !credPath || domainsToAdd.length === 0) {
  console.error(
    "Usage: GOOGLE_APPLICATION_CREDENTIALS=... FIREBASE_PROJECT_ID=... npx tsx scripts/add-auth-domains.ts <domain1> [domain2 ...]",
  );
  process.exit(1);
}

const auth = new GoogleAuth({
  keyFile: credPath,
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});

async function main() {
  const client = await auth.getClient();
  const tokenObj = await client.getAccessToken();
  const token = tokenObj.token;
  if (!token) throw new Error("failed to get access token");
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  // 現在の設定を取得
  const getRes = await fetch(
    `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config`,
    { headers },
  );
  if (!getRes.ok) {
    const body = await getRes.text();
    throw new Error(`get config failed: ${getRes.status} ${body}`);
  }
  const config = (await getRes.json()) as { authorizedDomains?: string[] };
  const current = config.authorizedDomains ?? [];
  console.log("current authorized domains:");
  for (const d of current) console.log("  - " + d);

  const merged = Array.from(new Set([...current, ...domainsToAdd]));
  const added = merged.filter((d) => !current.includes(d));

  if (added.length === 0) {
    console.log("nothing to add (all domains already authorized)");
    return;
  }

  console.log("adding:");
  for (const d of added) console.log("  + " + d);

  const patchRes = await fetch(
    `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config?updateMask=authorizedDomains`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({ authorizedDomains: merged }),
    },
  );
  if (!patchRes.ok) {
    const body = await patchRes.text();
    throw new Error(`patch config failed: ${patchRes.status} ${body}`);
  }

  const updated = (await patchRes.json()) as { authorizedDomains?: string[] };
  console.log("\nupdated. new authorized domains:");
  for (const d of updated.authorizedDomains ?? []) console.log("  - " + d);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
