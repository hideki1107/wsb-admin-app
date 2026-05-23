# WSB 物販・経理アプリ

WSBの会場物販・通販・ライブ利益・音源収入・広告収入を記録し、在庫残数とバンド資金を一目で把握するための社内ツール。

将来的にiPhoneアプリ化を予定しているため、データレイヤーは **Firebase Firestore** を使用しています（Web/iOS両対応のため）。

---

## 技術スタック

| レイヤ | 技術 |
| --- | --- |
| フロント | Next.js 16 (App Router) + React 19 + TypeScript |
| スタイル | Tailwind CSS v4 |
| DB / 認証 | Firebase Firestore + Firebase Auth (Google) |
| ホスティング | Vercel 想定 |
| 移行スクリプト | tsx + firebase-admin |

---

## 1. Firebase プロジェクトの作成

1. [Firebase Console](https://console.firebase.google.com/) で新規プロジェクトを作成
   - プロジェクト名: 例 `wsb-merch`
2. **Authentication** → サインイン方法 → **Google** を有効化
3. **Firestore Database** → データベースを作成 → 本番モードで開始 (リージョンは `asia-northeast1` 推奨)
4. **プロジェクト設定** → アプリを追加 → **Web (</>)** を選択
   - アプリのニックネーム: 例 `wsb-merch-web`
   - 表示される `firebaseConfig` を控える
5. **Authentication** → Settings → Authorized domains に Vercel のドメインを追加（デプロイ後）

---

## 2. ローカル環境変数

`.env.local.example` を `.env.local` にコピーし、上で控えた値を貼り付ける:

```bash
cp .env.local.example .env.local
```

```
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=wsb-merch.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=wsb-merch
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=wsb-merch.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1234567890
NEXT_PUBLIC_FIREBASE_APP_ID=1:1234567890:web:abc
```

---

## 3. Firestore セキュリティルールの適用

`firestore.rules` を Firebase Console の **Firestore Database → ルール** タブに貼り付けて公開。

> MVP では「認証済みユーザーは全データ読み書き可能」の方針。バンドメンバー以外がログインできないよう、Firebase Console の **Authentication → Users** で許可するメールアドレスだけを残すか、ルール内のメールホワイトリストを有効化すること。

---

## 4. 開発サーバ起動

```bash
npm install
npm run dev
```

http://localhost:3000 を開いて Google アカウントでログイン。

---

## 5. 商品マスタの初期投入

w-s-b.jp/goods にある6商品（CD / TEE Black L,XL / TEE White L,XL / TOWEL / PINS / Sticker / Lighter）を一括投入するスクリプト。

### サービスアカウントキーの取得

1. Firebase Console → **プロジェクト設定** → **サービスアカウント** タブ
2. **新しい秘密鍵を生成** → JSONをダウンロード
3. プロジェクトルートに `serviceAccount.json` として保存 (※ gitignore済み)

### 実行

```bash
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json \
FIREBASE_PROJECT_ID=wsb-merch \
npx tsx scripts/seed-products.ts
```

---

## 6. スプレッドシートからの売上データ移行

既存スプレッドシートを CSV エクスポートし `~/Desktop/sales.csv` などに保存。

CSV 列名 (順不同、一部欠落OK):

| 列 | 内容 | 例 |
| --- | --- | --- |
| date | 日付 | 2026-04-13 / 2026/4/13 |
| channel | チャネル | 会場物販 / 通販 / ライブ / 音源 / 広告 |
| product | 商品名 (物販のみ) | ORIGINAL LOGO TEE |
| size | サイズ (物販のみ) | L / XL / - |
| color | 色 (物販のみ) | Black / White / - |
| quantity | 数量 | 2 |
| amount | 金額(円) | 6000 |
| memo | メモ | 渋谷WWW |

### 実行

```bash
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json \
FIREBASE_PROJECT_ID=wsb-merch \
npx tsx scripts/import-sales.ts ~/Desktop/sales.csv
```

実際のスプレッドシートの列名が分かった段階で `scripts/import-sales.ts` のヘッダ対応を調整してください。

---

## 7. Vercel デプロイ

```bash
npx vercel
```

プロジェクト作成後、Vercel ダッシュボードで **Settings → Environment Variables** に `.env.local` と同じ6つの環境変数を登録。

`Authentication → Authorized domains` に Vercel ドメインを追加することを忘れずに。

---

## データモデル (Firestore)

```
products/{productId}
  ├ name        string
  ├ category    "music" | "apparel" | "accessory" | "other"
  ├ basePrice   number   // 円
  ├ isActive    boolean
  └ variants/{variantId}
      ├ size      string  // "L" / "XL" / "-"
      ├ color     string  // "Black" / "White" / "-"
      └ stock     number

sales/{saleId}
  ├ occurredOn  "YYYY-MM-DD"
  ├ channel     "venue" | "online" | "live" | "music" | "ad"
  ├ productId   string | null   // 物販以外はnull
  ├ variantId   string | null
  ├ quantity    number
  ├ amount      number          // 円 合計
  ├ memo        string | null
  └ createdAt   Timestamp

stockMovements/{movementId}
  ├ productId   string
  ├ variantId   string
  ├ delta       number          // 正=入荷, 負=補正で減
  ├ reason      "restock" | "adjust" | "other"
  └ occurredOn  "YYYY-MM-DD"
```

- **売上時の在庫減算**: クライアント側 transaction で `sales` 追加と `variants.stock` 減算を1トランザクションで実行
- **入荷/補正**: `stockMovements` 追加と `variants.stock` 加減を1トランザクションで実行

---

## 今後のロードマップ

- [ ] iOS 化 (Expo or SwiftUI + Firebase iOS SDK)
- [ ] 月次レポート / CSV エクスポート
- [ ] 期間フィルタ
- [ ] 売上削除/編集
- [ ] 在庫切れ通知 (Push)
