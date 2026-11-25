# Secure link posting — implementation report

Branch: `feature/secure-link-posting`. Base (pinned main): `31ed89eae41352fbac330f9f5ba84cc1c5d4e6c2`. Handoff: `docs/secure-link-posting-handoff.md`. Config/rollback/policy drafts: `docs/secure-link-posting-runbook.md`.
**Status: implemented, all flags OFF by default, NOT released. Independent review and owner approval required (§7).**

## 1. Concurrent changes checked (2026-11-25)
`origin/main` = base `31ed89e` (no newer commits). Open PRs: #1, #2 (calc/diagnosis audits), #3 (desktop right-sidebar search), #4 (quick-access stars). None touch `worker/src/{social,community,auth}.js`, `32-timeline.js` or the D1 mock in the same places; re-check at merge time. No unrelated files edited.

## 2. Ingress / render / authorization map
| Path | Before | After |
|---|---|---|
| `POST /api/notes` (notes + replies) | `ngCheck` rejects any URL-ish text | Flag OFF: identical; explicit `url` field → 400 (never silently dropped). Flag ON: one HTTPS link (field or a single inline token), validated (`lkValidate`), remaining text still passes legacy `ngCheck`, Web Risk last, note + `note_links` row written in one D1 batch. |
| Feeds: `/api/tl`, `/api/notes/:id`, `/replies`, `/api/u/:h/notes`, `/api/search`, `/api/me/bookmarks`, reposts | `NOTE_COLS` | `NOTE_COLS` adds `ulink` from `note_links` of the original note; same visibility filters (`NOTE_JOIN`/`NOTE_OK`). `lkOut` emits URL only for `state=ok` and re-validated rows; otherwise `{state:'blocked'}`. |
| `POST /api/links/:id/open` | — | Flag `LINKS_CLICK`; per-viewer atomic rate limit; visibility re-checked with `NOTE_OK`; state `ok`; re-validates URL; re-checks verdict if expired; returns JSON `{url,host}` (no redirect endpoint). |
| `GET /api/links/config` | — | `{post,click}` from server variables only. |
| Report `POST /api/notes/:id/report` | 3 reports hide | unchanged + bounded re-check of the link (only if verdict >10 min old); never sanctions. New reason「フィッシング・危険なリンク」. |
| Admin `/api/admin/links*`, `/api/admin/sanctions*` | — | Existing `ADMIN_TOKEN` auth + brute-force lockout; reason (≥4 chars) and explicit confirmation required; logged in `link_events`/`sanction_events` and existing `admin_log`. |
| Every authenticated request (`api()` entry) | per-route `authOf` | `sanctionGate` before any route (media, AI reads, replay, DM, sync, push, ladder, contact …): active sanction → non-GET 403, `/api/me*` 403, other GET treated as anonymous; store unreadable → writes 503. |
| `/api/admin/ban` | sets 0/1 | `on:false` keeps `banned=2` if an active sanction exists. |
| DM / group DM / boards / lobby / profile | URL banned | **unchanged** (`dmOutside`, `ngCheck` untouched; `ngCheck` = legacy URL ban + new `ngWords`). |
| Bot links `notes.link`, Tips | trusted bot rendering | unchanged; users cannot write `notes.link`. |

## 3. Validation order (server, authoritative)
Per-UID attempt slot (counts rejected attempts; atomic single-statement INSERT…SELECT: 10 s gap, 12/h, 40/day) → feature prerequisites (SANCTIONS_ON, email key) → token `email_verified` + record HMAC → `lkValidate`: type → length ≤2048 UTF-8 bytes **before** any normalization → printable ASCII only (rejects controls, spaces, bidi/zero-width, full-width, raw non-ASCII/IDN) → no `\` and no `"<>\`{}|^` → scheme exactly `https://` → no userinfo, no explicit port, no `%` in host, well-formed percent-encoding → decoded form free of controls/bidi/zero-width/backslash → WHATWG `URL` parse → input host must equal parsed host (catches `0x7f.1`, trailing dots, etc.) → not IP literal, ≥2 labels, LDH labels, alphabetic or `xn--` TLD → not internal/reserved suffixes, shorteners, external-contact hosts → no redirect-looking params/path, no sensitive params (query and fragment) → NG words on decoded URL → canonical `URL.href` re-checked ≤2048. Inline extraction: exactly one `https?://` ASCII token, trailing punctuation returned to text, must be delimited; >1 → reject; remaining text must pass legacy `ngCheck` (so bare/obfuscated domains and second links are rejected). Stored: canonical href (with fragment). Sent to Web Risk: canonical href **without** fragment.

