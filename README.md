# ポケチャン攻略Hub

ポケモンチャンピオンズの攻略サイト（図鑑・ダメージ計算・選出アシスト・対戦募集など）と、
選出画面を読み取って通知するサーバーのソース一式です。

GitHub の `main` に上げると、**組み立て → テスト → 公開** が自動で行われます。
テストに1つでも失敗したら公開されないので、壊れたものが出ることはありません。

---

## フォルダの中身

| 場所 | 中身 |
|---|---|
| `src/index.html` | ページの枠 |
| `src/styles.css` | 見た目 |
| `src/js/` | プログラム（`order.json` の順につなげて使う。`29-account.js`：アカウント、`30-legal.js`：利用規約など） |
| `config/public.json` | 公開してよい設定（Firebase のウェブ用の値） |
| `worker/src/` | サーバー（Cloudflare Worker）のプログラム |
| `tools/` | 組み立て用（`build.mjs`：サイト、`gen-pages.cjs`：検索向けページ） |
| `worker/build.py` | サーバーの組み立て（サイトの計算部分をそのまま取り込む） |
| `tests/` | 自動テスト（画面・ダメージ計算の照合・サーバー） |
| `.github/workflows/deploy.yml` | 自動公開の手順 |

サーバーの計算はサイトの計算をそのまま取り込むので、サイトを直せばサーバーも自動で同じになります。

---

## はじめの設定（1回だけ）

### 1. リポジトリを作ってファイルを入れる

1. GitHub で新しいリポジトリを作る（名前の例：`pokechan-hub`、Public でOK）。
2. 「uploading an existing file」から、このフォルダの中身を**まとめてドラッグ**して入れる。
3. **`.github` フォルダに注意**：Mac では名前が「.」で始まるフォルダは隠れています。
   Finder で `⌘ + Shift + .`（ピリオド）を押すと表示されるので、それも一緒にドラッグしてください。
   入らなかった場合は、GitHub で「Add file → Create new file」を開き、
   名前に `.github/workflows/deploy.yml` と入れて、中身を貼り付けます。

### 2. 合言葉（Secrets）と設定（Variables）を入れる

GitHub のリポジトリ → **Settings → Secrets and variables → Actions** を開きます。

**Secrets タブ（他人に見せない値）**

| 名前 | 取得する場所 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare → 右上のアイコン → My Profile → API Tokens → Create Token → テンプレート「**Edit Cloudflare Workers**」→ 権限に「Account / **D1** / Edit」を追加して作成（サイトの公開に「**Cloudflare Pages：編集**」、掲示板に「**D1：編集**」の権限も必要） |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare → Workers & Pages の画面右側にある **Account ID** |

**Variables タブ（見えても困らない値）**

| 名前 | 入れる値 |
|---|---|
| `SITE_URL` | サイトのアドレス（例：`https://pokechan-hub.pages.dev`。最後の `/` は不要） |
| `PAGES_PROJECT`（任意） | Cloudflare Pages のプロジェクト名（なければ `pokechan-hub`）。サイトのアドレスは `https://<この名前>.pages.dev` |
| `D1_DATABASE_ID` | Cloudflare → Storage & Databases → D1 → 掲示板のデータベース → **Database ID** |
| `D1_DATABASE_NAME` | 同じデータベースの名前 |
| `WORKER_NAME` | 今のサーバーの名前（`pokechan-tap` なら入れなくてよい） |

※ サーバーの合言葉（`APP_TOKEN`・`ADMIN_TOKEN`）や AI のキー（`GEMINI_API_KEY` など）は、
これまでどおり **Cloudflare 側にだけ** 置きます。GitHub には入れません。自動公開しても消えません。

### 3. 最初の公開

GitHub の **Actions** タブ → 「公開（テスト→サイト→サーバー）」→ **Run workflow**。
すべて緑のチェックになれば完了です（10分ほど）。

---

## ふだんの更新

変更されたファイルを GitHub にアップロード（同じ場所にドラッグ）するだけです。
自動でテストされ、合格したらサイトとサーバーが更新されます。
結果は Actions タブで見られます。赤い × のときは、どのテストで止まったかが表示されます。

## 手元で確かめる場合（パソコン）

```
npm install
npx playwright install chromium
SITE_URL=https://pokechan-hub.pages.dev npm run build
npm test
```

`dist/single.html` は1ファイルにまとめた版で、ダブルクリックでそのまま開けます。

---

## ログイン機能（Firebase Authentication）の設定

ログイン・プロフィールの仕組みは入っています。次の設定をすると使えるようになります（設定するまでは「準備中」と表示されます）。

1. https://console.firebase.google.com を開き、「プロジェクトを作成」（名前の例：`pokechan-hub`。Google アナリティクスはオフでOK）。
2. 左の「構築」→「Authentication」→「始める」。
3. 「Sign-in method」タブで、次の2つを有効にする。
   - **Google**：「有効にする」をオン → サポート用メールを選んで保存。
   - **メール / パスワード**：「有効にする」をオンにし、その下の「**メールリンク（パスワードなしでログイン）**」もオン → 保存。
4. 「設定」タブ →「承認済みドメイン」→「ドメインを追加」で、サイトのドメイン（例：`pokechan-hub.pages.dev`）を追加。
5. 左上の歯車 →「プロジェクトの設定」→「全般」→ 下の「マイアプリ」で **ウェブ（`</>`）** を押し、アプリ名（例：`pokechan-hub-web`）を入れて登録。
6. 表示された `firebaseConfig` の中の `apiKey`・`authDomain`・`projectId`・`appId` の4つを、
   このリポジトリの **`config/public.json`** の同じ名前の欄に貼る（GitHub の画面で鉛筆マークから編集できます）。
7. 保存すると自動で公開され、サイトの「コミュニティ」→「アカウント」からログインできるようになります。

※ `config/public.json` の値は、ブラウザに配られる公開の値です（合言葉ではありません）。
※ Apple でのログインは、Apple Developer Program に登録したあとで追加します（`"apple": true` にします）。
※ プロフィールを保存するデータベースの表（users）は、サーバーが自動で作ります。

---

非公式のファンサイトです。ポケモンおよび関連する名称は各権利者の商標です。
©Pokémon/Nintendo/Creatures/GAME FREAK
