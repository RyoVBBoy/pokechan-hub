# 入れかえ案 MVP 第2段階：実装の事実のまとめ（2026/11/14 作成）

第2段階の報告書が無かったため、第3段階を始める前に、**実際のコード・テスト・Git の履歴だけ**から書いた。意図や予定ではなく、いまあるものを書く。

## 1. どこに何があるか

| ファイル | 中身 |
|---|---|
| `src/js/75-mvp-data.js` | `MVP_DATA`（版 `version`）。公式の M-C の参加できるポケモン 262件（`legal.ids`、`図鑑番号-姿の番号`）、対応が確かめられない4つの図鑑番号（`legal.unverifiedDex`：ビビヨン・フラエッテ・イッカネズミ・イキリンコ）、公式ページの新しいメガ6つ（`legal.newMegas`）、PokéKit のシングル149行・ダブル147行（`sets.single/double`、各行に特性・持ち物・技・性格の割合と使用率・順位。`evs` は持たない）。 |
| `src/js/76-mvp.js` | 評価の本体（287行）。`mvpLegal`・`mvpStoneSt`・`mvpRows`・`mvpSet`・`mvpMemberSet`・`mvpTeamSets`・`mvpOpps`・`mvpMatch`・`mvpEvalTeam`・`mvpCompare`・`mvpSwaps`・`mvpSwapSet`・画面 `mvpSwapDraw`/`mvpResultHTML`/`mvpBind`。 |
| `tools/gen-mvp-data.cjs` | 手で取得した公式の一覧と PokéKit の JSON を確かめて 75-mvp-data.js を作る道具。 |
| `tests/mvp.mjs` | 33項目のテスト。 |

コミット `d14376d`（2026/11/13）。GitHub Actions の公開（run 256）は成功。

## 2. 評価のしかた（コードのとおり）

- **使えるか**：`mvpLegal(no)`＝メガの姿は元の姿で見て、`mvpOffId`（図鑑番号4けた＋`ZK_SUB` の姿の番号3けた）が公式の一覧にあれば ok、`unverifiedDex` なら unverified、無ければ illegal。
- **メガストーン**：`mvpStoneSt` は `newMegas` の6つだけ ok、ほかは unverified。候補ではメガの行を外す。パーティの匹のメガは計算し、未確認の札を出す。
- **型**：`mvpSet(fmt,no,opt)`＝同じ形式・同じ月の PokéKit のその匹の行だけから。特性・持ち物・技（覚える技だけ、4つ）・性格は割合のいちばん高い使えるもの。持ち物は `used`（残りの匹の持ち物）と重ならないもの。結果 st＝ok／illegal／unverified／nodata（上位150匹に無い）／insufficient／item_conflict。能力ポイントは全員 `MVP_SP`（攻撃側32・素早さ32・HP2）。`IMP_NOMV`（1対1で扱えない技）を含む型は候補にしない。
- **パーティの匹**：登録した育成 → PokéKit の型（持ち物が重ならないように）→ 自動の型（`chooseSet(p,true)`、推定と表示）。
- **相手**：同じ形式の PokéKit の使用率の上位20匹（`MVP_OPPN`）。型が組めない相手は `oppSkip`。
- **1対1**：`dgMatch`（60-diag.js）。集計（`LIVE.csv`）と画面の天気は止め、パーティの天気（`teamWx`）だけ使う。結果を `MVP_MC` に覚える。
- **メガシンカ**：メガストーンを持つ匹ごとに「その1匹だけメガ」の場合（`scen`）。持ち物はメガでない場合は持ち物なしで計算。
- **大きな弱点**（`MVP_WK`、相手ごと）：none＝r≥3 の匹なし、nosw＝後出しして勝てる匹も、いちばん痛い技を最大の乱数で50%未満の匹もいない、ohko＝半分以上の匹が一撃、nohit＝最大の乱数で50%以上削れる匹がいない。上位10匹（`MVP_TOPN`）の相手と ohko は crit（大きな弱点）。
- **比べ方**：`mvpCompare`＝同じメガの場合どうし。外す匹がメガの場合はメガなしと比べ、メガが無くなれば `lastMegaLost`、メガの候補で `megaAdded`。better＝大きな弱点を1つ以上減らし、どの場合でも大きな弱点を増やさず、弱点の総数も増えない。tradeoff＝減らすが増えもする。
- **候補のしぼり方**：`mvpSwaps`＝集計の行 → 使えると確認 → 同じ種類でない → メガストーン確認 → 型が組める → いまの大きな弱点の相手に有利（r≥4）か後出しできる → 上位8匹（`MVP_PRE`）を全部の枠で計算し直す。並びは減らした大きな弱点 → 残る大きな弱点 → 差 → 図鑑番号。
- **画面**：「相性のいい仲間を探す」（#/pair）で6匹そろったときだけ `mvpSwapDraw`（`MVP_TOK` で古い計算の結果を出さない）。
- **ほかの入口**：`dgSwapSet`（60-diag.js）が `mvpSwapSet` を使う（＝候補の**型**だけ MVP と同じ）。パーティのチェックの `dgDefSwaps`、改善案 `dgImprove` の入れかえ、敗因の診断②は、**評価はいままでどおり `dgTeam0`**（相手は集計の上位、メガストーンを持つ匹は全員メガで計算）。

## 3. テスト（2026/11/14 にこの環境で実行）

`node tests/run.mjs`（CHROMIUM=/opt/pw-browsers/chromium）：すべて合格。mvp 33項目・calc 1500/1500 一致ほか。

## 4. 第2段階で変えなかったと書かれていること（CLAUDE.md）

- 診断（`dgTeam0`）がメガストーンを持つ匹を全員メガで数えること（点検 B-1-1）。
- 改善案・後出し不足・敗因の診断の判定のしかた。
