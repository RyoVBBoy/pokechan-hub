# ポケチャン攻略Hub — 作業メモ（Claude 向けの引き継ぎ）

ポケモンチャンピオンズ（Pokémon Champions）の非公式攻略サイト＋交流機能。
将来は X（旧Twitter）規模の「複数ゲームの総合アプリ」を目指している。

## 依頼主について
- 日本の大学生。経営学の知識はあるが、プログラミングの経験はない。
- 説明は**日本語・専門用語を避けて**、手順は1つずつ、リンク付きで。画面の名前は日本語表示のものを使う（Firebase などは日本語UI）。
- パソコンは Windows（Chrome）。iPhone も使う。Mac は持っていない。
- ファイルの手作業アップロードは負担が大きい。**変更は Claude が GitHub に直接 push する**（main に push すると自動公開）。

## 仕組み
- `src/`：サイト本体。`src/js/` は `order.json` の順につなげて1本の JS にする（古典的な script。トップレベルの const は全ファイル共通の名前空間）。最後の `99-start.js` が `route()` を呼ぶので、新しいファイルは `99-start.js` より前に追加する。
- `src/styles.css`、`src/index.html`（`__JS__`/`__CSS__` を build で置換）。
- PiP（ピクチャ・イン・ピクチャ）：`19-pip.js`。カードを動画にして端末の PiP で浮かべる（ゲーム中もJSが止まっても動く）。`PIP.mode`＝'battle'（選出アシスト #/assist/pip）／'build'（育成画面 #/edit/N。ゲームの育成画面で見ながら入力する用、「この1匹／パーティ全員」）。画面の言い方は「小窓」ではなく「PiP」。
- 画像から取り込む（`18-import.js`）：名前が読めない・ニックネーム・フォルム違いのときは `imGuess` が、実数値が種族値と計算で合うか（最重要）・技を覚えるか・特性・メガストーン・名前の似かたで全ポケモンに点数をつけて予測する。ほかの候補はボタンで選び直せる。
- パーティは3つまで保存（`13-party.js` の `TEAMS`＝localStorage `pcteams`。いま選んでいるものが `team`、`switchTeam(i)` で切り替え、名前を付けられる。古い `pcteam` は1つ目に自動で移す）。
- ポケモンを選ぶ欄は長い一覧（select）にしない。`monField(属性,番号)`＋`pickMon()`（`11-matchup.js`）＝名前を打って絞り込む（ひらがな・英語OK、パーティ・最近選んだを上に）。
- PC表示：700px以上で下のタブ→左のメニュー（本文600px）、1280px以上で右に「よく使う機能」（`src/styles.css` の最後・`31-desktop.js`・`index.html` の `.pc-*`/`.pcside`）。スマホ（699px以下）の見た目は変えない。
- `config/public.json`：公開してよい設定（Firebase のウェブ用の値）。build でページの `window.PC_CONFIG` に入る。
- ゲームの追加：`27-games.js` の `GAMES` に1件足す（`tabs`＝下/左のメニュー、`tools()`＝ツール一覧〔id・sec・href・ic・t・s(短い名前)・d〕、`quick`＝初めての人向けの「すぐ使う」、`fab`＝右下ボタンの有無）。「コミュニティ」タブ（旧「みんな」）は全ゲーム共通で自動で付く。ツール画面・ホームの「すぐ使う」・PCの右の列・最近使った（`pcrecent`）・マイツール（☆、`pctools`）はゲームごとに自動で切りかわる。画面の中身（views）はゲームごとに新しいファイルで作り、`06-router.js` の表に足す。
- ことば（日本語・英語）：`00-i18n.js`（LANG＝端末の言語→利用者が選ぶと `pclang` に保存、`L('日本語','English')`）、`02-names.js`（ポケモン・技・特性・持ち物・性格・タイプの英語の正式名。`python3 tools/gen-names.py <PokeAPIのCSVフォルダ>` で作る。手で直さない）、`97-dict-en.js`（画面の文字の辞書 `EN` と、数字入りの文の置きかえ `EN_RE`）、`98-i18n.js`（英語のときだけ名前を入れかえ、画面に出た文字を辞書で置きかえる）。利用者が書いたもの（投稿・掲示板・名前）は `data-notr` を付けて訳さない。新しい画面を作ったら `tests/i18n.mjs` が訳し忘れを一覧にするので、辞書に足す。未翻訳：技・特性の説明文（MD・ABDS）、基本ルール・出典・利用規約などの長い文、サーバーのエラー文の一部。韓国語・中国語は `gen-names.py` の LANGS と辞書を足せば増やせる。テスト・検索向けページは `locale:'ja-JP'` で日本語に固定。
- タイムライン：サイトは `32-timeline.js`（#/tl・#/tl/following・#/u/ID・#/n/番号・#/notif）、サーバーは `worker/src/social.js`（/api/tl・/api/notes・/api/follow・/api/notifs・/api/u）。見るのはログイン不要、書くのはプロフィール作成済みの人だけ。140文字・15秒に1件・1日100件・リンク不可・ログインした人3人の通報で非表示。
- `worker/`：Cloudflare Worker（背面タップ連携・選出画面の読み取り・掲示板/対戦募集・ログイン確認・タイムライン）。`worker/build.py` がサイトの計算関数とデータを `src/js` から取り込んで `worker/dist/worker.js` を作る（計算はサイトと共通）。
- `tools/build.mjs`（サイト → `dist/`）、`tools/gen-pages.cjs`（検索向け静的ページ。Playwright 使用、`SITE_URL` 必須）。
- `tests/`：`node tests/run.mjs`（worker・auth・social＝タイムラインのサーバー・site 25画面＋PC表示・login＝ログイン〜投稿の画面の流れ・i18n＝英語表示・calc-ref＝@smogon/calc と乱数16段階を照合）。**テストに落ちると公開されない。**
- `.github/workflows/deploy.yml`：push → 組み立て → テスト → Cloudflare Pages（サイト）→ Cloudflare Workers（サーバー）。runs-on は `ubuntu-24.04` に固定（ubuntu-latest=26.04 は Playwright 非対応）。

