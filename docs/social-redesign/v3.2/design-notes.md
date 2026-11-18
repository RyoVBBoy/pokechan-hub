# Game Kid/s Feed V3.2 — hybrid feed

Date: 2026-11-17 · Scope: **Feed only**, PC/mobile × dark/light. Design preview, not production code.
Prototype: `index.html` (built from `src/feed.template.html` by `src/build.py`).
The earlier V3.2 pass from the same day is kept untouched in `first-pass/`. V1/V2/V3/V3.1 are unchanged.

---

## 1. What was inspected
- **Production.** A copy of `src/` was built in a scratch folder (the project's `dist/` was not used) and the home feed was opened in Chromium. All network access was blocked and `/api/tl` returned sample posts. Screenshots: `screenshots/production-reference/`. Source read: `32-timeline.js` (twHtml, twFeed, twComposer, tlView), `26-hub.js`, `34-drawer.js`, `27-games.js`, `styles.css`.
- **V3.1.** Template, design notes (sections 1–9) and the refined screenshots.

### Why production feels effortless (kept)
1. **One obvious place to read:** a single 600px column, with tabs at the top that split it in half (みんな / フォロー中).
2. **Compact composer:** one line with a single main button; it doesn't push the feed down.
3. **Rows that read fast:** name, @ID and time on one line, then text, then a fixed action row (reply → repost → like → bookmark → share).
4. **Navigation you never look for:** a big-label left rail with one "⚡ 相性を調べる" quick-action button (PC), and five bottom tabs (phone).
5. **Right column = tools**, not feed content.

### What production gets wrong visually (changed)
- Every post is a glass card with a 1px border, which is noisy and boxy.
- Body text is 13px.
- On phones, the floating hexagon covers post content.
- Pure-black dark mode with a strong glow.

### Which V3.1 elements really help (adopted)
- **Original symbols (sigils):** a type-coloured stat hexagon and name chips. They give the feed identity without any official art.
- **Data modules:** team, record, damage, speed, weakness coverage. Information becomes the visual.
- **The game-pack split:** shared components vs. game data.
- **Mobile compose inside the tab bar**, and the top bar hiding on scroll.

### What was not adopted from V3.1
- Card-per-post elevation.
- The hex lattice texture and grain.
- Larger dashboard-sized modules.
- Module headers on every post.

## 2. Three post types, one feed

| Type | When | How it looks |
|---|---|---|
| **Ordinary** (`data-kind="text"`) | text, links, news | Avatar plus text only. No container; separated from the next post by a faint line that starts at the text column. Links use one quiet "well" row. |
| **Structured** (`structured`) | sharing a team or a result | The author's text first, then one module on the well surface that shows the data as it is: team (sigils and names, disclosure, snapshot date) or record (WIN, both selections, rating marked 自己申告). |
| **Analytical** (`analytical`) | damage calc, speed ranking, weakness coverage | The same post frame. The module header carries a small grey **分析** label (no colour, no border); compact charts with tabular numbers. |

All three share the same avatar column, text measure, action row and spacing, so they read as one feed. `kindOf(post)` decides the type from its modules, so the type never has to be stored separately.

### Module rules
- **Placement:** modules come after the author's text, and one is usually enough.
- **Headers:** an icon in the third text tone, a bold 13.5px title, and quiet details on the right.
- **Analytical numbers:** the one key number is 24px/800 (damage range); everything else is 11–13px.
- **Damage:** move chip, range, KO verdict, 16-roll bars, HP bar, one-line condition.
- **Speed:** fixed columns (symbol and name / bar / value / ≈ for near-ties). The bar always means "faster": games where smaller is faster (frames) are drawn reversed.
- **Weakness coverage:** its own analytical post. A summary of up to 4 "weak to" chips plus "ほか N", up to 4 "well resisted" chips, the 18-type strip (2×9 on mobile) and a legend. It is labelled "タイプ相性だけ・特性は含まない".
- **Team / record:** symbol size l (40px) for teams, s (24px) for records. Mobile teams use a 2×3 grid with full names (3 columns for a 3-member team).

## 3. Visual rules
- **Surfaces:** canvas → reading sheet (feed column, side panels) → well (modules, links). Only menus and sheets are raised. There are no card borders and no heavy shadows.
- **Symbols:** one scale, xs 20 / s 24 / m 32 / l 40px. Corner radius is about 30% of the size; the drawing fills 78% of the tile. Every sigil uses the same 96-unit drawing box, frame stroke and diagonal two-colour fill, so symbols from different games still look like one family.
- **Purple:** primary button, active tab underline, active nav icon, hashtags, focus ring, like/bookmark hover tint. Nowhere else.
- **Game colours:**
  - Type and class colours appear only inside modules and name chips.
  - The game's own cue colour (Pokémon pack amber `#E8B931`) appears only in the small game chip under the logo.
- **Typography:**
  - body 14.5px with line height 1.65 (15px on mobile);
  - name 14.5px bold; metadata 13px in the third tone;
  - tabular numbers in data; proportional spacing for Japanese headings.
- **Contrast (computed):**
  - dark: body 15.8, secondary 9.2, metadata 6.2:1;
  - light: 17.2, 8.3 and 5.7:1;
  - small grey text inside modules: 5.4:1 or better.
- **Motion:** like state, a new post's tint, the top bar sliding. All of it is off under reduced motion.

## 4. Multi-game architecture
- **`PACKS` holds one entry per game**, with:
  - `name`, `short`, `color` and an original `glyph` (never the game's logo);
  - `words` (entity / team / unit, speed label and direction, disclosure text, search hint);
  - `sigil()` (the symbol geometry) and `raw` / `ent()` (data);
  - optional analyses such as `coverage()`.
- **Shared components** (post frame, modules, chips, layout) only call those.
- **Fictional proof:** the preview bar's 「架空のゲーム（構造の確認）」 switches the same feed to a made-up 3-on-3 game. Its diamond sigils, class colours, "チーム/人" wording and frame data (lower is faster) all come from its pack. It has no `coverage()`, so it never shows weakness posts.
- **Not a real game.** Production keeps `MULTI_GAME=false`; this switch exists only in the preview.

## 5. Custom backgrounds (LINE-style)
- **Presets:** 光 (default, production's glow), メッシュ, 無地, ノイズ, and 画像 (choose a file or the sample photo) with a **画像の濃さ** slider.
- **Readability:** the reading sheet rises from 88% to 97% opacity as the image gets stronger. When an image is active, the left rail gets its own sheet and the side panels use the stronger sheet.
- **Worst case (computed):** a pure white or black pixel behind the lightest sheet still gives body text 10:1 or more and metadata 4.5:1 or more.
- **Restraint:** only the sticky tab header and the mobile tab bar use blur. Data modules sit on the well, so images never sit directly behind charts.

## 6. Mobile, designed separately
- **Top area:** avatar / logo / background button, then tabs and categories. It slides away while scrolling down and returns on the way up.
- **Rows:** 40px avatars, 15px body, 44px action targets.
- **Modules re-flow:** team in 2×3 with names, coverage in 2×9, damage stacked (attacker / defender / move), record with the rating on its own row.
- **Bottom tab bar:** 56px, with the compose hexagon inside it. The feed's bottom padding always clears the last post.

## 7. Functional vs visual-only
- **Works in the preview:**
  - the variant switch and the game-pack switch;
  - みんな/フォロー中 and the category filter;
  - composer: expands on focus, category menu, counter near the limit, posting with name chips shown once;
  - like and bookmark;
  - backgrounds (presets, image, intensity);
  - mobile compose and background sheets; Esc closes them.
- **Visual only (shows a 「見本」 message):** other screens, reply, repost, share, the "…" menu, the ⚡ quick action, tools, image and team attachment, "このパーティを使う", and chips that would open the dex.
- **Sample numbers:** damage, probability and rating values are samples. Type matchups and base stats are real game data.

---

## 8. Test results (executed, Playwright and Chromium; final run 164 of 164 passed)
- **Viewports:** 1440, 1280 and 1024px (PC); 390, 360 and 430px (phone); the phone frame at 1440px. All four variants, each run with the Pokémon pack and the fictional pack.
- **Layout:**
  - no horizontal overflow;
  - nothing clipped outside the app;
  - no element overflowing its own box (post header, module header and footer, coverage summary, team names);
  - speed labels never collide;
  - weakness cells tidy.
- **Post types:** text posts carry no modules, and each feed has text, structured and analytical posts.
- **Symbols:** only the 4-step scale (20/24/32/40px) appears.
- **Phone controls:**
  - all touch targets are at least 44px;
  - the last post clears the bottom bar;
  - the top bar hides and returns.
- **Interactions:**
  - the composer starts compact and opens on focus, and the category menu works;
  - a new post links a name only once and shows its category;
  - the category filter, the following tab, like and bookmark work;
  - weakness coverage is its own analytical post;
  - the pack switch changes data and words, and the fictional speed list sorts fastest-first;
  - all four presets and the image work, and the sheet gets denser with intensity;
  - mobile compose, mobile background sheet and Esc work.
- **Accessibility:** worst-case contrast over an image passes, reduced motion leaves no running animations, the keyboard focus outline is visible, and there were no console or page errors.
- **Found and fixed during testing:**
  - the team footer overflowed its box (negative margin);
  - the category-filter test assumed one 構築相談 post, so I corrected the test, not the product.

## 9. Remaining issues
- Not checked on a real iPhone; safe areas are simulated in the frame.
- Pixel-level contrast over arbitrary user photos isn't measured. The guarantee comes from the worst-case calculation for the sheet opacity.
- The production comparison used sample data with the login mocked, so production timestamps in the reference screenshots read "20753日前" (a mock-data artefact).

## 10. Unresolved design decisions (owner)
1. Dark canvas: production's pure black or the near-black `#0E0F14` used here.
2. Body text 14.5px (here) vs production's 13px.
3. The **分析** label on analytical modules: keep it, or rely on the icon only.
4. Weakness coverage as a separate analytical post (here) vs folded inside the team module (first pass).
5. The game cue colour chip under the logo (production currently shows a yellow ポケ badge there).
6. Still open from earlier rounds: U1–U11 in `../plan.md` and the V3/V3.1 approval lists.
