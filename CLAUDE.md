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
- パーティは3つまで保存（`13-party.js` の `TEAMS`＝localStorage `pcteams`。ログイン中は `33-sync.js` がサーバー（`/api/me/teams`、D1 の user_data）と同期し、どの端末でも同じになる＝ログインの利点。変更時刻 `TEAMS.updated` が新しい方を残し、置きかえ前の端末の中身は `pcteams_backup` に残す。いま選んでいるものが `team`、`switchTeam(i)` で切り替え、名前を付けられる。古い `pcteam` は1つ目に自動で移す）。
- ポケモンの名前は `nm(p)`（`04-common.js`）で出す：名前を太く大きく＋姿の違いの札（メガ・アローラ/ガラル/ヒスイ/パルデア・オス/メスなど、`formInfo`）＋図鑑番号。公式の画像は使わず、図形（種族値の形）は1つ目のタイプの色で塗り、2つ目のタイプの色で縁どる。
- ホーム（#/）＝投稿（X のように左「みんな」・右「フォロー中」。`tlView(null,true)`、タブは `tlShow`）。もとのホームの中身（すぐ使う・相性・役割・ランキング）は `07-home.js` の `toolsTopHTML`/`toolsBottomHTML` としてツール画面に出す。
- 左から出るメニュー（`34-drawer.js`）：左上のマークを押す／ホームの「みんな」で右にスワイプ（指に合わせて出る）。プロフィール・お知らせ・パーティ・マイツール・ゲームを切り替える・対戦募集・掲示板・設定（明るさ・言語・通知）・ヘルプ。ホームでは左右スワイプで「みんな／フォロー中」。
- スマホに届く通知（Web Push）：サーバー `worker/src/push.js`（送り主の鍵 VAPID はサーバーが初回に作って D1 の push_keys に保存＝合言葉の設定は不要。宛先は push_subs。中身は RFC 8291 aes128gcm で暗号化。いいね・フォローで `pushTo`、同じ相手・同じ内容は24時間に1回）、サイト `35-push.js`（sw.js の登録・通知のオン/オフ・iPhone は「ホーム画面に追加」から開いたときだけ）、`src/static/`（sw.js・manifest・自作アイコン。build で dist にそのまま置く）。テスト `tests/push.mjs` は標準ライブラリ http_ece で復号して確かめる。
- 明るさ：`00-i18n.js` の THEME（端末のライト／ダークに合わせる。`pctheme`＝auto/light/dark で固定もできる）。色は `styles.css` の変数（--bg・--fg・--glass・--onfg など）を使い、`#000` などを直接書かない。明るい色は最後の `[data-theme=light]`。タイプの文字色 TXT は明るさに合わせて `txtCalc()` で作り直す。
- 検索（下のメニューの「検索」、旧「図鑑」）：`32-timeline.js` の `searchView`（#/search/言葉）。ポケモン名に合えば一番上にそのポケモン（押すと図鑑）、その下にトレーナーと投稿。図鑑の一覧（#/dex）は検索画面から。ハッシュタグは投稿の本文から `tagsOf` で取り出して D1 の note_tags に入れる（/api/search?q=#タグ、/api/tags/trend）。本文の #タグ は `linkTags` で青い文字＋検索へのリンク。
- ポケモンを選ぶ欄は長い一覧（select）にしない。`monField(属性,番号)`＋`pickMon()`（`11-matchup.js`）＝名前を打って絞り込む（ひらがな・英語OK、パーティ・最近選んだを上に）。
- スクロールは body の中（`html{overflow:hidden}`、body がスクロールする）。iPhone の Safari でアドレスバーが縮んで下のメニューがずれるのを防ぐため。`window.scrollY`・`scrollTo` は使わず、`00-start.js` の `scrY()`・`scrTo()` を使う。
- 選出のアドバイス（`36-advice.js`）：選出アシストの結果に出す。よく知られた選出の考え方を当サイトの言葉でルール化（積み技・トリル・天気・いかく・素早さ負け・弱点の重なり・受け出し先なし・メガ候補・こだわり・ダブルのねこだまし等）。記事の文章は使わない。参考記事は `ADV_REFS` にリンクだけ（運営者が中身を確かめたものだけ足す。今は空）。
- 攻略ガイド（`37-guide.js`）：#/learn（道具・戦術）、#/item/キー、#/word/ID。道具は `ITEM_GUIDE`（こだわり系・火力・耐久・タイプ強化18種）の文章＋種族値から選ぶ「持たせる候補の例」、メガストーン81種は `megaGuide` がデータから説明を作る。戦術・用語は `WORDS`（20語）。技・特性は `38-guide-moves.js`（#/learn/move・#/learn/ability、#/move/番号・#/ability/キー）：`MOVE_ROLES`（18の役割）・`ABILITY_ROLES`（12の役割）に当サイトの説明、技・特性のページに覚える／持つポケモン。技のページの「使いどころ」は `moveTips`（その技のデータ＝優先度・命中・追加効果・反動など）だけから作り、グループの説明は使わない（グループは「分類」の札＋どの技にも当てはまる一言 `ROLE_TIP`）。特性も同じく `AB_ROLE_TIP`。検索にも出る（`guideSearch`）。英語は未翻訳。ポケモンごとの解説は `39-guide-mons.js` の `monGuide(p)`：図鑑の「解説」タブ（#/p/番号 の2つ目のタブ。タブは 種族値・解説・実数値・弱点・対策・技・特性）と検索向けの静的ページ（gen-pages）に出す。特徴（種族値の順位・速さ・耐久・弱点）・向いている役割・型の例（計算で組む。「実際の型とは違うことがある」と明記）・技の選び方・特性・相性のいい味方（弱点を受け合う＋天気/トリル）・有利な相手を、すべてデータから組み立てる。構築の型は `40-guide-builds.js` の `ARCHS`（あめ・はれ・すなあらし・ゆき・トリックルーム・おいかぜ・対面・サイクル・積みエースの9つ）：#/learn/build（一覧＋いまのパーティに近い型）・#/arch/ID（考え方・組み方・弱点と対策・いまのパーティの○×・中心になるポケモンの例・よく使う技）。パーツは [名前, 条件, 必須か, 先に出す特性]。`archBuild(a)` が型の例のパーティを6匹組み（必須の役→あるとよい役→弱点が重ならないように埋める）、「このパーティを使う」で空いているパーティの枠に入れる（空きがなければ確認して入れかえ）。
- PC表示：700px以上で下のタブ→左のメニュー（本文600px）、1280px以上で右に「よく使う機能」（`src/styles.css` の最後・`31-desktop.js`・`index.html` の `.pc-*`/`.pcside`）。スマホ（699px以下）の見た目は変えない。
- `config/public.json`：公開してよい設定（Firebase のウェブ用の値）。build でページの `window.PC_CONFIG` に入る。
- ゲームの追加：`27-games.js` の `GAMES` に1件足す（`tabs`＝下/左のメニュー、`tools()`＝ツール一覧〔id・sec・href・ic・t・s(短い名前)・d〕、`quick`＝初めての人向けの「すぐ使う」、`fab`＝右下ボタンの有無）。「コミュニティ」タブ（旧「みんな」）は全ゲーム共通で自動で付く。ツール画面・ホームの「すぐ使う」・PCの右の列・最近使った（`pcrecent`）・マイツール（☆、`pctools`）はゲームごとに自動で切りかわる。画面の中身（views）はゲームごとに新しいファイルで作り、`06-router.js` の表に足す。
- ことば（日本語・英語）：`00-i18n.js`（LANG＝端末の言語→利用者が選ぶと `pclang` に保存、`L('日本語','English')`）、`02-names.js`（ポケモン・技・特性・持ち物・性格・タイプの英語の正式名。`python3 tools/gen-names.py <PokeAPIのCSVフォルダ>` で作る。手で直さない）、`97-dict-en.js`（画面の文字の辞書 `EN` と、数字入りの文の置きかえ `EN_RE`）、`98-i18n.js`（英語のときだけ名前を入れかえ、画面に出た文字を辞書で置きかえる）。利用者が書いたもの（投稿・掲示板・名前）は `data-notr` を付けて訳さない。新しい画面を作ったら `tests/i18n.mjs` が訳し忘れを一覧にするので、辞書に足す。未翻訳：技・特性の説明文（MD・ABDS）、基本ルール・出典・利用規約などの長い文、サーバーのエラー文の一部。韓国語・中国語は `gen-names.py` の LANGS と辞書を足せば増やせる。テスト・検索向けページは `locale:'ja-JP'` で日本語に固定。
- タイムライン：サイトは `32-timeline.js`（#/tl・#/tl/following・#/u/ID・#/n/番号・#/notif）、サーバーは `worker/src/social.js`（/api/tl・/api/notes・/api/follow・/api/notifs・/api/u）。見るのはログイン不要、書くのはプロフィール作成済みの人だけ。140文字・15秒に1件・1日100件・リンク不可・ログインした人3人の通報で非表示。
- `worker/`：Cloudflare Worker（背面タップ連携・選出画面の読み取り・掲示板/対戦募集・ログイン確認・タイムライン）。`worker/build.py` がサイトの計算関数とデータを `src/js` から取り込んで `worker/dist/worker.js` を作る（計算はサイトと共通）。
- `tools/build.mjs`（サイト → `dist/`）、`tools/gen-pages.cjs`（検索向け静的ページ。Playwright 使用、`SITE_URL` 必須）。
- `tests/`：`node tests/run.mjs`（worker・auth・social＝タイムラインのサーバー・site 25画面＋PC表示・push＝通知の暗号化と送信・login＝ログイン〜投稿の画面の流れ・i18n＝英語表示・calc-ref＝@smogon/calc と乱数16段階を照合）。**テストに落ちると公開されない。**
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
- スマホのログイン：スマホ（とホーム画面に追加したとき）は、ログインの窓口をサイトと同じアドレス（`/__/auth/…`）にして画面切りかえ方式（signInWithRedirect）でログインする。`functions/__/[[path]].js`（Cloudflare Pages Functions）が pokechan-hub.firebaseapp.com に取り次ぐ。Google Cloud の OAuth クライアントの「承認済みのリダイレクト URI」に `https://pokechan-hub.pages.dev/__/auth/handler` が必要。パソコンは別の窓（popup）のまま。
- ログイン：Firebase Authentication（プロジェクト `pokechan-hub`）。Google・メールリンクを有効化済み。Apple は Apple Developer 登録後。サーバーは RS256 の IDトークンを Google の公開鍵で検証（`worker/src/auth.js`）。
- iPhone アプリは別リポジトリ `RyoVBBoy/pokechan-ios`（XcodeGen + GitHub Actions → TestFlight。Apple の承認待ち）。

