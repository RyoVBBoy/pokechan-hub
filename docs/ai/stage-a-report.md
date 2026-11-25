# Game Kid/s AI — Stage A 実装報告（独立監査用）

対象仕様：[implementation-spec.md](implementation-spec.md)（Stage A のみ）  
ブランチ：`feature/gamekids-ai`（基準 `ae3a3a8`＝仕様を追加したコミット、その親が仕様の固定コミット `31ed89e`）  
外部AIの実呼び出し・課金・デプロイ・main へのマージは行っていない。AI は UI・API とも既定で無効。

## 1. 既定で無効であること

| 層 | 有効にする条件 | 無効のときの動き |
|---|---|---|
| Worker | `AI_ENABLED='1'`（文字列の完全一致） | `/api/ai/*` はコミュニティ用 DB の初期化・共通 JSON 読み取りより前に分岐し、DB・提供元に触れずに `503 ai_disabled`（テストで DB に触ると例外になる Proxy を渡して確認） |
| 提供元 | `AI_PROVIDER='mock'` だけ登録 | 実提供元は登録していない（`anthropic` 等を指定しても `503 provider_not_enabled`） |
| 画面 | `config/public.json` の `ai.enabled: true`（ビルド時に `PC_CONFIG.ai` へ） | 入口を出さず、`#/ai` は「準備中」、通信しない。テストだけ `navigator.webdriver` かつ `sessionStorage.pcaitest=1` で表示 |

本番で使うには、さらに `AI_HASH_KEY`（32文字以上）・`AI_BUDGET_MICRO`・`AI_ALLOWED_ORIGINS`・`AI_DB` バインディング（移行SQL適用済み）がすべて必要。どれかが欠ければ提供元を呼ばずに 503。

## 2. 変更点（ファイル）

| ファイル | 内容 |
|---|---|
| `worker/src/ai.js`（新規） | `/api/ai/v1/context`・`/api/ai/v1/answer`、入力検証（8 KiB を実バイトで・質問1,000字・未知の項目は 400）、認証（既存 `authOf`）・停止会員（主DB `users.banned`）、ゲーム別アダプター（`resolveScope`／`resolveEntities`／`findEvidence`／`runTool`／`getCapabilities`、`aiMakeAdapter`）、根拠台帳、`MockProvider.generatePlan`、計画の検証 `aiCheckPlan`、カード組み立て `aiCompose`、最終検証 `aiVerify`、利用枠・費用台帳（予約・送信記録・完了・精算・期限回収・期限削除・会員削除） |
| `worker/ai_ledger.py`（新規） | サイトの元データ（`RAWDATA`・`MEGAP`・`ABD`・`LSD`・`MV`・`MD`・`NAMES`）と `17-sources.js` の `SRC`・`VERIFIED_BAKED` から項目別の根拠レコードを作り、スキーマ・ID 重複・参照切れ（対象・出典・技・特性・メガ）・値の型・確認日・許可リンクを検査。失敗でビルド停止。`localStorage`（`pcverify`）による昇格は使わない |
| `worker/build.py` | 台帳の埋め込み、計算リビジョン（計算関数のソースの SHA-256）、計算で名前が特別扱いされる技・特性の抽出、計算許可特性がそれと重ならないこと・`species.txt` と台帳の種族値・タイプの一致を検査。画面と同じ `dmgRolls`・`koInfo`・`bhits`・`hitDist`・`mhCount` を Worker に取り込み。テスト用 `worker_test.js`（内部関数の出口つき、デプロイ対象外）と `ai_meta.json` |
| `worker/migrations-ai/0001_ai_init.sql`（新規） | AI_DB：`ai_requests`（予約＝1行）・`ai_rate`・`ai_cost_archive`・`ai_entitlements`・`ai_prices`（模擬アダプターのテスト単価だけ）・`ai_meta`。状態遷移と費用増加を止めるトリガー、CHECK 制約 |
| `worker/src/worker_src.js` | `/api/ai/*` を `api()` より前に分岐。`secureRes` は AI の道だけ AI 用の許可リストで CORS を返す |
| `worker/src/auth.js` | 既存の退会 `/api/me/delete` の最後で `aiForgetUser`（3秒まで・失敗しても退会は成功、90日の期限削除で回収） |
| `src/js/87-ai.js`（新規）・`06-router.js`・`27-games.js`・`order.json`・`styles.css` | `#/ai` 画面（ゲーム・形式・質問・回答カード・根拠・残り回数・計算条件の欄・この端末の診断/選出の表示）。送り先は固定の Worker（`COMM_API` の端末設定による上書きは使わない） |
| `tools/build.mjs`・`config/public.json` | `PC_CONFIG.ai.enabled`（既定 false） |
| `tests/ai.mjs`・`tests/ai-ui.mjs`・`tests/ai-d1.mjs`・`tests/ai-helpers.mjs`・`tests/ai-eval/fixed-v1.json`・`tools/gen-ai-eval.mjs` | 受け入れテスト（§5） |

