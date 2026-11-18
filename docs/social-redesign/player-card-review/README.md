# Profile & game card — review guide

The profile has two parts:
- **The ordinary profile** (`#/u/ID`) is short: identity, bio, join date, counts, and then posts and images straight away.
- **The game card** uses the V3.4 esports design. It is optional and opens on top of the profile. Closing it returns to the same place.

All people and results below are **test data** (`tests/fixtures/pcard-users.mjs`). Nothing here touches production.

## Look without running anything
`screenshots/`, all at 2×:
- `<handle>-390.png` and `<handle>-1280.png`: the profile's first screen. `-full` is the whole page.
- `<handle>-390-card.png` and `<handle>-1280-card.png`: the game card when open. `-card-full` is the whole card.

| Handle | State |
|---|---|
| `ren` | Public account with a game card: verified and self-reported results, partner, showcase team |
| `yui` | Game card with **no results**: game, partner and showcase only. No record section, no 「なし」 |
| `akari` | Verified results only, including a rate-only row |
| `sora` | Self-reported results only: no 最高位 headline |
| `minato` | Owner view. The account is private, so the card shows 「フォロワーのみ」 |
| `nao` | The game card is set to 「自分だけ」: visitors see no entry and no trace of it |
| `riku` | No game card. Tapping the avatar shows it large (initial letter) |
| `mio` | Photo avatar, no game card. Tapping the avatar opens the site's existing image viewer |
| `kagi` | Private account seen by a non-follower: no card entry, one 「非公開」 notice |
| `hajime` | Brand-new owner: only a small 「ゲームカードを作る」 button |

## Open it in a browser (Node.js 22+)
From the repository root:
```
npm install
node tools/build.mjs
node tools/pcard-review.mjs
```
Then open `http://localhost:8790/#/u/ren`. The other handles are listed in the terminal. Narrow the window below 700px for the phone layout.

To retake the screenshots: `node tools/pcard-review.mjs shots` (needs `npx playwright install chromium`).

## What to look at
1. **Ordinary profile:**
   - more space between avatar, name, @ID, bio, join date and counts;
   - posts visible on the first phone screen;
   - no game details on the page itself.
2. **Game card entry:** one quiet row (emblem · 「ゲームカード」 · game · partner · ›), shown only when a card exists and the visitor may see it. Tapping the avatar opens the card too.
3. **Game card:**
   - the avatar as player portrait (96px) on the purple geometric cover;
   - the game plate;
   - the bio as the self-introduction;
   - the record: latest three verified results plus 「もっと見る」, with self-reported results separate;
   - the showcase party as 3×2 with 48px symbols and 13px names.

   It opens over the page: full screen on phones, centred on desktop. ✕, Esc, tapping outside on desktop, or navigating all close it.
4. **No card:** tapping the avatar enlarges it. Users without results are never shown an empty record.

## Added in this round
- **Explicit card creation.** A card exists only after its owner taps 「ゲームカードを作る」 and saves. Results, partner or showcase alone never create one. `kenta` has results but no card, so there's no entry and no ring.
- **Back closes only the card.** The profile underneath keeps its place, and repeated open/close adds no history.
- **Editor from the card.** Cancel returns to the same card. Save returns to the card with the new content.
- **Card ring.** Avatars of people whose card the viewer may see get a static, six-segment purple ring (`.gk-cr`, tokens `--gk-cardring`/`--gk-cardring-2`). It shows on the profile, posts, search, notifications and follower lists.
- **Notification bell.** At the right end of the home header, linking to the existing お知らせ screen (`#/notif`), with a small count only when there are unread notifications.

Screenshots for these:
- `home-<width>-<dark|light>.png`: home with the bell.
- `home-<width>-<theme>-unread-sample.png`: the same, with a **sample** count of 3. The test called the badge function directly; this isn't real data.
- `ren-<width>-light.png` and `ren-<width>-light-card.png`: light theme.
- Any profile or feed shot of `ren`, `yui`, `akari`, `sora` or `minato`: the ring. Compare with `kenta`, `riku`, `nao` and `mio` (no ring).

## Files
- `src/js/53-profile.js`:
  - `gkcHTML`: the ordinary profile;
  - `gkcOpen`/`gkcCardHTML`: the card overlay;
  - `gkcAvatarView`: the avatar enlargement;
  - `gkcCardOf`: whether a card exists and is visible.
- `src/styles.css`: the last two blocks (`gkc-*` for the card, `gkp-*`/`gkcm`/`gkl` for the profile and overlay).
- `worker/src/social.js`: `/api/u` adds `games.pokechamp.created`.
- Reference designs: `docs/social-redesign/v3.4/` (unchanged). Rules: `docs/social-redesign/player-card-ia.md`.