## 守ること
- **公式の画像・アイコン・ロゴは使わない**（サイトの部品・アプリでの使用は Pokémon Champions の動画・静止画ガイドラインの範囲外）。自分で撮ったスクリーンショットは、非営利のうちは記事に使える（広告を入れたら外す）。
- **ほかの攻略サイトの記事に頼らない（2026/10/29 方針）**。記事を読んで書き直すこと（翻案）もしない。説明はすべて、ゲームのしくみの理解と当サイトのデータ（種族値・覚える技・ダメージ計算）から当サイトの言葉で書く。参考記事を紹介するときはリンクだけ。
- **ゲーム内の文章を転載しない**。技・特性の説明は当サイトが書いた文章（`MD`・`ABDS`）。数値（威力など）は事実なので可。
- データ：Pokémon Showdown の champions mod（learnsets・moves・formats-data）を**実行せずに解析**して使用。ゲーム内で書き写した 510 技と照合済み（PP などが違う5技はゲーム内の値）。
- ダメージ計算は本編（SV）と同じ 4096 補正・五捨五超入。変更したら calc-ref テストで照合する。ボディプレスへの攻撃補正、メガソーラー＋ソーラービームの雨補正は Showdown 準拠（ゲームで未確認）。
- 依頼主の個人情報（メールアドレス等）を外部サービスに送らない。