### 手元で確かめる
```
npm install
npx playwright install chromium
node tools/build.mjs && python3 worker/build.py && SITE_URL=https://example.netlify.app node tools/gen-pages.cjs
node tests/run.mjs
```

## 公開先・設定
- サイト：Cloudflare Pages（プロジェクト `pokechan-hub`＝Variables の `PAGES_PROJECT` で変更可、アドレス `https://pokechan-hub.pages.dev`）。2026/10/29 に Netlify から移した（Netlify の無料枠は月20回ほどの公開で止まるため）。`SITE_URL` は GitHub の Variables。旧 Netlify のサイトは古い版のまま残っている。
- 公開は1回ごとに数分かかる。細かい修正は、まとめて push する。
- サーバー：Cloudflare Worker `pokechan-tap`（URL に学籍番号のようなサブドメイン `22311328rn` が入っている → 変更したい、未対応）。D1（binding `DB`）に threads/posts/lobby/reports/users、タイムライン用に notes/follows/likes/notifs/user_state（表は初回アクセスで自動作成）。
- 合言葉（APP_TOKEN・ADMIN_TOKEN・GEMINI_API_KEY 等）は **Cloudflare 側にだけ**置く。GitHub やチャットに書かない。ADMIN_TOKEN は APP_TOKEN と別・12文字以上。
- ログイン：Firebase Authentication（プロジェクト `pokechan-hub`）。Google・メールリンクを有効化済み。Apple は Apple Developer 登録後。サーバーは RS256 の IDトークンを Google の公開鍵で検証（`worker/src/auth.js`）。
- iPhone アプリは別リポジトリ `RyoVBBoy/pokechan-ios`（XcodeGen + GitHub Actions → TestFlight。Apple の承認待ち）。

## 守ること
- **公式の画像・アイコン・ロゴは使わない**（サイトの部品・アプリでの使用は Pokémon Champions の動画・静止画ガイドラインの範囲外）。自分で撮ったスクリーンショットは、非営利のうちは記事に使える（広告を入れたら外す）。
- **ゲーム内の文章を転載しない**。技・特性の説明は当サイトが書いた文章（`MD`・`ABDS`）。数値（威力など）は事実なので可。
- データ：Pokémon Showdown の champions mod（learnsets・moves・formats-data）を**実行せずに解析**して使用。ゲーム内で書き写した 510 技と照合済み（PP などが違う5技はゲーム内の値）。
- ダメージ計算は本編（SV）と同じ 4096 補正・五捨五超入。変更したら calc-ref テストで照合する。ボディプレスへの攻撃補正、メガソーラー＋ソーラービームの雨補正は Showdown 準拠（ゲームで未確認）。
- 依頼主の個人情報（メールアドレス等）を外部サービスに送らない。

## 次にやること（優先順）
（済）ログインの動作確認：Google アカウントで本番サイトからログインできることを依頼主が確認（2026/10/29）。
（済）フォロー・タイムライン・いいね・お知らせ（2026/10/29 公開）。今後：
   - 画像つき投稿（方針決定済み。notes.media 列を用意済み。保存先は Cloudflare R2 を想定、不適切画像の見回り方法も要検討）。
   - 返信・リポスト・検索、管理画面からのアカウント停止（users.banned は用意済み、操作画面なし）。
   - 利用者が増えたら「フォロー中」を読むとき集める方式 → 書くときに配る方式（受け取り箱）へ。
1. （上の続き）タイムラインの改良。
2. iPhone アプリからのログイン（WebView では Google ログイン不可 → ネイティブで）。
3. Worker の URL から学籍番号のようなサブドメインを外す（独自ドメイン or サブドメイン変更 → サイトの `COMM_API` を更新）。
4. お問い合わせ窓口（利用規約・プライバシーポリシーは下書き。公開前に専門家確認を推奨）。
5. 計算できない技：カウンター・ミラーコート・メタルバースト・一撃必殺・なげつける・ふくろだたき・はきだす。
6. eFootball など他ゲーム（ゲーム切り替えの土台は `27-games.js`）。

## コミット
- 作者は `Claude <noreply@anthropic.com>`。メッセージは日本語で何を変えたか。
