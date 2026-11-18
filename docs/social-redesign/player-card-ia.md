# Game Kid/s Player Card — Phase 2: Information Architecture

Date: 2026-11-18 · Status: **IA consistent with approved decisions (revision 2)** · Scope: information architecture.
Revision 2 records the owner's answers to the eight open questions of revision 1 (§1, A17–A24) and reconciles the IA with D1–D9 (§13). §14 lists conflicts found in the uncommitted implementation and §15 the execution plan. No visual mockups.

How to read this document:
- **[Approved]** marks a requirement the owner has already approved. It is restated, not reopened.
- **[Recommended]** marks a new recommendation from this phase. It needs approval before design or implementation.
- **[Open]** marks a question that still needs the owner's decision (see §11).

---

## 0. Starting point

### 0.1 Git state when this phase started
- Branch: `claude/game-kids-redesign-decisions-4dkobg`.
- Uncommitted changes from the previous implementation session are present and were left untouched:
  - modified: `worker/src/ladder.js`, `social.js`, `auth.js`, `usage.js`; `src/js/25-admin.js`, `39-guide-mons.js`, `41-seasons.js`, `43-usage.js`, `53-profile.js`, `57-topteams.js`, `77-teambuild.js`, `80-kdcheck.js`; `tests/kodawari.mjs`, `run.mjs`, `site.mjs`, `social.mjs`, `teambuild.mjs`;
  - untracked: `tests/ranksrc.mjs`, `docs/social-redesign/` (V1–V3.3 and plan), `game-kids-social-prototype.html`.
- This phase adds only this file. V1, V2, V3, V3.1, V3.2, V3.3 and `plan.md` are unchanged.

### 0.2 Relationship to the uncommitted local work — **decided (A17)**
The earlier privacy and statistics implementation is kept uncommitted for review. It is not reverted, committed or pushed. It includes:
- server-side filtering of bio, partner, showcase, results and likes for locked viewers;
- results tagged as verified / self / article / operator, with verified-only statistics;
- an additive `game_profiles` table that holds partner and showcase per game, with the old `users` columns kept as a fallback. This is a schema addition in local code only. No production database was touched.

The architecture below is compatible with that work. Where the work and the IA disagree, §14 lists the conflict and how it is resolved.

---

## 1. Approved decisions (restated)

| # | Requirement | Source |
|---|---|---|
| A1 | One shared Player Card per user. | Phase 2 approval |
| A2 | Shared identity is separate from optional per-game profile data. | Phase 2 approval |
| A3 | Pokémon-only fields (partner, showcase) belong to the Pokémon game profile. Direction only, no migration in this phase. | Phase 2 approval, plan D3 |
| A4 | Game profiles are optional. Nobody is forced to complete a game section. | Phase 2 approval |
| A5 | Per-game visibility: public / followers only / only me. The default follows the account setting. Account privacy always wins, so a game profile is never more visible than the account. | Phase 2 approval |
| A6 | Private-account details are filtered on the server, not only hidden in the UI. | Phase 2 approval |
| A7 | Featured-game selection considers only public game activity that the viewer is allowed to see. | Phase 2 approval, plan D2, constraint 9 |
| A8 | Operator-verified, self-reported and article-derived results are clearly distinct. Article-derived data is never labelled verified. Unverified results are excluded from trust-based rankings and statistics. | Phase 2 approval, plan D1 |
| A9 | Ranks are entered only in the existing season-results form, not on the card. | Phase 2 approval (resolves U8) |
| A10 | Enforcing D1 in existing statistics is a separate task and is out of scope here. | Phase 2 approval |
| A11 | Account deletion removes personally identifiable rank records and proof materials. Retaining anonymised aggregates needs a separate policy review. | Phase 2 approval |
| A12 | Remove the likes-received count from the card. The like function stays. | Phase 2 approval |
| A13 | Block and profile reporting are in the Player Card scope. | Phase 2 approval |
| A14 | Three distinct account markers: Game Kid/s operator, bot/automated, verified external official. An operator badge never implies publisher endorsement. | Phase 2 approval |
| A15 | V3.3 is the design baseline. The card shares its principles without copying the feed layout. No official artwork, characters, logos or copyrighted assets. Original symbols, type and geometry only. | Phase 2 approval |
| A16 | Constraints 1–11 of `plan.md` §3 still apply. These include keeping partner, cover colours and stat shape, season results, showcase team, stats and the posts/media tabs, plus the stable-snapshot rule for shared teams. | plan.md |
| A17 | Keep the existing uncommitted implementation for review. Don't revert, commit or push it. | Revision 2 approval |
| A18 | **Four** rank source categories: 確認済み (verified), 自己申告 (self), 記事から集計 (article), 運営が登録 (operator). Same as D8. | Revision 2 approval |
| A19 | Account privacy takes precedence over per-game visibility. When the account becomes private, game profiles set to public become follower-only, and the owner sees a brief notice. | Revision 2 approval |
| A20 | Private users' individual rows are **hidden** from public season lists. Ranking interfaces never expose their identity or profile. | Revision 2 approval |
| A21 | Featured-game fallback uses the most recent meaningful **user-initiated** activity in a **public** game profile: a public post, a published team or a profile update. Views and automated updates don't count. A private game profile is never selected for visitors. | Revision 2 approval (resolves U6) |
| A22 | Profile reports never automatically hide or hold anything, avatars included. Moderators review and decide. | Revision 2 approval |
| A23 | The Player Card shows the **latest three** verified results, then 「もっと見る」. | Revision 2 approval |
| A24 | Neutral join-date wording: 「利用開始：YYYY年M月」. | Revision 2 approval |

