# 寮費・食費清算管理システム

Google Apps Script（GAS）を API サーバー兼データベースとして使い、フロントエンドを Vercel にデプロイする「寮費・食費清算管理システム」です。

- **フロントエンド**: React (Vite) + Tailwind CSS
- **バックエンド / DB**: Google Apps Script (Web Apps) + Google スプレッドシート
- **PDF 出力**: フロント側で `html2canvas` + `jsPDF` により生成・ダウンロード

> GAS を接続していなくても、40 名分のダミーデータで全機能がそのまま動作します。

---

## 画面構成

上部で対象の「年・月」をグローバルに選択し、タブで 4 画面を切り替えます。

| タブ | 画面 | 内容 |
| ---- | ---- | ---- |
| 寮生マスター | 画面A | 40 名規模のメンバー一覧。追加・編集・削除・在籍/退寮の切替。ランク・グループはセレクトボックス。|
| 食数管理 | 画面B | 日付選択（デフォルト今日）で朝食/夕食の喫食を 40 名グリッド表示。グループ・ランクでフィルタ、一括保存。|
| 月次経費 | 画面C | 大会費・合宿費・治療費・配達代をメンバー 1 行でスプレッドシート風に入力。治療費差額を自動プレビュー、合宿単価はプリセット（2700/0/カスタム）。|
| 清算・PDF出力 | 画面D | 最終清算データ一覧と集金用 PDF 出力。集金グループごとに改ページした A4 PDF をダウンロード。|

### 清算計算ロジック

```
合計請求額 = 部費(一律 base_club_fee)
           + 大会費 × (1 − 補助率/100)
           + 合宿単価 × 泊数
           + (治療費実費 − 治療費補助金)   ※0円未満は0円
           − モチベーション費補助(回数 × 770円)
           + 配達代
           + 食費(朝食数 × 朝食単価 + 夕食数 × 夕食単価)
```

---

## セットアップ（フロントエンド）

```bash
# 依存インストール
npm install

# 環境変数を用意
cp .env.example .env
# .env の VITE_GAS_API_URL に GAS の Web App URL を設定
# （未設定 / VITE_USE_DUMMY_DATA=true の場合はダミーデータで動作）

# 開発サーバー
npm run dev

# 本番ビルド
npm run build

# ビルド結果のプレビュー
npm run preview
```

### 環境変数

| 変数 | 説明 |
| ---- | ---- |
| `VITE_GAS_API_URL` | GAS Web App のデプロイ URL（`/exec` で終わる）。|
| `VITE_USE_DUMMY_DATA` | `true` で GAS を呼ばずダミーデータのみ使用。|

---

## Vercel へのデプロイ

1. 本リポジトリを Vercel にインポート（Framework Preset は自動で **Vite** を検出）。
2. **Settings > Environment Variables** に `VITE_GAS_API_URL` を登録。
3. デプロイ。`vercel.json` で SPA フォールバック（rewrites）を設定済みです。

---

## バックエンド（GAS）のセットアップ

`gas/Code.js` にスプレッドシート構造に対応した API を実装しています。

