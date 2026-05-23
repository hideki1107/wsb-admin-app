/**
 * PWA アイコン生成スクリプト
 *
 * public/icon-source.{png,svg,jpg} を読み込んで、
 * 各サイズの PNG を public/ に出力する。
 *
 * 実行:
 *   node scripts/generate-icons.mjs
 *
 * アイコンを差し替えたいときは public/icon-source.png を上書きして再実行。
 */

import sharp from "sharp";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const PUBLIC_DIR = resolve("public");
const CANDIDATES = [
  "icon-source.png",
  "icon-source.jpg",
  "icon-source.jpeg",
  "icon-source.svg",
];

let source = null;
for (const name of CANDIDATES) {
  const p = resolve(PUBLIC_DIR, name);
  if (existsSync(p)) {
    source = p;
    break;
  }
}

if (!source) {
  console.error(
    `ソース画像が見つかりません。以下のいずれかを public/ に置いてください:\n  ${CANDIDATES.join("\n  ")}`,
  );
  process.exit(1);
}

console.log(`source: ${source}`);

// 出力するサイズ
const sizes = [
  { name: "icon-180.png", size: 180 }, // apple-touch-icon
  { name: "icon-192.png", size: 192 }, // web manifest
  { name: "icon-512.png", size: 512 }, // web manifest
];

// maskable (Android用、円型クロップ前提なので余白を入れる) は今回 iOS 向けなのでスキップ可
// 後で必要になったら追加

for (const { name, size } of sizes) {
  const out = resolve(PUBLIC_DIR, name);
  await sharp(source).resize(size, size, { fit: "cover" }).png().toFile(out);
  console.log(`  ✓ ${name} (${size}x${size})`);
}

// favicon.ico も更新 (32x32 PNG として)
const favOut = resolve(PUBLIC_DIR, "favicon.png");
await sharp(source).resize(32, 32, { fit: "cover" }).png().toFile(favOut);
console.log(`  ✓ favicon.png (32x32)`);

console.log("done");
