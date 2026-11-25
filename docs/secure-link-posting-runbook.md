# Secure link posting — configuration, rollback and policy drafts

Status: implemented on `feature/secure-link-posting`, **all flags OFF by default, not released**. Do not enable in production until every gate in `docs/secure-link-posting-report.md` §7 is closed.

## 1. Server flags and secrets (Cloudflare Worker settings — names only)

| Name | Kind | Default | Effect |
|---|---|---|---|
| `LINKS_POST` | variable | unset (OFF) | `1` = authenticated timeline notes/replies may carry one HTTPS link. Also requires `SANCTIONS_ON=1`, a valid `EMAIL_HMAC_KEY` and `WEBRISK_API_KEY`; otherwise link posts are refused (503) and plain posts are unaffected. |
| `LINKS_CLICK` | variable | unset (OFF) | `1` = `POST /api/links/:id/open` returns the destination after re-checking visibility, state and a fresh verdict. OFF = every link is inert text. |
| `SANCTIONS_ON` | variable | unset (OFF) | `1` = admin can create sanctions; the verified-email registry (HMAC hashes) starts recording. **Existing active sanctions are enforced regardless of this flag.** |
| `WEBRISK_API_KEY` | secret | unset | Google Cloud Web Risk Lookup API key. Sent only in the `x-goog-api-key` header to the fixed endpoint `https://webrisk.googleapis.com/v1/uris:search`. Never returned to clients or logged. |
| `EMAIL_HMAC_KEY` | secret | unset | ≥32 chars. HMAC-SHA-256 key for normalized verified emails. Shorter values are treated as missing. |
| `EMAIL_HMAC_KEY_VER` | variable | `v1` | Label stored with each hash. |
| `EMAIL_HMAC_KEY_PREV` / `EMAIL_HMAC_KEY_PREV_VER` | secret / variable | unset / `v0` | Previous key during rotation (see §3). |
| `LINKS_WEBRISK_DAY` | variable | `5000` | Global daily cap on provider calls (atomic counter in D1). |
| `LINKS_WEBRISK_MS` | variable | `3000` | Provider timeout (clamped 500–5000 ms). |
| `LINKS_CLEAN_TTL_MIN` | variable | `30` | Local maximum lifetime of a "no match" verdict (clamped 5–60 min). |

No new binding is required; all new tables live in the existing D1 (`DB`).

## 2. Enabling (only after the release gates)
1. Set `EMAIL_HMAC_KEY` (random, ≥32 chars) and `WEBRISK_API_KEY` as **secrets**.
2. `SANCTIONS_ON=1` first; observe for a day (email hashes recorded for verified sign-ins on writes and `GET /api/me`).
3. `LINKS_CLICK=1`, then `LINKS_POST=1`. `GET /api/links/config` must return `{"post":true,"click":true}`.
4. Apply the approved rules/privacy text (§5) in the same release.

## 3. Rollback / kill switch
* **Stop new links**: unset `LINKS_POST`. Old clients and the composer return to the legacy behaviour (inline URLs rejected by the existing filter; an explicit `url` field is rejected, never silently dropped). Existing posts and `note_links` rows are kept.
* **Stop opening links**: unset `LINKS_CLICK`. All links render as inert text immediately (server refuses `open`; the UI turns the button inert on 403/410).
* **Never** delete `sanctions`, `sanction_events`, `note_links`, `link_events` to roll back. Unsetting `SANCTIONS_ON` stops *creating* sanctions and recording email hashes; it does **not** lift active sanctions (enforcement is independent of the flag, by design).
* To lift one sanction: admin tab「リンク・利用停止の記録」→ 取り消す (reason + confirmation; writes `sanction_events`). The legacy `/api/admin/ban {on:false}` only removes the *manual* ban (`banned=1`); if an active sanction exists the account stays at `banned=2`.
* Mixed versions: an old site against the new Worker ignores `ulink` and never sends `url`; a new site against an old Worker gets 404 for `/api/links/config` → link UI hidden. Old Worker + new tables: tables are additive; old code ignores them.
* Key rotation: set new key as `EMAIL_HMAC_KEY` (+`_VER`), move old to `EMAIL_HMAC_KEY_PREV` (+`_PREV_VER`). Matches on the old key are copied forward under the new key automatically (`source='rekey'`). After all relevant hashes have been re-seen (or after the retention window), remove `_PREV`. Losing the key makes email tombstones unverifiable → authenticated requests fail closed (503) while any email sanction is active; restore the key.

## 4. Data model (additive, idempotent `CREATE TABLE IF NOT EXISTS`)
`note_links` (user link per note; separate from bot `notes.link`), `link_verdicts` (bounded cache, ≤5000 rows), `link_attempts`, `link_clicks`, `link_quota`, `link_events` (no full URLs; host + 16-hex hash prefix + short code; 180 days), `sanctions`, `sanction_events`, `user_emails` (uid ↔ HMAC hash; deleted with the account). `users.banned` gains value `2` = sanction-derived (0 normal, 1 manual).

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