## 3. 回答の形と保留

- 応答 `{status, scope, cards, evidence, reasonCode?, nextAction?, usage, requestId}`。カード `{templateId, slots, evidenceIds, verificationStatus}`。文章はサーバーが作らず、画面の決まった文にスロットの値を（エスケープして）入れる。
- 模擬AIが返せるのは「意図（列挙）」と「サーバーが渡した候補の番号」だけ。それ以外の項目・未知の番号・壊れた形は `plan_invalid`（枠を使わない）。最終検証でカードの番号が返す根拠に無い・台帳の値と違う・別ゲームのスコープ、のどれかがあれば `verify_failed` の定型文。
- 保留の例：レギュレーションの期間が公式で未確認（`SRC.regulation` が unverified）なので「使える／禁止」は常に `insufficient_evidence ruleset_unverified`。メガシンカの種族値は答え、使えるかは保留＝`partial`。同じ名前の姿（ウインディ／ウインディ（ヒスイ）、ルガルガンの3姿など）は勝手に決めず `needs_input` で選ばせる。
- 根拠のラベル（主張ごと）：`official` 公式資料／`ingame` 実機で確認／`external_match` 外部参照と一致／`site_calc`・`site_estimate` サイトの計算・推定／`site_aggregate` 当サイト集計／`insufficient` 根拠不足。

## 4. 計算の対応表（契約 `calc-a1`、計算リビジョンはビルドごとに `ai_meta.json`）

| 条件 | 対応 | 根拠 |
|---|---|---|
| 形式 | シングル・ダブル（単体を攻撃する技だけなので範囲補正なし） | 形式ごとに画面と全件一致（§5） |
| 姿 | 通常の姿。メガシンカの姿・ギルガルド・イルカマンは対象外 | `form_unsupported` |
| ランク・HP・場 | ランク0・HP満タン・天気/場/壁/状態異常なし・急所なし・持ち物なし | 入力に項目が無い（補わない） |
| 特性 | 計算の関数の中に名前が出てこない54特性だけ（ビルドで検査） | それ以外は `ability_unsupported` |
| 技 | 威力のある攻撃技、1回だけ当たる、対象が単体、計算で名前が特別扱いされない（溜め・反動・威力変化・固定ダメージ等を除く） | 308技中184技が対象（37技は許可特性を持つポケモンが覚えない） |
| 相性 | 等倍だけ | 仕様の最初の条件どおり。等倍以外は `effectiveness_unsupported` |
| 入力 | 攻撃側・受ける側の能力ポイント（1つ32・合計66）・性格・特性を必ず指定。覚える技・持てる特性かを確認 | 足りなければ `needs_input`（必要な項目を返す） |
| 出力 | 乱数16段階・最小〜最大・HP・確定数（`koInfo`）・前提・計算リビジョン | 対象外は数字を出さず、ダメージ計算の画面へ案内 |

## 5. テスト結果

コマンド：`npm run build`（`node tools/build.mjs && python3 worker/build.py && node tools/gen-pages.cjs`、`SITE_URL` と `CHROMIUM` を指定）、`node tests/run.mjs`（`ai.mjs`・`ai-ui.mjs` を追加）、`MINIFLARE_DIR=… node tests/ai-d1.mjs`。

結果の表は §8（実測値）を参照。

固定評価セット `tests/ai-eval/fixed-v1.json`（112件）は `tools/gen-ai-eval.mjs` で一度だけ作って保存した。期待値は AI の台帳を使わず、図鑑の事実はサイトの元データ、計算はダメージ計算の画面（`calcResult`）から作った。テストは作り直さない。作成中に、生成スクリプトが計算の対応表の外の技（はかいこうせん・あなをほる等）を「対応」に分類していたため、それらは対応外のケースとして残し（期待＝`move_unsupported`）、対応ケースは対応表の中から選び直した（失敗例を消して合格にはしていない）。

## 6. 差異・未検証点（監査で見てほしいところ）