---

## 2. Design answers (summary of the key recommendations)

| Question | Recommendation |
|---|---|
| **What should visitors understand within 3 seconds?** | Three things, in this order: (1) **who** this is: avatar, name, @ID, and an account marker if there is one; (2) **which game they play**: the featured game's chip and its partner symbol; (3) **what you can do**: the follow state and button. Rank credibility comes fourth, and only when a verified result exists. Self-reported results are visible but never in the first-glance zone (see §7). |
| **Minimum useful card for a new user** | Avatar (or the initial-letter fallback), name, @ID, join month, the follow button and the posts tab. No game section and no empty stat boxes. That is enough to recognise someone and follow them. |
| **Only one game** | No selector UI. The game section appears inline as a single block under the shared profile. The game's name appears once as a small label, so the structure is already multi-game ready (D3). |
| **Several game profiles** | One game section at a time. A compact row of game chips sits under the shared profile. The featured game is open, and the others are one tap away. Sections are never stacked one after another. |
| **Unverified / article results** | Verified results get the prominent slot and a filled marker: the latest three (A23), then 「もっと見る」. Self-reported results appear in a separate, visually quieter list, with the 自己申告 label on every item and no trophy fill. Article-derived (記事から集計) and operator-registered (運営が登録) rows are not attached to a Player Card at all, because they aren't linked to an account and can't be claimed. |
| **Non-follower on a private account** | Identity only: avatar, name, @ID, markers, a lock, the follower/following/post counts, and the 「フォローをリクエスト」 button. No bio, no game sections, no results, no posts, no featured game. |
| **Private or hidden game profile** | Viewers who may not see it get **no trace of it**: no chip, no "hidden" placeholder, no count. The owner sees it with a visibility badge (「自分だけ」 / 「フォロワーのみ」). |
| **Blocked users / reported profiles** | Blocked viewers see a minimal shell with no actions. Reporting is done from an overflow menu and never changes what others see by itself. Details in §8.4–8.5. |
| **Card vs feed** | The card holds *durable* identity and achievements. The feed holds *time-based* activity: team shares, analyses, damage calcs, discussions. The card links to the user's posts and doesn't duplicate them. |

---

## 3. Information hierarchy [Recommended]

From top to bottom. Each level only shows when it has content.

```
1  Identity header (shared)         avatar · name · @ID · account marker · lock
2  Relationship bar (shared)        follow / request / following · follows-you · message · ⋯ (block, report)
3  Shared profile (shared)          bio · join month · counts (posts · followers · following)
4  Game area (per game)             [game chips, only when 2+ visible games]
   4a Game header                   game label · partner symbol · cover tint from the game's palette
   4b Achievements                  verified results (prominent) · self-reported results (quiet list)
   4c Showcase                      showcase team (snapshot)
5  Content tabs (shared)            投稿 · 画像   (game filter later, see §9.4)
```

Rationale:
- Identity and relationship come first because they answer "who is this and what can I do", whatever the game.
- The game area comes after the shared profile, so that a user with no game profile still has a complete card (A4).
- Achievements come before the showcase, because they are the main trust signal. They are kept short so they don't push the posts tabs off the first screen on a phone.
- The cover band belongs to the **game area**, not the identity. Today the cover takes its colour from the Pokémon partner, which is game-specific (A3). With no visible game profile, the card falls back to the person's own colour (`avCol`) plus the theme accent, as it does today when there is no partner.

---

## 4. Section-by-section field specification

Legend:
- **Req** = required / optional.
- **Owner** = shared (`users`) or game (Pokémon game profile).
- **Edit** = user / operator / system.
- **Verify** = whether credibility depends on review.
- **Vis** = the visibility rule. *Eff* = effective visibility (§6.1).

### 4.1 Shared identity
| Field | Purpose | Req | Owner | Vis | Edit | Verify |
|---|---|---|---|---|---|---|
| Avatar (photo or initial-letter fallback) | Recognition | Optional (fallback always shown) | Shared | Everyone except where §8.4 hides it. Shown on private accounts too. | User (profile editor) | No. Moderated through reports. |
| Display name (20 chars, NG check) | Recognition | Required | Shared | Everyone | User | No |
| @ID (3–15 chars) | Unique address, mentions, links | Required | Shared | Everyone | User (rename in editor) | No |
| Account marker | Says what kind of account this is (§5) | Optional (most users have none) | Shared | Everyone | **Operator only** | Yes. Operator and official markers are granted only after a check. |
| Private (lock) indicator | Explains why content is missing | Shown when the account is private | Shared | Everyone | User (privacy setting) | No |

