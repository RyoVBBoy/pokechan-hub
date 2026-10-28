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
| `src/js/` | プログラム（`00-start.js`〜`28-moves.js`。`order.json` の順につなげて使う） |
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
| `NETLIFY_AUTH_TOKEN` | Netlify → 右上のアイコン → User settings → Applications → Personal access tokens → New access token |
| `NETLIFY_SITE_ID` | Netlify → 対象サイト → Site configuration → Site details → **Site ID** |
| `CLOUDFLARE_API_TOKEN` | Cloudflare → 右上のアイコン → My Profile → API Tokens → Create Token → テンプレート「**Edit Cloudflare Workers**」→ 権限に「Account / **D1** / Edit」を追加して作成 |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare → Workers & Pages の画面右側にある **Account ID** |

**Variables タブ（見えても困らない値）**

| 名前 | 入れる値 |
|---|---|
| `SITE_URL` | サイトのアドレス（例：`https://xxxx.netlify.app`。最後の `/` は不要） |
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
SITE_URL=https://xxxx.netlify.app npm run build
npm test
```

`dist/single.html` は1ファイルにまとめた版で、ダブルクリックでそのまま開けます。

---

非公式のファンサイトです。ポケモンおよび関連する名称は各権利者の商標です。
©Pokémon/Nintendo/Creatures/GAME FREAK