1. Google スプレッドシートを新規作成し、**拡張機能 > Apps Script** を開く。
2. `gas/Code.js` の内容を `Code.gs` に貼り付けて保存。
3. エディタで一度 **`setupSheets`** を実行し、各シートを自動生成（初回のみ）。
   - `members` / `meal_logs` / `monthly_expenses` / `config` の 4 シートが作られ、`config` にはデフォルト単価が投入されます。
   - **シートが作られない場合**：スクリプトがスプレッドシートに紐付いていません（[script.google.com](https://script.google.com) から単独で作成した等）。スプレッドシートの「拡張機能 > Apps Script」から開き直すか、`Code.js` 冒頭の `SPREADSHEET_ID` に対象シートの ID（URL の `/d/【ID】/edit` 部分）を設定してください。
4. **デプロイ > 新しいデプロイ > 種類: ウェブアプリ**
   - 次のユーザーとして実行: **自分**
   - アクセスできるユーザー: **全員**
5. 発行された `/exec` で終わる URL を、フロントの `VITE_GAS_API_URL` に設定。

### ログイン管理（認証）

情報漏洩を防ぐため、**登録済みの「メールアドレス + PIN」を持つ人だけ**がシステムにアクセスできます。PIN は平文では保存せず、ユーザーごとのソルトとサーバー側のみが知るペッパーを混ぜた SHA-256 ハッシュのみを `users` シートに保存します。

1. `setupSheets` 実行時に `users`（アカウント一覧）と `sessions`（ログイン中のセッション）シートが自動作成されます。
2. **最初の管理者アカウントを作成**（GASエディタから手動で1回だけ実行）
   - `gas/Code.js` 内の `createInitialAdmin_RUN_ME` 関数を開き、名前・メールアドレス・PIN（4〜8桁の数字）を書き換える
     ```js
     function createInitialAdmin_RUN_ME() {
       createInitialAdmin('あなたの名前', 'you@example.com', '123456');
     }
     ```
   - 関数選択を `createInitialAdmin_RUN_ME` にして実行（初回は権限の許可が必要）
   - 実行後、この関数の中身は削除して構いません（PINは実行時にハッシュ化されて保存されるため、コードにPINを残さないため）
3. フロントのログイン画面で、上記のメールアドレス・PINでログイン
4. ログイン後、**「アカウント管理」タブ**から他のメンバーを追加し、追加した相手の「PIN設定」で初期PINを発行して伝える

セキュリティ面の補足:
- ログイン失敗が続くと、そのメールアドレスは一定時間ロックされます（総当たり対策）。
- セッション（ログイン状態）は30日で自動的に失効します。再ログインが必要です。
- アカウントを「無効」にすると、そのアカウントは次のアクセスから即座にログインできなくなります。

### API（`action` パラメータで振り分け）

| action | メソッド | 内容 |
| ------ | -------- | ---- |
| `login` | POST | メールアドレス + PIN でログインし、セッショントークンを発行。|
| `logout` | POST | ログアウト（セッション破棄）。|
| `whoami` | GET | セッショントークンを検証し、現在のユーザー情報を取得。|
| `getAccounts` | GET | ログイン可能な人の一覧を取得（PINは含まない）。|
| `saveAccounts` | POST | ログイン可能な人の一覧を更新（全置換、PINは維持）。|
| `setAccountPin` | POST | 指定メールアドレスのPINを新規設定・再設定。|
| `getInitialData` | GET | マスタ・設定・指定年月の食費/経費を一括取得。|
| `saveMembers` | POST | メンバーマスタの更新（全置換）。|
| `saveMealLogs` | POST | 食数データの一括保存（UPSERT）。|
| `saveExpenses` | POST | 月次経費データの一括保存（UPSERT）。|

`login` 以外の全 action は有効なセッショントークン（`token` パラメータ）が必須です。未ログイン・期限切れの場合は `code: "auth_required"` のエラーが返り、フロントは自動的にログイン画面へ戻ります。

- CORS プリフライトを避けるため、POST は `Content-Type: text/plain` で JSON を送信し、GAS 側で `JSON.parse` します。レスポンスは `ContentService` の JSON。
- 高速化のため、書き込みは `setValues` による一括処理を徹底しています。

### スプレッドシート設計

| シート | 列 |
| ------ | -- |
| `members` | `id`, `name`, `rank`, `group`, `active` |
| `meal_logs` | `date` (YYYY-MM-DD), `member_id`, `breakfast`, `dinner` |
| `monthly_expenses` | `year_month` (YYYY-MM), `member_id`, `tournament_fee`, `tournament_support_rate`, `camp_fee_per_night`, `camp_nights`, `medical_actual`, `medical_subsidy`, `sagawa_fee`, `wear_fee`（廃止済み・アプリからは未使用。既存シートとの互換のため列だけ残存）|
| `config` | `key`, `value`（例: `breakfast_price`=400, `dinner_price`=600, `base_club_fee`=3000）|
| `users` | `id`, `name`, `email`, `pin_hash`, `pin_salt`, `active`, `created_at`（PINはハッシュのみ保存）|
| `sessions` | `token`, `user_id`, `email`, `created_at`, `expires_at` |

---

## ディレクトリ構成

```
.
├── gas/
│   └── Code.js               # GAS バックエンド（Web Apps API）
├── public/
│   └── favicon.svg
├── src/
│   ├── components/
│   │   ├── ui/index.jsx      # shadcn 風 UI コンポーネント
│   │   ├── CollectionSheet.jsx  # 集金用 A4 シート（PDF 1 ページ）
│   │   ├── MonthSelector.jsx
│   │   └── Toast.jsx
│   ├── context/
│   │   └── AppContext.jsx    # グローバル状態（年月・データ・保存）
│   ├── lib/
│   │   ├── api.js            # GAS API クライアント（ダミーfallback付）
│   │   ├── calc.js           # 清算計算ロジック
│   │   ├── constants.js
│   │   ├── dummyData.js      # 40 名分ダミーデータ生成
│   │   ├── pdf.js            # html2canvas + jsPDF による PDF 生成
│   │   └── utils.js
│   ├── screens/
│   │   ├── MembersScreen.jsx     # 画面A
│   │   ├── MealLogsScreen.jsx    # 画面B
│   │   ├── ExpensesScreen.jsx    # 画面C
│   │   └── SettlementScreen.jsx  # 画面D
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── .env.example
├── vercel.json
└── vite.config.js
```