### 4.2 Shared profile
| Field | Purpose | Req | Owner | Vis | Edit | Verify |
|---|---|---|---|---|---|---|
| Bio (160 chars, #tags link to search) | Self-description | Optional | Shared | Account visibility: public → everyone; private → owner and approved followers | User | No |
| Join date 「利用開始：YYYY年M月」 [Approved A24] | Context and trust | System (always present) | Shared | Everyone. Harmless, helps recognition. [Recommended] | System | No |
| Post count | Activity at a glance | System | Shared | Everyone (counts only, as on X) | System | No |
| Follower / following counts (tap → list) | Social context | System | Shared | Counts: everyone. Lists follow the existing rules: private accounts' lists only for the owner and approved followers | System | No |
| ~~Likes received~~ | — | **Removed** [Approved A12] | — | — | — | — |

The join line no longer uses the Pokémon-flavoured 「トレーナー」 (A24). Game sections may use their own wording.

### 4.3 Game area: Pokémon Champions profile (first game profile)
| Field | Purpose | Req | Owner | Vis | Edit | Verify |
|---|---|---|---|---|---|---|
| Game profile exists / visibility setting | Lets the user show or hide the whole game | Optional (no profile = no section) | Game | Owner always. Others per *Eff*. | User | No |
| Partner (one Pokémon, shown as an original stat-shape symbol) | Personality, cover tint | Optional | Game | *Eff* | User | No |
| Cover tint (from the partner's types, else the person's colour) | Visual identity of the section | Derived | Game (derived) | Follows the section | System | No |
| Season results (verified): latest three, then 「もっと見る」 (A23) | Credible achievement | Optional (appears only if any exist) | Game (`season_teams`, by game · season · format) | *Eff* | Entered by the user in the **season-results form** (A9); verification by the operator | **Yes.** Only operator-reviewed results count as verified. |
| Season results (self-reported) | Lets players show results awaiting or without proof | Optional | Game | *Eff*, always with the 自己申告 label | User via the season form | No (never presented as verified) |
| Showcase team (name ≤20 + up to 6 Pokémon) | "What I play" | Optional | Game | *Eff* | User | No |
| Showcase details (items, moves, stat points, nature) | — | **Not shown on the card** | — | — | — | — |

Showcase rules [Approved through A16 / plan constraint 7–8, restated]: the user explicitly chooses it and previews it, only Pokémon are shown, and builds are never shown. **[Recommended]** Treat the showcase as a stable snapshot, the same as a shared team. Today it is stored as a list of numbers, so it already doesn't change when the saved team is edited. Keep that behaviour.

### 4.4 Future game profiles (structure only)
Each game pack (`GAMES` entry) may define up to three card slots, filled with that game's own data:
1. **identity symbol**: the equivalent of the partner;
2. **achievements**: rank or result records using the same credibility model (§7);
3. **showcase**: the equivalent of a team or loadout.

A game without a slot simply omits it. No shared field may be reused to store game data (A2, A3).

### 4.5 Relationship and actions
| Element | Purpose | Shown to | Edit | Notes |
|---|---|---|---|---|
| Follow / Request / Following / Requested | Relationship | Logged-in visitors who are not blocked; logged-out visitors see 「フォロー」 → login | System | Existing behaviour (`pfFollowTxt`) |
| 「フォローされています」 | Context | The viewer, when the card's owner follows them | System | Existing |
| Message (✉) | Start a DM | Visitors who pass `dmBlock` (private and DM-from rules) | System | Hidden rather than disabled when not allowed. [Recommended] |
| Edit profile / edit game section | Owner editing | Owner only | User | Two editors: shared (existing `profEditOpen`) and per game (existing `pfEdit`). [Recommended] |
| ⋯ menu: Block / Unblock, Report profile, Copy link | Safety | Logged-in non-owners (copy link: everyone) | User | New. See §8.4–8.5 [Approved scope A13, details Recommended] |

### 4.6 Posts and media
| Element | Purpose | Vis | Notes |
|---|---|---|---|
| 投稿 tab (posts and reposts) | Activity | Account visibility (existing `VIS` rule) | Existing |
| 画像 tab | Visual activity | Same | Existing |
| Game filter on tabs | Narrow posts by game | Same | **Later**: only when `MULTI_GAME` is true and posts carry a game ID (§9.4). Not now. |
| Pinned post | — | — | **Not recommended now.** It adds an editing surface without a clear need. |

---

## 5. Account markers [Approved A14; presentation Recommended]

| Marker | Who | Granted by | Label (text always present, not just an icon) | Must never |
|---|---|---|---|---|
| **Game Kid/s operator** | The site's operator account(s) | Operator (server-side flag) | 「Game Kid/s 運営」 | Imply that a game publisher endorses Game Kid/s. Never placed next to a game logo, and never shown inside a game section. |
| **Bot / automated** | `@news_bot`, `@ranking_bot`, future bots | System (uid prefix `bot:`) | 「自動投稿」, plus a one-line explanation of what it posts. Bots that relay official news also say 「非公式」 | Look like an official account. `@news_bot` relays official news but is **not** official. |
| **Verified external official** | An actual publisher or official account, only after its official status is verified | Operator, after verification | 「公式（ゲーム名）」 | Be granted without verification. **None exist today.** |

Rules [Recommended]:
- Each marker has its own original shape: operator = a geometric house mark, bot = a gear outline, official = a check inside a game-coloured ring. None of them uses a publisher logo (A15).
- A marker is never a rank or skill signal. Rank credibility (§7) uses a different visual language.
- At most one marker per account. Bots run by the operator show the bot marker, not the operator marker, because the bot marker better describes what the account does.

---

## 6. Privacy and visibility

### 6.1 Effective visibility [Approved A5, formalised]
```
account:  public | private
game:     inherit (default) | public | followers | only_me
Eff(game) = the most restrictive of (account, game)
   public  account + inherit  → public
   private account + inherit  → followers
   private account + public   → followers   (account wins, A5)
   any     account + only_me  → only me
```
- "Followers" always means **approved** followers (`follows.ok=1`). A pending request doesn't count.
- **Account becomes private [Approved A19]:** a game profile stored as `public` is served as followers-only while the account is private. The stored value is kept, so making the account public again restores it. The owner's game-visibility setting shows a one-line notice: 「アカウントが非公開のため、このゲームのプロフィールはフォロワーのみに表示されています」.
- The server filters every field marked *Eff* or account-visibility before sending a response (A6). This applies to the profile API and to every other route that exposes the same data: search results, follower lists, season-results lists, featured-game resolution and post embeds.

### 6.2 Visibility matrix: public account
Columns: **Owner**, **Visitor** (logged out or logged-in non-follower), **Follower** (approved), **Blocked** (a viewer the owner has blocked, or who has blocked the owner, §8.4).

| Field | Owner | Visitor | Follower | Blocked |
|---|---|---|---|---|
| Avatar, name, @ID, marker | ✓ | ✓ | ✓ | ✓ (minimal shell) |
| Bio, join month | ✓ | ✓ | ✓ | — |
| Counts | ✓ | ✓ | ✓ | — |
| Game section, game = inherit/public | ✓ | ✓ | ✓ | — |
| Game section, game = followers | ✓ (badge) | — (no trace) | ✓ | — |
| Game section, game = only me | ✓ (badge) | — (no trace) | — (no trace) | — |
| Verified results | ✓ | per game *Eff* | per game *Eff* | — |
| Self-reported results | ✓ | per game *Eff*, labelled | per game *Eff*, labelled | — |
| Showcase | ✓ | per game *Eff* | per game *Eff* | — |
| Posts / media | ✓ | ✓ | ✓ | — |
| Follow / message / ⋯ | edit only | follow (login), message per `dmBlock`, ⋯ | following, message, ⋯ | Unblock (if they blocked); nothing otherwise |

### 6.3 Visibility matrix: private account
| Field | Owner | Visitor (incl. pending request) | Follower (approved) | Blocked |
|---|---|---|---|---|
| Avatar, name, @ID, marker, lock | ✓ | ✓ | ✓ | ✓ (minimal shell) |
| Bio | ✓ | — | ✓ | — |
| Join date (利用開始) | ✓ | ✓ [Recommended: harmless, helps recognition] | ✓ | — |
| Counts | ✓ | ✓ (as on X) | ✓ | — |
| Any game section | ✓ | — (no trace) | per game *Eff* (at most followers) | — |
| Results, showcase | ✓ | — | per game *Eff* | — |
| Featured game | ✓ | — (not computed for this viewer) | from games visible to them | — |
| Posts / media | ✓ | 「このアカウントは非公開です」 | ✓ | — |
| Actions | edit | Request / Requested | Following, message | — |

### 6.4 What a visitor should never be able to infer
- That a hidden game profile exists. Chip counts, "N games" labels and empty placeholders all count only visible games.
- Hidden results: no "+2 more" based on hidden items.
- A private user's results from season lists. **[Approved A20]** Their individual rows are removed from what an unauthorised viewer receives: no anonymised row, no rank, no team. The owner and approved followers still see the row. Because the rows are left out, the counts and "most used" figures that viewer receives leave them out too, so a lone row can't be reconstructed from the aggregate (§14, C1).

---

## 7. Rank credibility presentation [Approved A8–A9; presentation Recommended]

### 7.1 Categories
| Category | Can appear on a Player Card? | Presentation on the card | Counts in trust-based stats |
|---|---|---|---|
| **Operator-verified** (確認済み): proof reviewed and the review recorded | Yes | Prominent slot. Filled marker 「確認済み」. **Latest three** by season (A23), then 「もっと見る」. | Yes |
| **Self-reported** (自己申告): including results awaiting first review or re-review | Yes | Separate quiet list under 「自己申告の実績」: outline style, no trophy fill, 自己申告 on every item, collapsed after 3. | No |
| **Article-derived** (記事から集計) | **No.** These rows are linked to a player name from an article, not to an account. Attaching them would let anyone claim someone else's result. | Only on season pages, labelled with source links | No |
| **Operator-registered** (運営が登録, no proof reviewed) | **No** (no account link) | Only on season pages, labelled | No |

All four categories are approved and distinct (A18, D8). 運営が登録 is never merged into 確認済み or 自己申告.

### 7.2 Rules
1. Credibility text is always written out. Colour or shape alone never carries it, so it stays readable when screenshotted or shared.
2. The verified slot never mixes in self-reported items, even if the user has no verified results. In that case the slot is not shown at all.
3. A result that loses its verification (edited, or proof replaced) moves to the self-reported list right away. The owner sees 「再確認待ち」. Visitors just see 自己申告.
4. Rank wording uses the existing tiers (最終1桁 / 2桁 / 3桁 / 〇位, or レート). The format (シングル/ダブル) and season are always shown, so results can't be read as all-time.
5. Results are listed per game. They never appear in the shared section.
6. A link 「この実績について」 explains in one sentence what 確認済み and 自己申告 mean and how to get verified (through the season-results form). This sets expectations without accusing anyone.
7. Reporting a false self-reported result is a report reason (§8.5). It sends the result to the operator's re-review. It doesn't remove the result automatically.

---

## 8. Empty, private and safety states

### 8.1 Owner with no game profile
- Card: identity, shared profile and tabs, then one quiet prompt in the game area: 「ゲームのプロフィールを追加」 (optional, can be dismissed).
- The prompt never blocks anything else (A4), and it disappears for visitors.

### 8.2 Visitor viewing a user with no visible game profile
- No game area at all. No 「ゲームのプロフィールがありません」 text either: an absence message would hint that something is hidden.
- The cover uses the person's own colour.

### 8.3 Empty pieces inside a visible game section
| Piece missing | Owner sees | Visitor sees |
|---|---|---|
| Partner | 「相棒を選ぶ」 link | Section without the partner symbol |
| Results | 「シーズンの結果を登録」 → season-results form | Nothing |
| Showcase | 「看板パーティを選ぶ」 | Nothing |
| All three | One combined prompt | The section is not shown at all, so no empty game header appears |

### 8.4 Block [Approved scope A13; behaviour Recommended]
- **Effect:** blocking removes follows in both directions, cancels pending requests and stops DMs and mentions/notifications between the pair. It is silent: the blocked person isn't notified.
- **Blocked viewer sees** (either direction): a minimal shell with avatar, name, @ID and marker, plus 「このアカウントのプロフィールは表示できません」. No bio, counts, game area, posts or actions. If the viewer is the one who blocked, they also get 「ブロックを解除」.
- **Owner who blocked someone**, viewing that person's card: the same shell plus 「ブロック中」 and unblock. There is no 「表示する」 override. [Recommended] It keeps the model simple and avoids accidental exposure.
- **Server-side:** blocked pairs are filtered in the profile API, search, follower lists, timelines and replies. The UI alone isn't enough (A6).
- Logged-out viewers can't be blocked. Blocking doesn't make a public account private, which is a known limitation shared with other SNSs.

### 8.5 Profile reporting [Approved scope A13; details Recommended]
- **Entry:** ⋯ → 「プロフィールを報告」 (login required, one report per reporter per profile per day).
- **Reasons:**
  - なりすまし (impersonation, including posing as an official or operator account);
  - 不適切な名前・自己紹介・画像;
  - スパム・宣伝;
  - 実績が事実と違う (false result);
  - その他.
- **Handling [Approved A22]:** reports go to the admin screen's reports tab. A report never hides or holds anything automatically, avatars included (unlike posts' 3-report rule and the post-image hold). Moderators decide whether to act: reset a name, avatar or bio, send a result to re-review, or suspend the account (existing ban).
- The reporter's identity is never shown to the reported user.

