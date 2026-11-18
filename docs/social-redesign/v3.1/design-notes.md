# Game Kid/s Feed V3.1 — visual identity and multi-game architecture

Date: 2026-11-17 · Scope: **Feed only** (desktop/mobile × dark/light). Design preview, not production code.
Prototype: `index.html` (built from `src/feed.template.html` with `src/build.py`).
V1/V2 (`../prototype/`) and V3 (`../v3/`) are unchanged. V3's design notes (surface tokens, typography and background rules) still apply; this document lists what V3.1 changes and why.

---

## 1. What changed, in priority order

| # | Improvement | Why it mattered most |
|---|---|---|
| 1 | **Shared core and game packs** | Without this split, every new game would need its own feed. Now a game is a data object (a "pack"). |
| 2 | **Original sigil system** | Replaces any need for character art with a symbol the site owns, and the symbol shape can differ per game. |
| 3 | **Game data drawn as visuals** | Weakness overlap, speed ranking and the 16-roll damage distribution turn numbers into the main picture of the post. |
| 4 | **Atmosphere and motion** | Fine grain, Japanese proportional type and restrained motion make it feel premium without glow or heavy glass. |

## 2. Architecture: shared core and game packs

```
Game Kid/s core (shared, never game-specific)
  tokens        surfaces, text tones, brand purple, positive/negative, spacing, radii
  layout        rail / feed / side (desktop), top bar / bottom nav / sheets (mobile)
  post shell    header, text, modules, tags, actions
  modules       roster · overlap · ladder · calc · record · link
  primitives    sigil frame (sizes xs/s/m/l), entity chip, game badge
        │ asks the pack for data
        ▼
Game pack (one per game)
  id, name, short, color         game cue colour (used only in the game badge, the rail context and the background corner)
  glyph                          original game mark (never the game's logo)
  words                          "ポケモン/パーティ/匹" or "キャラクター/チーム/人", stat label, ladder label
  sigil(entity)                  the game's own symbol geometry
  ent(id)                        name, colours, stats, total, speed metric, subtitle
  overlap(ids)  (optional)       game-specific analysis, e.g. type weakness
```

- **Modules never know which game they are drawing.** For example, `roster` asks for `ent()` and `sigil()`, and `ladder` sorts by the pack's speed metric (base speed for Pokémon; startup frames for the fictional game, where lower is faster).
- **A game without type matchups** simply doesn't offer `overlap`, so posts can't use that module.
- **Adding a game** means adding a pack: data, colours, a glyph, a sigil function and labels. No layout or component changes are needed. This fits the project's `GAMES` table and `MULTI_GAME` flag.
- **Fictional proof.** The preview bar's **ゲームの例** switch shows the same feed driven by "ARENA LINE（架空）", a made-up 3-on-3 fighting game. Its characters, classes and frame data are all invented.
- **Mixed feed.** "混在（将来）" shows how a future mixed feed would label posts with a small game badge. Today the site stays Pokémon-only (`MULTI_GAME=false`, decision D3).

## 3. Original visual symbols

