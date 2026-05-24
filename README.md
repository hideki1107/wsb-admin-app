# WSB 物販・経理アプリ

WSBバンドの **収入（物販・ライブ収益等）・支出・在庫** をWeb上で一元管理するためのツール。
複数メンバーがリアルタイムで共有でき、PWAでスマホのホーム画面からアプリのように起動できます。

- **本番**: https://wsb-admin-app.vercel.app
- **リポジトリ**: https://github.com/hideki1107/wsb-admin-app

---

## できること

### 💰 収入管理
- **6カテゴリ**: 会場物販 🎤 / 通販 📦 / ライブ利益 🎸 / 音源収入 🎵 / 広告収入 📣 / 入金 💴
- **会場物販**: 1商品/数量/金額で記録、登録時に在庫を自動減算
- **通販**: **複数商品** を1注文にまとめて登録（合計金額入力、items[] 配列で保持）
- **入金**: メンバーがバンドにお金を入れる際に使う
- 既存記録の編集・削除（削除時は在庫が自動復元される）

### 💸 支出管理
- **8カテゴリ**: 制作費 🎬 / スタッフ 👥 / 会場費 🏛️ / スタジオ代 🎙️ / 通販送料 🚚 / 宣伝 📣 / 打ち上げ 🍻 / その他 📝
- 編集・削除可

### 📦 在庫管理
- 商品マスタ（**絵文字アイコン + カラー** をカスタマイズ可能）
- バリエーション対応（サイズ × 色）
- 各SKUごとの残数を大きな色つきカード表示（残数で赤/橙/緑）
- **入荷/棚卸補正**: 個別variantに対して在庫増減を記録
- **商品の編集・削除**: 名前/カテゴリ/アイコン/色/値段/各variant在庫を変更可
- **新規商品登録 (`/stock-in`)**: 絵文字パレット・色パレットから選んで簡単登録

### 📊 ダッシュボード
- **現在のバンド資金**（累計収入 − 累計支出）を最大表示
- **表示期間フィルタ**: 全期間 / 年 / **複数月選択（チェックボックス）**
- カテゴリ別収入・カテゴリ別支出のカード（クリックで対象一覧へ遷移、フィルタも引き継ぎ）
- **月毎の収支テーブル**（モバイルではカード表示に自動切替）
- **在庫アラート**: 残数5以下のSKUを表示（残0は除外）

### 一覧画面（収入 / 支出）
- カテゴリ絞り込み（プルダウン）
- **表示期間絞り込み**（年 + 複数月チェックボックス、URL同期 `?year=2026&months=5,6&category=venue`）
- ダッシュボードからのカードクリックで全条件が引き継がれる

### 🔐 認証
- Google サインイン（Firebase Auth）
- 現状は「ログイン済みなら全データ読み書き可」（バンドメンバー数人の運用想定）

### 📱 PWA（iOSアプリ風）
- Safari で開いて **「ホーム画面に追加」** すれば、アイコンタップで全画面起動
- WSBロゴアイコン、紫グラデのテーマカラー
- ノッチ・ホームバー対応

### ⚡ その他の工夫
- レスポンシブ対応（モバイルではハンバーガーメニュー、デスクトップはタブ）
- Firestore は long-polling 強制でアプリ内ブラウザ/モバイル回線でも安定動作
- Vercel への `git push` で自動デプロイ

---

## 技術スタック

| レイヤ | 技術 |
| --- | --- |
| フロント | Next.js 16 (App Router, Turbopack) + React 19 + TypeScript |
| スタイル | Tailwind CSS v4 |
| DB / 認証 | Firebase Firestore + Firebase Auth (Google) |
| ホスティング | Vercel（GitHub 連動・自動デプロイ） |
| 移行/管理スクリプト | tsx + firebase-admin |
| PWA | manifest.json + iOS 用 metaタグ + sharp で画像生成 |

---

## セットアップ（新しい環境で構築する場合）

### 1. リポジトリと依存

```bash
git clone https://github.com/hideki1107/wsb-admin-app.git
cd wsb-admin-app
npm install
```

### 2. Firebase プロジェクト