### 8.6 Suspended / deleted accounts
- Suspended: the card returns 「ユーザーが見つかりません」 (existing behaviour) to everyone except the operator.
- Deleted (A11): the card, game profiles, identifiable rank records and proof images are removed. Whether anonymised aggregates may remain is not decided here.

---

## 9. Single-game and multi-game behaviour

### 9.1 Featured game resolution [Approved D2 + A7, restated per viewer]
For each viewer, among the game profiles **visible to that viewer**:
1. the user's chosen featured game, if visible to the viewer;
2. otherwise, the **public** game profile with the most recent meaningful user-initiated activity [Approved A21]. That means a public post about the game, a published (shared) team, or an edit to that game profile. Views, sync, bot posts and other automated updates don't count;
3. otherwise, Pokémon Champions while it is the only game, if visible;
4. otherwise, none: the card has no game area.

Visible activity inside the posts tab never influences step 2 unless the post itself is visible to the viewer.

### 9.2 One visible game (today's case)
- No chips, no selector, no "featured" wording.
- The game section shows inline with a small game label, so adding a second game later changes nothing for existing users.
- The selector setting stays hidden while `MULTI_GAME=false` (D3).

### 9.3 Two or more visible games [Recommended]
- A single row of **game chips** under the shared profile. The chips are text labels with an original game symbol (never a publisher logo, A15). The featured game is first and selected.
- Only one game section is rendered at a time. Switching chips swaps the section in place, with the same motion rules as the existing in-place switches. It doesn't add history entries or scroll to the top.
- At most 4 chips are visible; the rest go behind 「ほか N」. N counts only visible games.
- A compact **summary line** on each chip is not recommended. It turns the chip row into stacked content again.
- Deep link: `#/u/ID?g=gameid` opens that section if visible. If not, it falls back to the featured game silently, without an error that reveals anything.

