# Game Kid/s social redesign plan (final draft for owner review)

Status: **design only — not implemented**. Nothing in `src/`, `worker/`, `functions/`, tests or the database schema has been changed for this plan.
Visual prototype: `docs/social-redesign/prototype/index.html` (v2, non-functional design preview; v1 kept as `prototype/v1.html`). How to open it: `docs/social-redesign/README.md`. UX rationale: `docs/social-redesign/design-notes.md`.

Date: 2026-11-17

---

## 0. Where this plan comes from

No earlier written version of the social redesign plan exists in the repository or in the owner's artifacts. This document therefore records:

- the six decisions the owner approved on 2026-11-17 (section 2),
- the design constraints given with them (section 3),
- the current behaviour it builds on, taken from `CLAUDE.md` and the code (section 1).

Anything not covered by those sources is listed as **unresolved** (section 7) rather than decided here.

## 1. Current state this plan builds on (unchanged, settled)

| Area | Today | Where |
|---|---|---|
| Profile | "Trainer Card": cover in partner Pokémon's type colours + stat shape, avatar ring, name/@ID/bio, joined month, stats (posts / followers / following / likes received), season results (`resultBadges`, admin "確認済み"), showcase team (Pokémon only), posts / media tabs | `53-profile.js`, `41-seasons.js` |
| Feed | Home = timeline, みんな / フォロー中, composer, post actions reply → repost → like → bookmark → share, #tags, images, link cards | `32-timeline.js`, `70-bookmarks.js`, `worker/src/social.js` |
| Categories | Battle recruitment, team consultation, questions, chat exist as hashtags (#対戦募集 #構築相談 #質問 #雑談) **plus** separate navigation entries in the left menu (対戦募集, 構築相談・質問) and rows on the Community page | `34-drawer.js`, `26-hub.js` |
| Background | Dark black / light #EEF0F5 + accent glow top-right (`body::before`), 6 accents (`ACCENTS`, `pcaccent`), glow strong/normal/off (`pcglow`) — local only | `00-i18n.js`, `styles.css` |
| Team sharing | Image card + `/t/番号-…` link (Pokémon numbers in the URL = already a stable snapshot), `#/share/…` view-only | `47-share.js`, `functions/t/` |
| Sync | `user_data` (teams, memo, favs) with per-item `at`; `pcowner` ownership; `userLocalReset` on user switch; `acForget` on logout | `33-sync.js`, `worker/src/auth.js` |
| Games | `GAMES` table, `MULTI_GAME=false` | `27-games.js` |

Identity rules that stay: circle = person, hexagon = Pokémon and the post button; no official artwork (stat shapes in type colours); glass cards without per-card blur; Japanese-first wording; not an X imitation.

## 2. Approved decisions

### D1. Ranks
- Users may add ranks themselves. These always show the label **自己申告 (Self-reported)**.
- **確認済み (Verified)** appears only after an admin has reviewed the proof screenshot. This is the existing season-results flow.
- Unverified ranks are excluded from rankings, statistics (usage aggregation, season summaries, top-team data) and any trust-based feature.
- Ranks are stored per **game ID** (from `GAMES`), **season** and **format**. Any free-text label has a length limit and passes the existing NG-word check (`ngCheck`).

### D2. Featured game
Resolution order:
1. the game the user selected;
2. otherwise, the user's most recently active game profile **that is publicly displayable**;
3. otherwise, Pokémon Champions, while it is the only game.

While only one game is supported, the setting is hidden. A private game profile must never become visible through steps 2–3.

### D3. Game selector
- `MULTI_GAME` stays `false`. The site remains Pokémon Champions–only for now.
- New profile and social logic reads the game list from `GAMES` and uses the game ID. It must not hard-code Pokémon. Pokémon-specific parts (partner Pokémon, showcase team, Pokémon name linking) live inside the Pokémon game profile.

### D4. Pokémon name linking (in post text)
- Precision is preferred over recall.
- A name links only on a normalized exact match, using the same normalization as search (`kfold`).
- Names shorter than 3 characters are never linked. Ambiguous names are excluded through a maintained exclusion list.
- Japanese and English boundaries are handled separately:
  - **English:** word boundaries (not inside a longer word).
  - **Japanese:** the match must not continue into adjacent katakana or ASCII letters. English word-boundary rules are not applied to Japanese.
- Text inside existing #hashtags and @IDs is skipped.
- Each Pokémon links at most once per post, at its first mention.
- Links open the in-app dex page (`#/p/番号`).

### D5. Backgrounds chosen before login
- If the account has **no** saved background, it adopts the setting made before login.
- If the account **has** one, the account setting wins and silently replaces the local setting. There is no merge prompt.
- This follows existing `pcowner` ownership. Data with no owner goes to the first person who logs in on that device.
- Account-specific local background data is cleared on logout (`acForget`) and on account switching (`userLocalReset`).
- Account settings (preset, accent, glow, overlay values) are kept separate from locally stored image files.

### D6. Background sync
- The small settings — preset, accent and glow — sync through the existing `user_data`, with the same per-item `at` rule as favs and memo.
- Uploaded images stay on the device only for now.

## 3. Design constraints (binding)

1. One universal **Player Card**, with optional game-specific profiles.
2. Useful existing Trainer Card features are kept: partner, cover colours and stat shape, season results, showcase team, stats, posts/media tabs.
3. Existing social features are kept unless there is a clear reason to change them.
4. The separate navigation entries for battle recruitment, team consultation, questions and chat are removed and replaced by **optional post categories**.
5. The current glow becomes a **background preset**.
6. Custom backgrounds must keep text readable, offer a live preview and perform well on mobile.
7. Team sharing requires explicit selection and a preview. Private notes and battle plans are never exposed.
8. A shared team is a **stable snapshot**: editing or deleting the original team does not change it.
9. Private game profiles are never exposed through featured-game fallback or automatic selection.
10. The distinctive Game Kid/s identity is kept; X is not imitated.
11. Existing conventions are followed, with no new architecture or dependencies unless needed.

## 4. Target experience

### 4.1 Social feed
- **Navigation.**
  - Mobile: bottom glass tab bar (ホーム・検索・ツール・パーティ・メッセージ) and the hexagonal post button.
  - Desktop: left rail and right column, as today.
  - Left menu: the entries 対戦募集 and 構築相談・質問 are **removed**. The Community page drops its four hashtag rows and links to the feed category filter instead.
- **Categories.** One optional category per post, chosen from the four existing ones: 対戦募集 / 構築相談 / 質問 / 雑談 ("none" is the default). The feed gets a category chip row (すべて + the four) above the posts. A post shows its category as a small label above the text.
- **Composer.** Unchanged, plus a category picker (optional) and an "attach a team" button (opens 4.3).
- **Post card.** Unchanged action order (reply → repost → like → bookmark → share) and sizes. New additions are only the category label, linked Pokémon names (D4) and the shared-team block (4.3).

### 4.2 Player Card
- **Universal part (every game):** cover, avatar, name, @ID, private-account lock, bio (#tags linked), joined month, stats (posts / followers / following / likes received), follow / DM / edit buttons. These come from the current Trainer Card.
- **Game profile section.** A heading with the game mark. With one game there is no switcher, and no "featured game" setting is shown.
  - Contents for Pokémon Champions: partner Pokémon, ranks and results (D1 labels), showcase team.
  - The cover colours come from the featured game profile. For Pokémon this is the partner's types, as today.
- **Rank labels.**
  - 確認済み: filled badge with a trophy.
  - 自己申告: outline badge.
  - A note on the card explains that self-reported results are not used in rankings or statistics.
- Posts / media tabs are unchanged.

### 4.3 Sharing a team in a post
1. **Select a team** explicitly from the three saved slots. Empty slots cannot be chosen.
2. **Choose the disclosure level** (proposal; see U3):
   - ポケモンだけ (default; same as today's showcase)
   - ＋持ち物・特性
   - ＋技・性格 (stat points / 能力ポイント are not included until U3 is decided)
3. **Never included**, shown as a locked box: the team's 戦術メモ (party battle notes), tactical memos, the "戦い方" text, selection plans, match records.
4. **Preview** exactly what will be posted. It updates live as the level changes.
5. **Post.** The post stores a **snapshot** of the shown fields only, with the date. The post card shows the team block, the disclosure label and "共有した時点の内容（日付）". It also offers "このパーティを使う" (copies the snapshot into a free slot, as `useTeam` does today).

### 4.4 Background customization (設定 › 表示 › 背景)
- **Presets:**
  - 光 (the current glow, default; strength 強め / ふつう)
  - 夕暮れ (gradient)
  - 六角形 (subtle hexagon pattern = brand motif)
  - なし (plain)
  - 自分の画像
- **Custom image.** Pick a file; it is shrunk on the device and stored locally only.
  - Controls: **overlay darkness** (light theme: overlay lightness), **blur**, and a **readability meter** (contrast ratio of the body text against the effective background).
  - "読みやすさを保つ" (on by default) raises the overlay to the minimum that keeps a 4.5:1 ratio.
- **Live preview.** The whole screen behind the settings page changes as controls move. A sample post card shows readability on a glass card.
- **Accent colours.** The six existing accents appear on the same page.
- **Sync notice.** The page states what syncs (preset, accent, glow) and what stays on the device (the image).
- **Mobile performance.**
  - The blur is rendered once into the stored image (canvas), not as a live CSS filter or backdrop-filter.
  - Images are shrunk to a fixed long side.
  - Post cards stay unblurred and semi-transparent, as today.

## 5. Data and storage outline (for implementation later; no schema change made)

| Item | Where | Notes |
|---|---|---|
| Ranks | Extends existing `season_teams` results / user results with `game` (default `pokechamp`) | Self-reported vs verified is the existing `verified` flag; aggregations read verified only |
| Featured game | `users` column or `user_data` field (small) | Only applies when `MULTI_GAME=true` |
| Game profile visibility | Per game profile | Needed by D2 — see U1 |
| Post category | `notes` column (one value) **or** existing `note_tags` | See U2 |
| Shared-team snapshot | Stored with the post (JSON of the allowed fields + date) | Must not reference the live team slot |
| Background settings | `user_data` field `bg` = {preset, accent, glow, overlay, blur, at} | Same `at` merge as favs and memo; local key separate from the image |
| Background image | IndexedDB on the device | Not synced; cleared by `acForget` / `userLocalReset` |

## 6. Rollout order (suggestion, each step tested and reviewed)

1. Categories and navigation cleanup (removes the separate entries; old #tag searches keep working).
2. Pokémon name linking (D4) with the exclusion list.
3. Background presets + sync of the small settings (D5, D6), then custom images.
4. Team sharing with disclosure levels and snapshots.
5. Player Card restructure (universal part + game profile, D1 labels, D2 logic behind `MULTI_GAME`).

## 7. Unresolved — needs the owner's decision before implementation

- **U1. Game profile visibility.** D2 depends on knowing whether a game profile is "publicly displayable". Open questions:
  - Is visibility a per-game-profile switch, or does it only follow the account's private (鍵垢) setting?
  - Is a new game profile public or private by default?
- **U2. Category storage.** Option A: store the category as a field on the post. Option B: keep using the existing hashtags (#対戦募集 etc.) behind the picker. Also open:
  - Should old posts that used those hashtags appear under the category filter?
  - Should a category add the hashtag to the text automatically?
- **U3. Disclosure levels.** Confirm the three levels above. Confirm whether 能力ポイント (stat points) and 性格 (nature) belong in the highest level or should never be shared.
- **U4. Custom image on other devices.** When the synced preset is "自分の画像" but this device has no image, should it show 光 (proposed) or なし?
- **U5. Exclusion list contents.** Which names count as ambiguous (e.g. names that are also everyday words) and who maintains the list. Also, does linking apply to English names only when the site is shown in English?
- **U6. "Most recently active".** What counts as activity for D2 fallback — posting about the game, editing a team, or updating the profile?
- **U7. Snapshot lifetime.** When the author deletes the post, the snapshot goes with it (proposed). Should a snapshot also be removable separately, e.g. "stop sharing" while keeping the post?
- **U8. Rank self-report scope.** Can self-reported ranks be entered on the Player Card directly? Or only through the existing season-results form with an optional screenshot (proposed, to avoid a second input path)?
- **U10. Category counts.** Should the desktop right column show post counts per category (the prototype shows them)?
- **U11. Background image limits.** Maximum size of a custom background image, and how inappropriate images are handled. They stay on the device, so moderators never see them.
- **U9. Removed navigation.** Should the 対戦募集 shortcut disappear completely, or move into the feed's category chips only (proposed: chips only)?
