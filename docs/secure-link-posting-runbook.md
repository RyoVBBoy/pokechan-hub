# Secure link posting — configuration, rollback and policy drafts

Status: implemented on `feature/secure-link-posting`, **all flags OFF by default, not released**. Do not enable in production until every gate in `docs/secure-link-posting-report.md` §7 is closed.

## 1. Server flags and secrets (Cloudflare Worker settings — names only)

| Name | Kind | Default | Effect |
|---|---|---|---|
| `LINKS_POST` | variable | unset (OFF) | `1` = authenticated timeline notes/replies may carry one HTTPS link. Also requires `SANCTIONS_ON=1`, a valid email keyring with a current version, and `WEBRISK_API_KEY`; otherwise link posts are refused (503) and plain posts are unaffected. |
| `LINKS_CLICK` | variable | unset (OFF) | `1` = links can be opened through the two-step `open` → `go` flow. OFF = feeds return `state:"off"` (host only) and both endpoints return 403 `inert`. |
| `SANCTIONS_ON` | variable | unset (OFF) | `1` = admins can create case records and sanctions; verified-email hashes start being recorded. **Active sanctions are enforced regardless of this flag.** |
| `WEBRISK_API_KEY` | secret | unset | Google Cloud Web Risk key, sent only in the `x-goog-api-key` header to the fixed endpoint `https://webrisk.googleapis.com/v1/uris:search`. Never returned or logged. |
| `EMAIL_HMAC_KEYRING` | secret | unset | JSON `{"<version>":"<key ≥32 chars>", …}` (≤8 versions, version = `[A-Za-z0-9_-]{1,16}`). **All versions still referenced must stay in the ring.** |
| `EMAIL_HMAC_KEY_CURRENT` | variable | — | Version used for new hashes. Must exist in the ring, or the ring is treated as invalid. |
| `EMAIL_HMAC_KEY` / `_VER`, `EMAIL_HMAC_KEY_PREV` / `_PREV_VER` | secret / variable | unset / `v1` / `v0` | Legacy single-key form; merged into the ring (`EMAIL_HMAC_KEY` is current unless `EMAIL_HMAC_KEY_CURRENT` says otherwise). |
| `LINKS_WEBRISK_DAY` | variable | `5000` | Global daily cap on provider calls (atomic D1 counter, reserved only after a lease is held). |
| `LINKS_WEBRISK_CONC` | variable | `4` | Global concurrent provider calls (1–16), enforced by D1 lease rows shared by every isolate. |
| `LINKS_WEBRISK_MS` | variable | `3000` | Provider timeout (500–5000 ms). A lease expires at timeout + 2 s, so a crashed isolate's lease is recovered automatically. |
| `LINKS_CLEAN_TTL_MIN` | variable | `30` | Lifetime of a "no match" verdict (5–60 min). Unsafe verdicts: provider `expireTime`, clamped to 10 min–24 h. |

No new binding is required; all new tables live in the existing D1 (`DB`).

## 2. Enabling (only after the release gates)
1. Create the keyring as a secret (`EMAIL_HMAC_KEYRING`, random keys ≥32 chars) and set `EMAIL_HMAC_KEY_CURRENT`. Set `WEBRISK_API_KEY`.
2. `SANCTIONS_ON=1` first and check the admin tab「リンク・利用停止の記録」: the key-status banner must be absent (`health.ok`).
3. `LINKS_CLICK=1`, then `LINKS_POST=1`. `GET /api/links/config` must return `{"post":true,"click":true}`.
4. Apply the approved rules/privacy text (§5) in the same release.