### 9.4 Posts in a multi-game world [Recommended, later]
- Posts stay one shared timeline. A game filter on the tabs appears only once posts carry a game ID. That is a feed decision, not a Player Card one. Until then, no filter.

---

## 10. What belongs on the card vs the feed [Recommended]

| On the card (durable, identity) | In the feed (time-based, activity) |
|---|---|
| Who the person is, markers, relationship | Posts, reposts, replies |
| Featured game, partner, showcase (snapshot) | Team-share posts with details at the chosen disclosure level |
| Verified and self-reported results (summary) | Damage calcs, weakness analyses, speed comparisons (V3.3 post types) |
| Counts (posts, followers, following) | Likes and like counts per post (A12: kept on posts) |
| Links to the posts/media tabs | Category chips (対戦募集・構築相談 etc.) |

Not on the card:
- likes received (A12);
- win rates and battle records, which are private by design (`battles` is owner-only);
- tactics memos and saved teams beyond the chosen showcase (constraint 7);
- trending tags;
- "recommended users" blocks.

---

## 11. Open questions

Revision 1's eight questions are all decided (A17–A24). What remains:

| # | Question | Why it can wait |
|---|---|---|
| R1 | Retention of anonymised aggregates after account deletion (A11). | Needs a separate privacy and policy review. Until then, deletion removes the rows, so aggregates lose them too. |
| R2 | Exact Japanese label for the battle-record dataset. D7 gives 「Game Kid/s 利用者の対戦記録で見た相手の傾向」 as an example, but the current dataset also includes opponents read from team-preview screenshots. Proposed: 「Game Kid/s 利用者の選出画面・対戦記録で見た相手の傾向」. | Wording only. Applied as proposed in §15, P2-4. Easy to change. |
| R3 | Which accounts carry the operator marker (§5), and how the external-official check is done. | No marker exists in code yet, and no official accounts exist. |
| R4 | Block details: whether to reuse the existing report table and how blocks appear in DMs and group DMs. | Implementation detail of P3 (§15). The behaviour in §8.4 is fixed. |