- **No copyrighted game art, icons or logos.** The only embedded image is the site's own logo (`src/static/logo.png`). Pokémon names and type names appear as text, and type matchups and base stats are factual game data.
- **Sigil (Pokémon pack).** A hexagon of the six base stats (developed from the site's existing 種族値の形):
  - outer frame and half-scale guide ring in the first type's colour;
  - the stat polygon filled with a **diagonal two-tone split** (first type / second type);
  - placed on a softly tinted rounded tile.
- **Sigil (fictional pack).** A diamond of four attributes with a cross guide, in the same tile, sizes and colour logic. This shows the system is a family of symbols, not one fixed picture.
- **Name chip.** A small rotated two-tone diamond plus the name on a 15% tint of the first colour. It is calmer than embedding the full sigil at text size, and reads as a link without underlines.
- **Game glyphs** are simple original marks (a circle with a hexagon for the Pokémon pack, a diamond with a cross for the fictional game). They appear only in the rail context card and the game badge.

## 4. Information as the visual

| Module | Data | Visual rule |
|---|---|---|
| **Roster** | Party or team members | Sigil (size m), name, a two-segment colour bar for type or class, and the pack's total stat in tabular numbers. The header shows the disclosure level; the footer shows the snapshot date (V2 decisions kept). |
| **Overlap** *(Pokémon pack)* | How many members are weak (2× or more) or resistant (½× or less) to each of the 18 types | A heat strip with one-character type labels and warm intensity by weak count (1/2/3+). Green dots show resistances. A one-line summary lists types with 2+ weak members. It is labelled "type matchups only, abilities not included". On mobile it becomes 2 rows of 9. |
| **Ladder** | Ranking by the pack's speed metric | Sorted rows: sigil, name, then a bar from a light to a full tint of the member's colour, with the value. Near-equal values (±1) are tagged ほぼ同じ (nearly equal). Shared tick labels. Bars grow in on first view. |
| **Calc** | Damage range | Big tabular % range, KO verdict with probability, **16-roll distribution** bars (rolls at 50% or more highlighted), and an HP bar (remaining HP green, the damage range striped in the move's colour). The numbers are sample values. |
| **Record** | Match result | WIN/LOSE block, both selections as small sigils (fainted members greyed), how many remain, and rating with change marked 自己申告 (D1). |
| **Tags, link** | Build concepts, official news | At most 3 neutral pills. The link card is unchanged. |

Typography: Japanese headings use proportional spacing (`palt`); all numbers are tabular. Large numbers are 30px/800 with tight tracking. Labels are 11.5px/700 with +4% tracking.

## 5. Atmosphere and motion

- **Grain.** A fine noise layer over every background (5% dark, 3.5% light, blended). The ノイズ preset doubles it. This adds texture without glow.
- **Light.** 光 keeps the brand-purple light at top right. A very faint wash of the **game colour** now sits at top left, the only atmospheric use of the game colour.
- **Presets** are still exactly four (光・メッシュ・スレート・ノイズ) plus your own image. The image-intensity cap is unchanged (body text 7:1, at most 85%).
- **Motion**, all disabled under `prefers-reduced-motion`:
  - posts rise in with a 45ms stagger when the view changes;
  - distribution bars, ladder bars and the HP bar grow once;
  - the like heart pops;
  - sigils lift 2px on hover.

  There are no infinite loops.

## 6. User screenshots

Image upload in the composer is a separate issue from the site's own visuals. Each game's guidelines decide whether users may post screenshots, so the prototype does not assume they are allowed. The image button explains that this is still being checked.

## 7. Functional vs visual-only
Everything listed in V3's table still applies. New interactive parts:
- the **ゲームの例** switch (Pokémon, fictional, mixed), which is preview-only;
- data modules that draw from real pack data (type matchups and base stats for Pokémon; invented data for ARENA).

## 8. Decisions that need the owner's approval
1. Adopt the **sigil system** as the site's standard way to show Pokémon (replacing the plain stat shape).
2. The **pack structure** as the basis for adding games (connects to `GAMES` / `MULTI_GAME`).
3. A **game cue colour** for Pokémon Champions (amber `#E8B931` here) and where it may appear (badge, rail context, faint corner light only).
4. New post modules **弱点の重なり** (weakness overlap) and **素早さの並び** (speed ranking): whether to build them and where their data comes from (shared from a team or a tool).
5. Still open from V3: slate dark canvas, the new preset set, concept tags, and calc/record modules in posts.

Open questions U1–U11 in `../plan.md` are unchanged.

---

## 9. Refinement pass (2026-11-17, same day)

This is a focused polish, not a redesign. Everything in sections 1–8 still holds. The earlier output is kept as `index-before-refine.html` and `src/feed.template.before-refine.html`. The first screenshots are still in `screenshots/`; the new ones are in `screenshots/refined/`.

### A. Mobile navigation and compose
- **The compose button now sits inside the bottom navigation** as its right-most slot: a 48px hexagon with no large drop shadow. It no longer floats over post text or the share action, and it doesn't compete with the tabs.
- **Bottom navigation is lighter and shorter**: 56px tall (was 64), smaller shadow, 22px icons, 10px labels. Every tab is still 48px tall (above the 44px minimum).
- **Content clearance**: the feed's bottom padding matches the navigation. Tested: at the end of the feed, the last post stops at least 8px above the nav.
- **Top bar hides while you scroll down** and returns when you scroll up (or near the top). This gives the reading area the viewport back. It switches instantly with reduced motion.

### B. Data readability
- **Speed ranking.** Each row now has four fixed columns: symbol and name | bar | value (right-aligned) | ≈ marker. Values and annotations can't collide.
  - The "ほぼ同じ" text was replaced by a small ≈ marker, explained once at the bottom (≈ = within 1, order can change with training).
  - Names stay visible on mobile.
- **Weakness overlap.** Each cell has three fixed rows: type label / count (14px bold, a faint · for 0) / resistance dots.
  - The legend shows the 1 / 2 / 3+ colour steps with numbers, plus the green dot = "受けられる（半分以下）".
  - "2匹以上が弱い" (types two or more are weak to) is now its own line instead of being squeezed beside the legend.
  - Mobile uses 2 rows of 9.
- **Damage.** The 16-roll distribution has its own labelled row ("乱数16段階・濃い＝50%以上") under the result, instead of being squeezed beside it.

### C. Module consistency
- Every module header now follows the same pattern: small icon in the third text tone, bold title, meta on the right (wraps on narrow screens).
- Module padding is 16/18px (14/12px on mobile).
- **Party.** Symbols are larger on PC (52px). On mobile the party is a 2×3 grid of symbol + full name + type bars, so names are no longer hidden. A 3-member team (the fictional game) uses 3 columns.

### D. Identity, especially PC light
- A **fine hexagon lattice** sits under every background preset (not under your own image). It fades out from the top and is very faint (white 4% in dark, ink 7.5% in light).
- It is original geometry shared by every game, so the light theme feels like Game Kid/s rather than a blank white feed. No purple, glow, borders or shadows were added for this.
- Amber (`#E8B931`) is still used only as the Pokémon game's small identification accent.

### Tested (automated with Playwright/Chromium; all executed)
- **Viewports.** 1440, 1280 and 1024 (PC); 390, 360 and 430 (phone); plus phone variants inside the frame at 1440. All four variants were run, and the fictional and mixed packs at 390/1440.
- **Layout and overlap:**
  - no horizontal overflow;
  - no element clipped outside the app;
  - speed-ranking names, bars, values, ≈ markers and tick labels never overlap;
  - weakness-cell parts stay inside their cell and don't overlap.
- **Mobile controls:**
  - every navigation item, action and icon button is at least 44px tall;
  - the floating compose button is hidden and compose lives in the nav;
  - the last post clears the nav;
  - the top bar hides on scroll down and returns on scroll up.
- **Interactions:** posting (desktop and mobile sheet), the name chip appears once, category filter, like, the 4 presets and the image background (lattice hidden), the game-pack switch, the mobile background sheet, Esc closes the sheet.
- **Motion and errors:** no running animations with reduced motion, and no console or page errors.

### Still unresolved
- **Not tested on a real iPhone.** Safe areas are simulated (47/34px) in the frame and use `env()` on the device; scrolling behind the translucent nav should be checked on a real phone.
- **Keyboard focus.** Focus rings were not reviewed visually, beyond confirming that `:focus-visible` styles exist.
- **Owner decisions** in section 8 are unchanged.
