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
- PC表示：700px以上で下のタブ→左のメニュー（本文600px）、1280px以上で右に「よく使う機能」（`src/styles.css` の最後・`31-desktop.js`・`index.html` の `.pc-*`/`.pcside`）。スマホ（699px以下）の見た目は変えない。
- `config/public.json`：公開してよい設定（Firebase のウェブ用の値）。build でページの `window.PC_CONFIG` に入る。
- `worker/`：Cloudflare Worker（背面タップ連携・選出画面の読み取り・掲示板/対戦募集・ログイン確認）。`worker/build.py` がサイトの計算関数とデータを `src/js` から取り込んで `worker/dist/worker.js` を作る（計算はサイトと共通）。
- `tools/build.mjs`（サイト → `dist/`）、`tools/gen-pages.cjs`（検索向け静的ページ。Playwright 使用、`SITE_URL` 必須）。
- `tests/`：`node tests/run.mjs`（worker・auth・site 22画面・login＝ログイン画面の流れ・calc-ref＝@smogon/calc と乱数16段階を照合）。**テストに落ちると公開されない。**
- `.github/workflows/deploy.yml`：push → 組み立て → テスト → Netlify（サイト）→ Cloudflare Workers（サーバー）。runs-on は `ubuntu-24.04` に固定（ubuntu-latest=26.04 は Playwright 非対応）。

### 手元で確かめる
```
npm install
npx playwright install chromium
node tools/build.mjs && python3 worker/build.py && SITE_URL=https://example.netlify.app node tools/gen-pages.cjs
node tests/run.mjs
```

## 公開先・設定
- サイト：Netlify（自動公開。`SITE_URL` は GitHub の Variables）。
- サーバー：Cloudflare Worker `pokechan-tap`（URL に学籍番号のようなサブドメイン `22311328rn` が入っている → 変更したい、未対応）。D1（binding `DB`）に threads/posts/lobby/reports/users。
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
1. ログインの動作確認（サイト →「みんな」→「アカウント」）。
2. フォロー・タイムライン（投稿・いいね・通知）→ X 規模を見据えた設計（D1 のインデックス、ページング、レート制限）。
3. iPhone アプリからのログイン（WebView では Google ログイン不可 → ネイティブで）。
4. Worker の URL から学籍番号のようなサブドメインを外す（独自ドメイン or サブドメイン変更 → サイトの `COMM_API` を更新）。
5. お問い合わせ窓口（利用規約・プライバシーポリシーは下書き。公開前に専門家確認を推奨）。
6. 計算できない技：カウンター・ミラーコート・メタルバースト・一撃必殺・なげつける・ふくろだたき・はきだす。
7. eFootball など他ゲーム（ゲーム切り替えの土台は `27-games.js`）。

## コミット
- 作者は `Claude <noreply@anthropic.com>`。メッセージは日本語で何を変えたか。