## 12. Rationale for the key decisions

- **No trace of hidden game profiles.** Placeholders such as 「非公開のゲーム」 leak that a hidden profile exists, and invite requests or guessing. Absence is the only state that reveals nothing.
- **Article-derived and operator-registered results stay off cards.** They aren't linked to accounts. Showing them on a card would amount to an identity claim that nobody verified.
- **Verified and self-reported results are separated, not just tagged.** One mixed list with tags lets the most impressive item look verified at a glance. Separate placement keeps the 3-second impression honest.
- **One game section at a time.** Several games stacked together would push posts off the first screen on a phone and make the card feel like a portfolio dump. Chips keep the card the same size no matter how many games someone plays.
- **The cover belongs to the game area.** Today the cover colour comes from the Pokémon partner. Moving that ownership to the game profile is what makes a non-Pokémon or no-game card coherent (A3).
- **Reports don't auto-hide profiles.** Profiles are identity. Mass-reporting someone into invisibility is a worse harm than leaving the profile up until an operator reviews it.
- **Markers are written out and never combined with game symbols.** That keeps "Game Kid/s operator" visually unrelated to any publisher (A14) and readable in screenshots.

---

## 13. Reconciliation with D1–D9 and earlier privacy decisions

| Decision | How this IA follows it |
|---|---|
| **D1** Ranks: self-reported always labelled; 確認済み only after admin review of proof; unverified excluded from trusted features; stored per game, season and format | §7: four labels written out, verified and self-reported in separate lists. Results are entered only through the season form (A9). |
| **D2** Featured game order | §9.1, per viewer and visible-only (A7). Step 2 is defined by A21. |
| **D3** `MULTI_GAME=false`; Pokémon fields live in the Pokémon game profile | §3, §4.3, §9.2: single game shown inline, no selector. Partner and showcase are game data (A3). |
| **D4** Pokémon name linking | Feed only (§10). Not part of the card. |
| **D5–D6** Backgrounds | Not part of the card IA. The card uses the person's background settings like any other screen. |
| **D7** Trusted statistics = verified only; saved-team and battle-record datasets separate and labelled | §7.1 "counts in trust-based stats" column. Labels in §15 P2-4 (R2). |
| **D8** Four sources, operator entry ≠ proof verification, article data stays an editorial source | §7.1 (A18). Article and operator rows never attach to cards. |
| **D9** Insufficient verified data → labelled fallback with the verified count | Not shown on the card. The card shows only the person's own results and never fills gaps with fallback data. |
| plan §3 constraint 7 (no private notes or builds) | §4.3: the showcase shows Pokémon only. Builds and memos never appear (§10). |
| plan §3 constraint 9 (private game profiles never exposed through featured-game fallback) | §6.4, §9.1, A21. |
| Earlier privacy fixes (server-side filtering) | A6, §6. The implementation is reviewed in §14. |