## 4. Threat checks
Adapter `lkThreat`: fixed endpoint, key in header only, `redirect:'manual'`, timeout, 8 KB capped streaming read, strict response schema (only `threat`, known threat types, parseable `expireTime`), all four threat types requested, per-isolate concurrency 4, atomic global daily counter, bounded cache (clean ≤ `LINKS_CLEAN_TTL_MIN`, unsafe ≤24 h and ≥10 min; ≤5000 rows). Any error/timeout/quota/malformed/missing key → link refused (503) or left inert; non-link posts unaffected. No destination fetch anywhere (asserted in tests by recording every outbound request).

## 5. Moderation and verified-email registry
`sanctions` (kind uid/email, permanent or `expires_at`, reason, evidence id, source, actor = salted hash of admin IP, status, appeal, parent), `sanction_events` (audit). Perpetrator: permanent UID sanction + permanent email tombstones for every recorded verified-email hash of that UID; none recorded → `email:'unresolved'` (no invented association). Linked/temporary: 90 days default or 3–6 calendar months. Enforcement independent of flags; expiry sweep hourly (cron `0 * * * *`), on the user's own writes, and in periodic cleanup — only `banned=2` ever returns to 0. Email: Firebase-verified claim only (never request body); normalization = trim, NFC, lowercase whole address, IDN domain → ASCII, **no** plus/dot folding; HMAC-SHA-256 with versioned key and previous-key rotation (auto re-key). Deleting an account removes `user_emails`; sanctions persist. Firebase-side account disable/revocation is **not** implemented: this provides service-side denial only (see §7).

## 6. Test evidence (this environment, 2026-11-25)
Commands (both runs): `npm install` · `node tools/build.mjs` · `python3 worker/build.py` · `SITE_URL=https://example.invalid node tools/gen-pages.cjs` · `CHROMIUM=/opt/pw-browsers/chromium node tests/run.mjs` (CHROMIUM needed because the preinstalled browser differs from the pinned Playwright build).
* Baseline: clean git worktree at `31ed89e` → build exit 0, `すべてのテストに合格しました`, 44/44 suites, calc-ref 1500/1500.
* Candidate: implementation commits on this branch → build exit 0, `すべてのテストに合格しました`, 47/47 suites, calc-ref 1500/1500.
* Every pre-existing suite has the same assertion count as baseline except `social` 287 → 292 (added flag OFF/ON checks; original URL-rejection assertion kept). New: `links` 231, `links-migrate` 8, `links-ui` 70 (390 px and 1280 px).
* Not run here: the new `.github/workflows/pr-tests.yml` (runs on GitHub after push; check the PR's Checks tab). Real Google Web Risk, real Firebase and production D1 were never contacted.

## 7. Release blockers (all open)
1. Independent security review (handoff requires GPT review) of `worker/src/links.js`, `src/js/87-ulink.js`, gate changes in `community.js`/`auth.js`/`social.js`.
2. Owner approval: rules/privacy text (drafts in runbook §5; current `#/rules` still says links are banned and must be updated in the same release), third-party data transfer to Google Cloud Web Risk, retention period for tombstones, linked-account duration (90 days vs 3–6 months), SNS/contact host policy (only messaging/invite hosts are blocked; X/Instagram profile links are allowed).
3. Web Risk commercial credentials, quota and cost; confirm current API response contract against the live docs (implemented from the documented `uris.search` shape; not exercised against the real service here — this environment cannot reach it and no credentials were used).
4. Firebase Admin disable/revoke is not implemented; true prevention of Firebase account creation needs separate auth infrastructure.
5. Shared-IP / fingerprinting: not used by design; any "linked account" determination is manual and evidence-based.
6. Known limitations: per-isolate concurrency (not global); clean verdicts may be served from cache for up to the TTL; admin actor identity is a salted IP hash (shared `ADMIN_TOKEN`, no per-admin accounts); legacy non-link note rate limit (15 s) remains count-then-insert (pre-existing); email change keeps old hashes associated (by design, for tombstones).
