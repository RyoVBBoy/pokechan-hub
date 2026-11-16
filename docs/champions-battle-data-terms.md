# Pokémon Champions Battle Data の利用条件の記録

確かめた日：2026-11-16（この日に実際にページを開いて読んだ。ページに日付・版の番号は書かれていない）
法律の判断ではない。条文をそのまま写し、分かったことと分からないことを分けて書く。

## 読んだページ
| アドレス | 中身 |
|---|---|
| https://championsbattledata.com/api-rules/ | API の利用の決まり（題名「API Usage Rules」） |
| https://championsbattledata.com/license （/license.html から転送） | ライセンス（サイト・生成ページ・API の答え・データの見せ方） |
| https://championsbattledata.com/api_guide | API の説明（受け口の一覧・答えの形） |
| https://championsbattledata.com/robots.txt | `User-agent: *` / `Allow: /` |

## 条文（原文のまま）
- 使ってよい範囲：「You may use the Pokémon Champions Battle Data API for personal, community, nonprofit, and commercial projects.」
- 出典：「If you display, publish, or use data from this API in a public project, you must give clear attribution. A simple attribution is enough: “Battle data provided by Pokémon Champions Battle Data” Please include a link to our website or API documentation when possible.」
- 商用：「You may use this API in commercial projects, including paid apps, websites, tools, dashboards, videos, articles, and services. Commercial use is allowed as long as you follow these rules.」
- 再配布：「You may not resell, sublicense, or redistribute this API or its data as a standalone product. You may not create a competing public API, database dump, bulk download service, or paid data feed using our data without written permission. You may not sell access to our raw API responses or present our API data as your own original data source.」
- 残すこと：「Reasonable caching is allowed to improve performance and reduce repeated requests. Cached data should not be used to create a permanent mirror, archive, or replacement for this API.」
- 回数：「There is currently no fixed public rate limit. However, we may temporarily limit, block, or revoke access if usage causes service problems, security issues, excessive load, or violation of these rules.」
- 正しさ：「The API is provided “as is.” … we do not guarantee that the data will always be complete, correct, current, or available. Data, endpoints, fields, and access rules may change at any time.」
- 公式との関係：「You may not state or imply that your project is official, sponsored, endorsed, or approved by those companies.」
- ライセンスのページ：「The website, generated pages, API responses, and data presentation are provided as-is for personal, educational, and competitive analysis use.」「When sharing or using data from this site, please credit Pokemon Champions Battle Data and link to https://championsbattledata.com/.」

## 依頼主の8つの問いへの答え
1. 条件のアドレス：上の表。
2. 条文：上のとおり。
3. 当サイトが使う受け口に当てはまるか：当サイトが図鑑のページで使う `GET /api/battle/:format/:name` は、API の説明に「Endpoint 04 Battle rows」として載っている。前に使っていた `/data/pokemon-index.json` と `/pokemon_champions_assets/battle_data/…csv` も同じ説明に載っている。決まりのページは「API」としか書いておらず、どの受け口までを指すかの定義はない。
4. 出典を出す範囲：「public project」で出す・公開する・使うとき、としか書かれていない。ページごとか、部品ごとかの決まりはない。当サイトは、このデータを出す部品ごとに出す（いちばん広い読み方）。
5. 回数の決まり：決まった上限はない（負荷・違反があれば止めることがある）。答えの見出しは `cache-control: public, max-age=120, s-maxage=900`。
6. 商用：認められている（上の決まりを守ること）。
7. 一時的に残すことと、ずっと残すことの区別：「Reasonable caching」は可、「permanent mirror, archive, or replacement」は不可。何時間までが reasonable かは書かれていない。
8. 日付・版：どちらのページにも書かれていない。「may change at any time」とある。

## 分からないこと（決めつけない）
- ライセンスのページは「personal, educational, and competitive analysis use」と書き、商用にふれていない。API の決まりは商用を認めている。どちらが優先かは書かれていない。
- 集計から当サイトが作った順位（強いポケモンランキング等）を公開してよいか。はっきりした条文はない（禁止されているのは、データそのものを商品・公開 API・まとめての配布にすること、自分の元データのように見せること）。
- 「reasonable caching」の長さ。
- 条件の日付・版がないので、いつ変わったかを後から確かめられない。再開のたびに読み直す。

## データに書かれていること・いないこと（2026-11-16 に 1 回だけ答えの形を確かめた）
- 答え：`pokemon`・`showdownId`・`format`・`season`（"Current"）・`date`（null）・`source`・`columns`・`rows`
- 行：`column_position`（提供元の並び順）・`category`（move／held_item／ability／teammate／stat_alignment／stat_points）・`rank`・`name`・`percentage`・`percentage_value`、性格は `stat_up`／`stat_down`、振り方は `hp_points` など6つ
- `teammate` の行には割合がない（順番だけ）
- 集計期間・レギュレーション・対戦数・レートの下限は、答えのどこにも書かれていない
- API の説明：並び順は「the game's own ordering; there is no species-level usage percentage in the battle data」
- 能力ポイントの欄（`hp_points` など）の定義は書かれていない

## 当サイトでの扱い（2026-11-16 時点）
- 全体は休止（`CBD_ON=false`・`CBD_PERSIST=false`・`RANK_PAUSED=true`・gen-pages の `CBD_ON=false`）。
- 図鑑のページの「型・育成」タブだけ、開いたときにその1匹分を読む（`src/js/81-cbd-detail.js` の `CBD_DETAIL`）。端末・サーバーに残さない。出典の文とリンクを必ず出す。