No conflict was found between D1–D9 and A1–A24.

---

## 14. Review of the uncommitted implementation against this IA

Status as of revision 2. "Fixed" means changed in the uncommitted working tree during this phase and covered by tests. Nothing has been committed.

| # | Area | Before (earlier uncommitted work) | IA requirement | Resolution |
|---|---|---|---|---|
| C1 | Season lists, private users | Rows were anonymised (「非公開のトレーナー」) but still listed, with rank and team | A20: hide the rows | **Fixed.** `ladder.js` drops the rows for unauthorised viewers before counting, so the totals and "most used" leave them out too. The owner and approved followers still see them. |
| C2 | Season lists, restricted game profile | Not considered | §6.2: results are game data, so they follow the game's effective visibility | **Fixed** [Recommended extension of A5, flagged here so it isn't a silent policy change]. Rows from game profiles set to 「自分だけ」 or 「フォロワーのみ」 are hidden from viewers who can't see that game profile. |
| C3 | Likes received | Sent for public accounts and shown as the 4th number | A12: remove from the card | **Fixed.** No longer sent by `/api/u` (the query was removed) or shown. The like function is unchanged. |
| C4 | Join date | 「〇年〇月からトレーナー」 | A24: 「利用開始：YYYY年M月」 | **Fixed** (`53-profile.js`). |
| C5 | Results on the card | All results in one list with per-item labels | A23 + §7: verified latest three + 「もっと見る」; self-reported in a separate quiet list | **Fixed** (`pfResults`). The server also refuses to attach article or operator rows to a card. |
| C6 | Per-game visibility | Not implemented: the game profile followed only the account lock | A5, A19 | **Fixed (server and editor).** Additive column `game_profiles.vis` (`inherit` by default). The effective value is computed on the server (`gameEff`), and an account set to private caps 「公開」 to followers. The owner gets `vis`, `eff` and `capped`, plus a badge and notice in the editor. Legacy rows read as `inherit`. |
| C7 | Account deletion | Rows, proofs and game profiles were deleted, but the review history rows remained | A11 | **Fixed.** `rank_reviews` rows for the user's registrations are deleted, before the registrations themselves. Review rows are also deleted when a user deletes their own registration. |
| C8 | Dataset labels | 「当サイトの利用者が保存したパーティの傾向」 / 「当サイトの集計」 | D7 labels | **Fixed** with the D7 wording and the R2 proposal for the screenshot/battle dataset, plus a "not whole-game usage" note. |
| C9 | Account markers | None in code. Bots have no visible marker. | A14, §5 | **Open → P3.** |
| C10 | Block and profile reports | Not implemented (only post reports exist) | A13, A22, §8.4–8.5 | **Open → P3.** |
| C11 | Featured game | Not computed. With one game, the server returns only `games.pokechamp`. | D2, A7, A21 | **Not needed while `MULTI_GAME=false` → P4.** The API shape (`games`) already allows it. |
| C12 | Partner/showcase migration | Dual-written to `game_profiles` and `users` | A3: direction only, no migration now | **Kept as is.** No data is moved. `users` columns are read only as a fallback. Removing them is P4. |
| C13 | Verification history access | Admin endpoints only | §7 | No change needed. |

Server-side checks already in place from the earlier work and confirmed against this IA:
- locked profiles return no bio, partner, showcase, results or game data;
- search and follower lists hide private bios;
- verified-only statistics;
- the read-only classification report.

---

## 15. Prioritised execution plan

Order: privacy and rank-data integrity first, then safety, then multi-game, then visuals. Each step: tests first, the full `node tests/run.mjs`, no commit until the owner approves.

**P1 — Done in this phase (uncommitted, tested):** C1–C8 above.
- Tests: `tests/ranksrc.mjs` (server) and new `tests/pfcard.mjs` (card UI at 390 and 1280px).

**P2 — Remaining integrity items (small; next)**
1. A one-off admin re-review queue view: filter for 「もう一度確かめる」 rows (`pending`). The data exists; this is a filter in the admin season tab.
2. A way to attach a proof screenshot to an operator row, so it can be verified (approved earlier as "safe path"). It needs an admin upload path for proof media.
3. Privacy-policy text: profile visibility per game, the removal of likes received, the review history and what account deletion removes. Owner review needed (A11 retention stays out).
4. English dictionary entries for the new labels (`97-dict-en.js`).

**P3 — Safety (A13, A14, A22)**
1. Blocks: an additive `blocks(src,dst,created_at)` table. Server filtering in profile, search, follower lists, timelines, replies, notifications and DMs. A blocked viewer gets the minimal shell (§8.4). Blocking removes follows both ways and pending requests.
2. Profile reports: reuse `reports` with `kind='user'` and the reasons in §8.5, plus an admin tab section. No automatic action (A22).
3. Account markers: a server-side role (`operator`, `bot`, `official`) set by the operator only. `bot:` uids map to bot automatically. Written labels (§5) are shown wherever a name is shown.