## 次にやること（優先順）
（済・2026/10/29）ログイン確認・タイムライン・フォロー・いいね・お知らせ・スマホ通知・PC表示・英語表示・ライト/ダーク・検索タブとハッシュタグ・X風ホームと左メニュー・パーティ3つ＋ログイン同期・PiP（バトル/育成）・画像取り込みのニックネーム予測・ポケモン選択の絞り込み・名前の札（メガ/地方）・選出のアドバイス・攻略ガイド（道具/技/特性/戦術）・Cloudflare Pages へ移行。

### 依頼主に確認・お願い中のこと（新しいチャットでまず確かめる）
- **Google ログイン（PC・スマホとも失敗）**：原因は Firebase の承認済みドメインに `pokechan-hub.pages.dev` が無いこと（2026/10/30 に `https://identitytoolkit.googleapis.com/v1/projects?key=<public.json の apiKey>` で確認。入っていたのは localhost・firebaseapp.com・web.app・netlify.app）。依頼主に追加をお願い中。追加後も失敗するなら、スマホは functions/__ の取り次ぎを疑う（この環境からはサイトも firebaseapp.com も開けないが、上の API は見られる）。
- GitHub Variables の `SITE_URL` を `https://pokechan-hub.pages.dev` に変えたか未確認（検索向けページの URL に使う）。
- 選出アドバイスの参考記事（`ADV_REFS`）：候補（AppMedia・BlueStacks・VGC Guide）を依頼主が確かめてから追加する。この環境からは外部サイトを開けない。