1. **根拠ラベルの追加**：仕様の6種に無い「外部参照（1出典・未照合）」を使った（`SRC.lv` が `single`＝PokeAPI 由来の1出典のもの、種族値・タイプ682件など）。「外部参照と一致」とは言えず、「根拠不足」とすると値を出しながら根拠不足と表示することになるため。どちらに寄せるかは判断が必要。
2. **計算の一致の範囲**：一致を確かめたのは「同じ関数を同じ入力で呼んだ結果」と「画面の数字の行」。ゲーム実機との一致は既存の calc-ref・calc-cases の範囲で、新たに実機では確かめていない。ダブルは単体技だけなので、範囲技・味方の補助・まもる等は対象外。
3. **使用率**：`usage_cache` の `seen` だけを使う。現行の重複判定（同じ人・同じ日・同じ6匹）は形式を含まないので「記録されたサンプルの割合」と表示。30日・6時間以内・件数・生成時刻・形式がそろわなければ保留。20件未満は出さない。`builds`・外部の集計（Champions Battle Data・PokéKit）は使わない。
4. **D1 の同時実行**：Miniflare（workerd＋D1）で同時50件を確認。Miniflare は `npm audit` で high 3件（sharp・undici）が出るため `package.json` に入れず、別の場所に入れて `MINIFLARE_DIR` で指す。`tests/run.mjs` には入れていない（入っていなければ `ai-d1` は「未実行」で終了コード2）。Cloudflare 本番の D1 では確かめていない。
5. **同時1件・予算の意味**：「処理中の期間が重ならない」「受け付けた時点で、処理中は最大費用・完了は実際の費用の合計が予算以内」。先の受付が終われば、同じ人・予算の差額で次を受け付ける（テストで時系列を検査）。
6. **質問の解釈**：模擬AIは決まった正規表現で意図を選ぶだけ。英語の質問は名前の解決はするが、意図の語は日本語だけ。B の実提供元では、同じ固定評価で比べ直す必要がある。
7. **メタデータの保持**：同じ受付IDの再送に同じ答えを返すため、回答（質問文は含まない）と入力の鍵付きハッシュを24時間だけ `ai_requests` に置く。会員の識別子は AI 用の鍵で HMAC した値だけ。鍵を入れかえると古い行は削除で見つからなくなる（90日の期限削除で消える）。
8. **診断・選出の端末内表示**：パーティの画面の計算結果（`DG_CACHE`・`DG_SELC`）が、いまのパーティ・形式・集計の状態の鍵と一致するときだけ表示。サーバーへは送らない。構築（相性のいい仲間・1匹から組む）は結果を表示せず画面へ案内だけ。
9. **トークンの見積もり**：UTF-8 のバイト数の半分（日本語1文字＝1.5トークン）。実提供元のトークナイザーとの比較は B。
10. **費用**：模擬アダプターの単価はテスト値（入力0.10・出力0.50 USD／100万トークン）を移行SQLに入れた。実際の請求はない。
11. **停止スイッチ**：手動の `AI_ENABLED`（外せば DB にも触れず止まる）と、全体の予算（`AI_BUDGET_MICRO`、超えると `503 budget_exhausted`）だけ。異常率・費用の急増を見て自動で止める仕組みは Stage A では作っていない（B の前に必要）。
12. **メトリクス**：`ai_requests` の行に提供元・モデル・状態・理由コード・費用・時刻が残る（質問文・回答の全文ログは残さない。回答は再送用に24時間だけ）。トークン数そのものは保存していない。
13. **本番 Worker との一致・バインディング・提供元の契約状態**は確認対象外（仕様 §2 のとおり）。

## 8. 実測値（2026-11-25、このコンテナ・Node 22・Chromium）

| 実行 | 結果 |
|---|---|
| ビルド（`tools/build.mjs`・`worker/build.py`・`gen-pages.cjs`） | 成功。台帳 5,021件・dataRevision `dd4460257edfc`・engineRevision `ee3c2bc440bf7`・Worker 1,092 KB（前 522 KB） |
| 既存の回帰（基準 `ae3a3a8` を別の作業ツリーで） | 46ファイルすべて合格 |
| このブランチの `tests/run.mjs` の全ファイル（既存46＋`ai.mjs`・`ai-ui.mjs`） | 48ファイルすべて合格 |
| `tests/ai.mjs` | 442/442（根拠183・計算122・ツール/使用率25・保留/分離27・防御56・利用枠29）、回答可能 51/51 |
| `tests/ai-ui.mjs` | 69/69（画面24・計算の画面一致38・端末の結果7） |
| `tests/ai-d1.mjs`（Miniflare 4.20260730.0、同時50件） | 11/11 |
| 外部への送信 | 0件（テストの fetch は Google の公開鍵以外を数えて失敗させる） |
| `npm audit` | 0件（変更なし） |