**P4 — Multi-game readiness (only when a second game is added)**
1. Featured-game resolution on the server per viewer (§9.1), with activity timestamps for user-initiated game activity only (A21).
2. Game chips on the card (§9.3) and per-game editors.
3. Stop dual-writing `users.partner`/`showcase` after a reviewed, reversible data copy into `game_profiles` (A3 migration, separate approval).

**P5 — Visual design of the card** on the V3.3 principles (A15), after P2–P3 are reviewed.

---

## 16. Player Card access model (2026-11-18 direction, LINE-like)

**[Approved direction]**
- **Compact identity everywhere, the full Player Card only on the dedicated profile page (`#/u/ID`).**
- The feed, replies, search, notifications and messages show avatar, name, @ID and context only.
- Tapping the avatar or the name opens the profile page. Follow, message and other buttons stay separate targets.
- The profile page uses the V3.4 Player Card and keeps every privacy rule.

### 16.1 How profile navigation works today (reviewed in the current code)

| Surface | Compact identity shown | Avatar → profile | Name → profile | Row/body target | Matches the model? |
|---|---|---|---|---|---|
| Feed, bookmarks, post detail, replies (`twHtml`) | avatar 40px, name, @ID, time | ✓ (`twAv`, with an aria-label) | ✓ (`.tw-who`) | body → the post (`#/n/…`), links excluded | ✓ |
| Reposter line, 「返信先：@ID」 | name / @ID | — | ✓ | — | ✓ |
| Search: トレーナー | avatar, name, @ID, bio | ✓ (whole row) | ✓ (whole row) | row → profile | ✓ |
| Follower / following lists (page and modal) | avatar, name, @ID, bio 2 lines, 「フォローされています」 | ✓ (row) | ✓ (row) | row → profile; follow button separate | ✓ the reference pattern |
| Follow requests | avatar, name, @ID | ✓ | ✓ | approve/decline separate | ✓ |
| Notifications: request (`freq`) | name, @ID (kind icon, no avatar) | — | ✓ | approve/decline separate | partly (no avatar) |
| Notifications: like · reply · repost · follow · approved | kind icon, name, @ID (**no avatar**) | — | **✗** whole row is one link to the post (follow: to the profile) | row → post | **✗ gap G1** |
| Messages list | avatar, name or group | — | — | row → conversation (as in LINE) | ✓ |
| 1:1 conversation | header: avatar, name, @ID | ✓ (header) | ✓ (header) | — | ✓ |
| Group conversation | header: up to 3 member avatars, group name. Messages: sender name only (text) | **✗** | **✗** | — | **✗ gap G2** |
| Season results list | name only | — | ✓ | buttons separate | ✓ (private rows are hidden, A20) |
| Left menu (own) | avatar, name, @ID | ✓ | ✓ | — | ✓ |

The full Player Card is not embedded anywhere else today. The profile route is already the only place it appears, so the direction mostly confirms the current structure.

### 16.2 Proposed smallest consistent change [Recommended]

1. **One rule, written down.** A compact identity has three parts:
   - the avatar (link to `#/u/ID`, aria-label 「〇〇のプロフィール」);
   - the name with @ID (link to `#/u/ID`);
   - context metadata as plain text, such as time, 「フォローされています」, lock or marker.

   The surrounding row or body keeps its own target: a post, a conversation or a notification. Action buttons never navigate to the profile.
2. **G1, notifications.** Change each like, reply, repost, follow and approved row from one `<a>` to a row with:
   - the actor's avatar (`twAv`, linking to the profile);
   - the name with @ID (linking to the profile);
   - the kind icon as a small badge on the avatar;
   - the rest of the row tapping through to the post, as now.

   Follow notifications still go to the profile.
3. **G2, group conversations.** Show the sender's avatar (`twAv`, 28px) at the start of each run of messages from the same person, and make the sender name a link. Messages stay dominant: no bubble-width change.
4. **The profile page:** swap the current card on `#/u/ID` for V3.4 (P5). No other screen changes.

Not proposed:
- hover cards, preview sheets or mini Player Cards on other surfaces (against "detailed identity on demand");
- linking @mentions inside post text (a separate decision, like D4);
- making the whole search row anything other than a profile link.

### 16.3 Privacy
- Compact identity uses only fields everyone may already see, including on private accounts (§6.3): avatar, name, @ID and markers.
- Whether a viewer may see game data, results, bio or posts is decided only by the profile page's server response (A6). Compact surfaces never fetch it.
- Blocked users (§8.4, P3) will show the same compact identity, but the profile page returns the minimal shell.

### 16.4 Tests to add when implemented
- Each surface: the avatar and name resolve to `#/u/ID`; the body/row resolves to its own target; buttons don't navigate.
- Notifications and group messages show the actor's avatar.
- No `.pc` (Player Card) element exists outside `#/u/`.

---

*End of Phase 2 information architecture, revision 2. Visual design (P5) waits for owner approval.*