### 次の作業
1. 攻略ガイドの続き：ポケモンの解説・構築の型は済。次は型ごとの静的ページ（検索向け）や、型の例の技・持ち物まで組むこと。文章は当サイトのオリジナル（他サイトを読まない）。
2. 攻略ガイド・アドバイスの英語訳（今は日本語のみ）。
3. タイムラインの改良：画像つき投稿（notes.media 列あり、保存先 R2 想定、不適切画像の見回り方法を要検討）、返信・リポスト、管理画面からのアカウント停止（users.banned あり）。利用者が増えたら「フォロー中」を書くとき配る方式へ。
4. iPhone アプリ（別リポジトリ）からのログイン（ネイティブで）。
5. Worker の URL から学籍番号のようなサブドメインを外す（独自ドメイン or サブドメイン変更 → `COMM_API` 更新）。
6. お問い合わせ窓口。利用規約・プライバシーポリシーは下書き（公開前に専門家確認を推奨）。
7. 計算できない技：カウンター・ミラーコート・メタルバースト・一撃必殺・なげつける・ふくろだたき・はきだす。
8. eFootball など他ゲーム（`27-games.js` の GAMES に足す）。サイト名（ポケチャン攻略Hub）を総合向けに変えるかは依頼主が決める。

### 作業の進め方（このプロジェクトでの決まり）
- 作業ブランチで直してテスト（`node tests/run.mjs`、CHROMIUM=/opt/pw-browsers/chromium）→ 合格したら main に fast-forward で push（main が自動公開）。公開後に GitHub Actions の結果を確認して依頼主に一言報告。
- 画面を変えたら Playwright でスマホ幅（390px）とPC幅のスクリーンショットを撮って確かめ、依頼主にも送る。
- 依頼主への説明は日本語・専門用語なし・手順は1つずつ・リンク付き。

## コミット
- 作者は `Claude <noreply@anthropic.com>`。メッセージは日本語で何を変えたか。