## 3. Behaviour that operators must know
* **Opening a link (two steps).** Feeds return only `{host, state}` (`ok` | `off` | `blocked`), never the full URL. `POST /api/links/:id/open` re-checks visibility, state and a fresh verdict (re-reading them after any asynchronous re-check) and returns the URL for the confirmation dialog plus a one-use intent valid 60 s and bound to the viewer and the link's revision. `POST /api/links/:id/go` consumes the intent atomically and re-checks visibility, state, revision, verdict expiry and the flag before returning the URL. The browser opens a blank tab inside the click, clears `opener`, and navigates it through a `no-referrer` meta refresh only after `go` succeeds; on any refusal the tab is closed. If the browser blocks the tab, a native `noopener noreferrer` link is shown for 15 s.
* **Limits that cannot be removed:** a URL already shown in a dialog (or copied) cannot be revoked from the user's memory; there is an unavoidable race between the final `go` answer and the external navigation; a destination can change after it was checked. "No match" is never presented as "safe".
* **State changes are revision-guarded.** Every state change on `note_links` increments `rev`. Re-checks (click, report) and admin restore/recheck write only if `rev` is unchanged since they read it; admin quarantine always wins and increments `rev`, invalidating outstanding intents.
* **Provider budget.** Cache → lease (global, D1) → daily quota → fetch → release. The cache never lets a "clean" answer overwrite an unexpired "unsafe" one or an older answer overwrite a newer one, a concurrent unsafe answer wins, and size is capped at 5000 rows on every write.
* **Request bounds.** JSON bodies are read as a stream and cancelled at 256 KB (with or without `Content-Length`); only JSON objects are accepted. Malformed bodies count per client (salted IP hash): 30 per 10 min per client, 5000 per 10 min globally, then 429. Link intents (field present or `http(s)://` in text) take the per-UID slot (10 s / 12 per h / 40 per day) before any other check, including malformed ones. Every note insert enforces 15 s / 100 per day inside the INSERT itself, so concurrent plain and link posts cannot exceed it.
* **Sanctions.** Created only from a case record (`POST /api/admin/cases`: target, kind `attack`|`linked`, summary ≥20 chars, 1–10 references to this site's own records — note, link, link_event, report — that belong to the target; `linked` also needs an active confirmed-attack root). `POST /api/admin/sanctions` needs the open case, rationale ≥20 chars and `confirm:"SANCTION"`; the UID row, email tombstones, audit events, `banned=2` and case status are written in one D1 batch under one immutable `root_key`. Reversal reverses every row with that `root_key` (all re-key copies) in one statement; independent sanctions on the same email keep their own roots. Re-key copies are only inserted while the root is active. Durations: permanent, 90 days default, or 3–6 calendar months in JST with end-of-month clamping (owner approval still required for the default).
* **Expiry SLA.** Writes by the sanctioned account re-check immediately. Public visibility (`banned=2`) is restored by the hourly cron (`0 * * * *`) and by periodic cleanup, i.e. **within 1 hour** after expiry; the delay errs on the side of still hiding. Manual bans (`banned=1`) are never touched.
* **Key coverage.** On every authenticated request the gate checks that every key version used by active tombstones is in the ring; if not (or the ring is invalid), logged-in writes and `/api/me*` fail closed with 503 and the admin tab shows the missing versions. Recorded identity hashes whose version is missing block creation of new permanent sanctions. Hashes cannot be recomputed without the plaintext email, which is never stored — so **never remove a key version from the ring on elapsed time alone**; retire a version only when `health` shows nothing references it.
* **Email reassignment risk.** A permanent email tombstone also blocks any future person who receives the same address from the provider. Appeals go through the contact form; reversal is per root.
* **Cost.** Measured in tests: a logged-in GET adds 3 D1 queries over an anonymous one (1 pre-existing profile lookup + 2 for sanctions); a plain post uses 8 in total.

## 4. Rollback / kill switch
* **Stop new links**: unset `LINKS_POST`. Inline URLs are rejected by the legacy filter; an explicit `url` field is rejected, never silently dropped. Existing posts and `note_links` rows are kept.
* **Stop opening links**: unset `LINKS_CLICK`. Feeds immediately render links inert (`state:"off"`), and `open`/`go` refuse, including dialogs already open. Clients cache `/api/links/config` for up to 5 min, but the server is authoritative.
* **Never** delete `sanctions`, `sanction_events`, `sanction_cases`, `note_links`, `link_events` to roll back. Unsetting `SANCTIONS_ON` stops creating sanctions and recording hashes; it does **not** lift active sanctions.
* To lift one sanction: admin tab → 取り消す (reason + confirmation). The legacy `/api/admin/ban {on:false}` only lifts the manual ban; an active sanction keeps `banned=2`.
* Mixed versions: an old site ignores `ulink` and never sends `url`; a new site against an old Worker gets 404 for `/api/links/config` and hides the link UI. Tables and columns are additive (`CREATE … IF NOT EXISTS`, `ALTER … ADD COLUMN`).

### Data model
`note_links` (+`rev`), `link_intents`, `link_verdicts` (≤5000), `link_attempts`, `link_clicks`, `link_quota`, `link_leases`, `req_bad`, `link_events` (no full URLs), `sanction_cases`, `sanctions` (+`root_key`, `case_id`; unique `(root_key, ehash)` for email rows and `(root_key)` for UID rows), `sanction_events` (+`root_key`), `user_emails`. `users.banned`: 0 normal, 1 manual, 2 sanction-derived.

## 5. Policy text drafts (NOT applied — owner/legal approval required)
These replace the current rule lines on `#/rules` that say links are not allowed, only once approved.

**利用ルール（案）**
- タイムラインの投稿・返信には、https:// で始まるリンクを1つだけ付けられます（確認済みのメールアドレスでログインした人だけ）。メッセージ・掲示板・対戦募集・プロフィールには、これまでどおりリンクは書けません。
- 短縮URL・転送するリンク・外部の連絡先（メッセージアプリ・招待など）・ログインの印や合言葉を含むリンクは付けられません。
- リンクは外部の安全確認サービスで確かめますが、問題が見つからなかったことは安全の保証ではありません。
- 意図的に危険なリンクを広めるなど、サイトや利用者への攻撃と運営が確かめた場合、そのアカウントは期限なく利用できなくなり、同じ確認済みメールアドレスでの再登録・利用もお断りします。関係すると確かめたアカウントは一定の期間（例：90日）利用を止めることがあります。通報・自動の判定だけでは止めません。異議は「お問い合わせ」から受け付けます。

**Rules (draft, EN)** — One https:// link per timeline post or reply (verified-email accounts only); links remain disallowed in messages, boards, the lobby and profiles. Shorteners, redirects, external-contact invites and URLs containing login tokens are refused. Links are checked by an external safety service; passing the check is not a guarantee of safety. Accounts confirmed by staff to have intentionally attacked the site or users are permanently barred, including re-registration with the same verified email; accounts confirmed as related may be restricted for a period (e.g. 90 days). Reports or automated verdicts alone never cause a sanction. Appeals via the contact form.

**プライバシーポリシー追記（案）** — リンクを付けた投稿では、そのリンク（#以降を除く）を Google Cloud Web Risk に送り、危険の可能性があるか確かめます（当サイトはリンク先のページを読みこみません。Google 側での扱いは Web Risk の利用規約・データの取り扱いによります：公開前に要確認）。確認の結果は最長60分（危険の判定は最長24時間）保存します。利用停止の運用のため、ログインに使った確認済みメールアドレスを、鍵つきの一方向の変換（HMAC-SHA-256）をした値だけで保存します（メールアドレスそのものは保存しません）。アカウントを削除するとこの対応は消えますが、意図的な攻撃で利用を止めた記録は、再登録を防ぐため［保存期間：要決定］保存します。

**Privacy (draft, EN)** — For posts with a link, the link (without the #fragment) is sent to Google Cloud Web Risk to check for known threats; we never fetch the page (how Google processes submitted URLs is governed by the Web Risk terms — to be verified before release). Verdicts are kept up to 60 minutes (threat verdicts up to 24 hours). For moderation we store only a keyed one-way hash (HMAC-SHA-256) of your verified sign-in email, never the address itself. Deleting your account removes this association, but records of sanctions for confirmed intentional attacks are kept for [retention period: to be decided] to prevent re-registration.
