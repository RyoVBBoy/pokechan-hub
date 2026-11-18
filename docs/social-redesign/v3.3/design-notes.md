# Game Kid/s Feed V3.3 — five targeted refinements on V3.2

Date: 2026-11-17 · Scope: **Feed only**. Design preview, not production code.
V3.3 = V3.2 plus five small changes. Layout, navigation, composer, post types, colours, symbols and pack architecture are unchanged. V3.2 and all earlier versions are untouched (checked by file checksums, see the end).

## What changed from V3.2

| | V3.2 | V3.3 | Measured |
|---|---|---|---|
| **A. Dark contrast** | Composer text field transparent on the reading sheet. Symbols sat on a 12% tint of their own (sometimes dark) type colour. | The composer field has its own slightly lighter surface (white 5.5% in dark, ink 3.5% in light). Every symbol, in both packs and both themes, gets the same **neutral backing plate** (white 7% dark / 55% light) under its colour tint and a **1px inner ring** (white 8% dark / ink 6% light). Shapes and colours are unchanged, with no outlines or glow. | composer bg: `transparent` → `rgba(255,255,255,0.055)`; plate and ring present on 100% of symbols (Pokémon and fictional pack, dark and light) |
| **B. Desktop sidebar** | Rail filled the full window height, so the profile sat at the bottom with a 402px void after the ⚡ button. | The rail is capped at 760px (`min(100vh, 760px)`). Brand, game chip and nav are tightened into one rhythm: 50px items, even 54px steps, 18px before ⚡. The profile gets a faint resting surface so it reads as a deliberate end. No new items. | gap ⚡ → profile: **402px → 236px** at 1440×960; nav steps all 54px; short windows (700px) still fit; 3 columns at 1440, collapsed rail at 1024 (unchanged) |
| **C. Mobile analytical text** | Supporting text 10–11.5px; the attacker condition was clipped at 360px. | Mobile analytical modules only: supporting text **+1px**, note line height 1.5 → 1.6, padding 12 → 14px. Attacker and defender are stacked as two rows with a small ↓, so each condition fits on one line. The 24px damage range is unchanged and still dominant (≥ 1.9× supporting text). | who 11→12px, roll label 11→12, small 10→11, note 11.5→12.5px; overflow at 360px: **yes (V3.2) → no**; 390px no |
| **D. Weakness hierarchy** | The full 18-type matrix plus two chip rows was always shown in the feed. | The preview shows a **warning line** ("7タイプで2匹以上が同時に弱い", plus "最大N匹" when 3 or more) and the **top 4 types** (most weak members first, then fewest resists), with "ほか3タイプ". **「18タイプすべてを見る」** (a real button with `aria-expanded`/`aria-controls`) opens the "よく受けられる" list, the full matrix and the legend. Calculation unchanged (`coverage()` is identical). | default: matrix hidden, 4 top types; expanded: 18 cells and legend; Enter collapses; per-type data **identical to V3.2** (18/18 aria labels compared) |
| **E. Mobile categories** | Chips ran off the right edge with no cue. | A soft fade appears **only at the edge where more chips continue** (36px right / 24px left). It disappears at the end of the row, and a 12px end-spacer stops the last label being cut. Selecting a chip keeps it fully visible outside the fades. Touch scrolling unchanged. | fade "r" at start → "l" at end; selected 雑談 fully visible at 360/390/430px; desktop row doesn't overflow, so no fade |

## Files
- `src/feed.template.html` (copied from V3.2, then the five changes; CSS tokens `--input`, `--sig-plate`, `--sig-ring`; new `mCover` presentation, `ST.covOpen`, `catsSync`/`catsFade`; start-up option `?cov=1` that opens the detail, for tests and screenshots).
- `src/build.py` (V3.2's build with the paths changed), `index.html` (generated), `README.md`, this file, `screenshots/`.

## Test results (Playwright and Chromium, executed)
- **V3.3 suite: 261 of 261 passed.**
  - It covers everything from V3.2's suite: 1440/1280/1024/390/360/430px plus the phone frame at 1440; dark and light; Pokémon and fictional packs; weakness detail open and closed.
  - Checked: no horizontal overflow or clipping, no colliding labels, the three post types, the 4-step symbol scale, 44px touch targets, nav clearance, top-bar hide/show.
  - Interactions: composer, post, category filter, following tab, like, bookmark, pack switch, the 4 presets, custom image and intensity, the weakness detail with a custom background, mobile sheets, Esc.
  - Reduced motion, visible keyboard focus (including the new toggle), and no console or page errors.
  - Plus 30-odd new checks for A–E, several of them measured side by side against V3.2.
- **V3.2 suite, run against V3.2: 164 of 164 passed** (V3.2 unaffected).
- **Found and fixed during this work:**
  - At 360px the stacked attacker condition wrapped into three short lines; I changed it to one row per side.
  - Two test bugs: a wrong selector for the category row, and an over-strict fade margin when the selected chip is already at the end of the row. I corrected the tests, not the design; the screenshot confirmed the chip is fully visible.

## Visually inspected (screenshots actually opened)
- PC dark (with the V3.2 comparison), PC light weakness preview and expanded detail.
- Phone light feed; phone dark damage card at 360px (before and after the fix); phone dark weakness preview at 360px; phone category row at 360px.
- The other screenshots in `screenshots/` were generated but not individually reviewed.

## Remaining issues and decisions
- Not checked on a real iPhone (safe areas are simulated in the frame).
- The left fade slightly dims the first visible chip while you are mid-scroll. That's intended, and the label stays readable.
- Open decisions from V3.2 still apply:
  - pure black vs near-black;
  - 14.5px body text;
  - the 分析 label;
  - coverage as its own post;
  - the game chip;
  - U1–U11.
- New for the owner: the 760px cap on the desktop rail and the resting surface behind the profile.

## Unchanged-file check
Before starting, I took checksums of all 151 files in `docs/social-redesign/` and `game-kids-social-prototype.html`. After finishing, every one of those 151 files was identical; the only additions are under `docs/social-redesign/v3.3/`.