1. [Firebase Console](https://console.firebase.google.com/) で新規プロジェクト作成
2. **Authentication** → サインイン方法 → **Google** を有効化
3. **Firestore Database** → **本番モード** で作成（リージョン `asia-northeast1` 推奨）
4. **プロジェクト設定** → アプリ追加 → **Web (</>)** で `firebaseConfig` を控える

### 3. Web 用環境変数

```bash
cp .env.local.example .env.local
```

`.env.local` に以下を貼り付け：

```
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=xxx.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=xxx
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=xxx.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1234567890
NEXT_PUBLIC_FIREBASE_APP_ID=1:1234567890:web:abc
```

### 4. サービスアカウントキー（管理スクリプト用）

1. Firebase Console → **プロジェクト設定** → **サービスアカウント** タブ
2. **新しい秘密鍵の生成** → JSON ダウンロード
3. プロジェクトルートに `serviceAccount.json` として保存（gitignore 済み）

### 5. Firestore ルールと許可ドメインを反映

```bash
# セキュリティルールを Firestore に反映
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json \
FIREBASE_PROJECT_ID=<your-project-id> \
npx tsx scripts/deploy-rules.ts

# Vercel ドメインを Firebase Auth の許可ドメインに追加
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json \
FIREBASE_PROJECT_ID=<your-project-id> \
npx tsx scripts/add-auth-domains.ts your-vercel-domain.vercel.app
```

### 6. 商品マスタを初期投入

```bash
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json \
FIREBASE_PROJECT_ID=<your-project-id> \
npx tsx scripts/seed-products.ts
```

### 7. 開発サーバ起動

```bash
npm run dev
# → http://localhost:3000
```

### 8. Vercel デプロイ

```bash
npx vercel link --yes
# 環境変数6つを production/preview/development に登録 (.env.local の内容)
npx vercel --prod
```

または GitHub 連携で `git push` で自動デプロイ。

---

## データモデル (Firestore)

```
products/{productId}
  ├ name        string
  ├ category    "music" | "apparel" | "accessory" | "other"
  ├ basePrice   number   // 円
  ├ isActive    boolean
  ├ iconEmoji   string | null   // カスタム絵文字 (例: "🎸")
  ├ colorKey    string | null   // テーマ色 (violet/fuchsia/.../slate)
  ├ memo        string | null
  └ variants/{variantId}
      ├ size    string  // "L" / "XL" / "-"
      ├ color   string  // "Black" / "White" / "-"
      └ stock   number

sales/{saleId}
  ├ occurredOn  "YYYY-MM-DD"
  ├ channel     "venue" | "online" | "live" | "music" | "ad" | "deposit"
  ├ productId   string | null   // 単一商品時のみ (会場物販等)
  ├ variantId   string | null
  ├ quantity    number
  ├ items       SaleItem[] | null  // 通販で複数商品時に使用
  ├ amount      number             // 取引の合計金額 (円)
  ├ memo        string | null
  └ createdAt   Timestamp

expenses/{expenseId}
  ├ occurredOn  "YYYY-MM-DD"
  ├ category    "production" | "staff" | "venue" | "studio" |
  │             "shipping" | "promo" | "party" | "other"
  ├ amount      number   // 正の値で保存
  ├ memo        string | null
  └ createdAt   Timestamp

stockMovements/{movementId}
  ├ productId   string
  ├ variantId   string
  ├ delta       number          // 正=入荷, 負=補正で減
  ├ reason      "restock" | "adjust" | "other"
  └ occurredOn  "YYYY-MM-DD"
```

### トランザクションで原子的に処理しているもの

- **物販売上の登録 / 編集 / 削除**: sales doc 操作 + 対象 variant の在庫増減を1 transaction
- **通販で複数商品オーダー**: sales doc 1件 + 全variantの在庫減算を集約して1 transaction
- **新規商品登録**: product + 各variant + 初期入荷の stock_movement を一括
- **在庫の入荷/棚卸補正**: stock_movement 追加 + variant.stock 更新

---

## ページ構成

| パス | 内容 |
| --- | --- |
| `/` | ダッシュボード（バンド資金/期間フィルタ/月毎収支/在庫アラート） |
| `/inventory` | 在庫一覧（商品ごとに variant の残数表示、編集/削除、入荷/補正） |
| `/sales` | 収入入力フォーム |
| `/sales/list` | 収入一覧（年・月・カテゴリで絞り込み、編集/削除） |
| `/expenses` | 支出入力フォーム |
| `/expenses/list` | 支出一覧（年・月・カテゴリで絞り込み、編集/削除） |
| `/stock-in` | 新規商品登録（絵文字+色+カテゴリ+価格+初期在庫） |

---

## スクリプト一覧

`scripts/` 配下、すべて `tsx` で実行。共通の環境変数：

```bash
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json FIREBASE_PROJECT_ID=<id>
```

| スクリプト | 用途 |
| --- | --- |
| `seed-products.ts` | w-s-b.jp/goods の6商品を初期投入 |
| `deploy-rules.ts` | `firestore.rules` を Firebase に反映 |
| `add-auth-domains.ts <domain>` | Firebase Auth の許可ドメイン追加 |
| `generate-icons.mjs` | `public/icon-source.png` から PWA 各サイズ生成 |
| `import-sales.ts <csv>` | 汎用 CSV → sales 移行（テンプレ） |
| `import-wsb-sheet.ts <csv>` | WSB スプレッドシート専用の売上+在庫スナップショット投入 |
| `import-wsb-expenses.ts <csv>` | WSB スプレッドシートの支出セクション投入 |
| `clear-expenses.ts` | expenses コレクションを全削除（再投入用） |
| `check-expense-categories.ts` | 既存 expenses のカテゴリ集計（旧値が残っていないか確認） |

---

## アイコンを差し替えたい

1. 新しいアイコン画像（推奨 512x512 PNG）を `public/icon-source.png` として保存
2. `node scripts/generate-icons.mjs` を実行 → 180/192/512/favicon すべて再生成
3. `git push` で本番反映
4. （iOS 既存ホーム画面のアイコンを更新したい場合）一旦ホーム画面から削除して再追加

---

## 今後のロードマップ

- [ ] メンバー承認制 (現状は Google ログインだけで全データアクセス可)
- [ ] 月次/年次レポート CSV エクスポート
- [ ] 通販オーダーの items[] 編集対応（現状は date/amount/memo のみ）
- [ ] 売上トレンドのグラフ表示
- [ ] 在庫切れ時の Push 通知
- [ ] ネイティブ iOS アプリ化（Capacitor or Expo）

---

## ライセンス

WSB 内部利用ツール。リポジトリは public ですが、Firebase / Vercel 設定はオーナー個人のもの。
