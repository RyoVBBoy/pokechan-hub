# Game Kid/s Feed V3.2 — hybrid of production and V3.1

Date: 2026-11-17 · Scope: **Feed only**, PC/mobile × dark/light. Design preview, not production code.
Prototype: `index.html` (built from `src/feed.template.html` by `src/build.py`). V1/V2/V3/V3.1 are unchanged.

## 1. What was compared
- **Production.** I built `src/` into a scratch folder (not the project's `dist/`) and opened the home feed in Chromium. All network access was blocked and `/api/tl` returned sample posts. Screenshots are in `screenshots/production-reference/`.
- **V3.1.** Source, design notes and the refined screenshots.

| | Production | V3.1 | V3.2 decision |
|---|---|---|---|
| PC structure | 3 columns: rail with big labels, 600px feed, right column (search, すぐ使う, コミュニティ) | 3 columns, bigger rail with game card | **Production's**: same rail items, same "⚡ 相性を調べる" quick-action button, right column with search and すぐ使う |
| Tabs | みんな／フォロー中, two equal halves | segmented pill at top right | **Production's** two halves; a quiet underline marks the active tab |
| Composer | small card, expands as you type | large card with toolbar always visible | **Production's** size: one line, the extra tools appear on focus |
| Posts | each post a glass card with a 1px border, 13px text | each post an elevated card | **Neither**: one reading surface with posts as rows (no box), separated by a faint line starting at the text column |
| Data | none | sigils and modules everywhere | **V3.1's**, but only in posts that carry data (4 of 8 samples) |
| Mobile compose | floating hexagon over the feed | in the tab bar | **In the tab bar** (never covers posts) |
| Mobile top | avatar and logo, tabs | one compact row | **Production's** avatar / logo / (background) row and tabs; it hides when you scroll down |
| Dark canvas | pure black + glow | slate | near-black `#0E0F14` + the same top-right glow (the slate-vs-black decision is still open) |

## 2. Visual rules
- **Three surfaces only:** canvas → reading sheet (feed column, side panels) → well (modules inside posts). No card borders, no heavy shadows. Only menus and sheets are raised.
- **Purple** is used only for the primary button, the active tab and nav icon, hashtags, the like/bookmark hover tint and the focus ring.
- **Type colours** appear only inside data: name chips, sigils, the move dot, and bars in modules. They never tint the interface.
- **Typography:**
  - body 14.5px with line height 1.65 (15px on mobile), slightly larger than production's 13px for easier reading;
  - name 14.5px bold and metadata 13px in the third text tone, on one line;
  - tabular numbers in all data.
- **Text contrast (computed):**
  - dark: body 15.8:1, secondary 9.2:1, metadata 6.2:1;
  - light: 17.2, 8.3 and 5.7:1;
  - metadata inside modules: 5.4:1 or better.
- **Motion:** only the like heart, a new post's tint and the top bar sliding. All of it is disabled under reduced motion.

## 3. Data modules (V3.1, made lighter)
Modules sit on the "well" surface inside the post. They are not separate widgets, and plain text posts never get one.

| Module | Shown | Light-weight treatment |
|---|---|---|
| Party | posts that share a team | 6 sigils with names. Mobile: 2×3 grid with full names. Header shows the disclosure ("ポケモンだけ公開"); footer shows the snapshot date and "このパーティを使う" (V2 decisions). |
| Weakness overlap | inside the party module | **Collapsed by default** to one line: the types two or more members are weak to, as small chips. Tap to open the 18-type strip (mobile: 2×9) with a legend and the "タイプ相性だけ・特性は含まない" note. |
| Damage | posts that share a calc | Attacker → defender, move chip, % range, KO verdict, 16-roll bars and HP bar, all compact. |
| Speed | posts that compare speed | Fixed columns: name / bar / value / ≈ for near-ties, explained once. |
| Record | posts that share a result | WIN/LOSE tile, both selections as small sigils (fainted greyed), rating marked 自己申告. |

The sigil system and game-pack data structure are kept from V3.1. This prototype shows only the Pokémon pack.

## 4. Custom background images
- **Presets:** 光 (default, production's glow), メッシュ, 無地, ノイズ, plus your own image with an intensity slider.
- **Readability over images:**
  - the reading sheet becomes more opaque as the image gets stronger (88% to 97%);
  - the left menu gets its own sheet when an image is active;
  - side panels use the stronger sheet.
- **Worst case (computed):** a pure white or black image pixel at the lowest sheet opacity still gives body text 10:1 or more and metadata 4.5:1 or more.
- **No heavy glass.** Only the sticky tab header and the mobile tab bar use blur.
- **Sync rule (D6):** the image stays on the device; the preset syncs.

## 5. Mobile, designed for phones
- **Top area:** avatar (menu), logo, background button; then tabs and categories. It slides away while scrolling down and returns on the way up.
- **Posts:** full-width rows with 40px avatars and a 15px body. Every action is a 44px target.
- **Bottom tab bar:** 56px tall (production's floating style, lighter). The compose hexagon is inside the bar, so the feed's bottom padding always keeps the last post clear.

## 6. Functional vs visual-only
- **Works in the preview:**
  - the variant switch;
  - みんな/フォロー中 and the category filter;
  - composer: expands on focus, category menu, counter near the limit, posting with one-time name chips;
  - like and bookmark;
  - weakness detail open/close;
  - backgrounds (4 presets and image with intensity);
  - mobile compose and background sheets; Esc closes.
- **Visual only (shows a 「見本」 message):** navigation to other screens, reply, repost, share, the "…" menu, the ⚡ quick action, tools, image and party attachment, and "このパーティを使う".

## 7. Open items
- Not checked on a real iPhone (safe areas are simulated in the frame).
- Owner decisions still open:
  - dark canvas (pure black or near-black);
  - whether weakness overlap should start collapsed (recommended);
  - the larger body text size (14.5px versus production's 13px);
  - the plan's U1–U11 and the V3 / V3.1 decision lists.
- Category chips follow the approved plan (they replace the old shortcuts) but are not built in production yet.
