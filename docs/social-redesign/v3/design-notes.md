# Game Kid/s Feed V3 — design notes

Date: 2026-11-17 · Scope: **Feed screen only** (desktop/mobile × dark/light). Design preview, not production code.
Prototype: `index.html` (built from `src/feed.template.html` by `src/build.py`). V1 and V2 in `../prototype/` are unchanged.

V2 was used as the source for *what the feed must do*, not for how it looks. Product decisions D1–D6 and the open questions U1–U11 in `../plan.md` still apply.

---

## 1. Visual system

### Depth through elevation, not lines
The feed has **no 1px borders and no divider lines**. Hierarchy comes from five surface levels, each a step brighter in dark mode or whiter and more shadowed in light mode:

| Level | Token | Dark | Light | Used for |
|---|---|---|---|---|
| 0 Canvas | `--canvas` | `#12141B` slate | `#ECEEF3` | page background (never pure black) |
| 1 Rail | `--rail` | `#151821` | `#E6E9F0` | reserved for side columns |
| 2 Card | `--card` | `rgba(29,32,43,.84)` | `rgba(255,255,255,.9)` | posts, composer, side panels, active nav item |
| 3 Inset | `--inset`, `--inset-2` | white 4.5% / 7.5% | `#F3F4F8` / `#EBEDF3` | modules inside a post, tags, inputs |
| 4 Raised | `--raised` | `#262A38` | `#FFFFFF` | menus, bottom sheet, mobile nav |

- Elevated surfaces use the top-edge highlight `inset 0 1px 0 rgba(255,255,255,.06)` (`.9` white in light mode) plus soft ambient shadows `--sh-1` and `--sh-2`.
- Cards are slightly translucent so the chosen background shows through, with no blur.
- Blur is used in only two places: the sticky header strip and the mobile bottom navigation.

### Purple is a brand signal, not a theme colour
Purple (`--brand`) appears only on:
- the primary action (post button, compose button, hexagonal FAB);
- where you are (active nav icon, notification count on mobile);
- hashtags and the focus ring.

Selected chips, tabs and segmented controls use **elevation** (they lift to a card surface), not purple. Likes use rose, results use green and red, and Pokémon use their type colours.

### Typography (desktop / mobile)
| Level | Size / weight | Colour |
|---|---|---|
| Screen title | 22 / 800 (20 on mobile) | t1 |
| Author name | 15 / 700 | t1 |
| Post text | 15.5 / 400, line height 1.72 (15 / 1.68) | t1 |
| Module title | 14 / 700 | t1 |
| Metadata (@ID, time, category) | 13 / 400 (12.5) | t3, category in t2 |
| Labels and captions | 12 / 650, slight tracking | t3 |
| Big numbers (damage %, rating) | 28 / 800 tabular, -2% tracking | t1 |

There are four text tones (`--t1` to `--t4`). Metadata is two tones below the body text, so it never competes with the post. Spacing uses 22px card padding (18 on mobile), 16px between cards (12 on mobile), and 14px between blocks inside a post. Radii are 22px for cards, 16px for modules, 12–14px for controls, and fully round only for avatars and tags.

## 2. Post modules (composable)
A post always has: header (avatar, name, `@ID · time · category`), text, and actions. Modules are added only when the content calls for them:

| Module | When | Design rule |
|---|---|---|
| **Pokémon name chip** `.pk` | Any text | A tinted chip in the Pokémon's first-type colour (15% alpha) with a small diamond. Never an underlined link. Follows D4: `kfold` normalisation, 3+ characters, exclusion list, separate Japanese and English boundaries, #tags and @IDs skipped, **one chip per Pokémon per post**. |
| **Party strip** `.party` | Sharing a team | Six stat-shape tiles in a 6-column grid. Desktop shows names; mobile drops names (accessible labels remain). The header always shows the disclosure level (ポケモンだけ公開). The footer says it is a snapshot from a given date, with "このパーティを使う". |
| **Concept tags** `.tag` | Build posts | Neutral inset pills, **at most 3 per post**, placed after the modules so they don't compete with the text. |
| **Damage calc** `.calc` | Sharing a calculation | Attacker → defender with conditions, a move chip in its type colour, a big % range, a KO badge with probability, and an HP bar (remaining HP green, damage range striped in the move's type colour). On mobile it stacks into a 2-column grid. |
| **Battle record** `.rec` | Sharing a result | WIN/LOSE block, my and opponent selections as mini tiles (fainted ones greyed), and the rating with change. The rating is labelled **自己申告** and the card 本人の記録, to follow D1. On mobile the rating moves to its own row. |
| **Link card** | Official news bot | Inset row with icon, title and source. |

The action row keeps the existing order (reply → repost → like → bookmark → share) with at least 44px tap areas and no visible container.

## 3. Backgrounds
Exactly four presets plus your own image:
1. **光 (Atmosphere, default)**: the existing top-right glow, refined, with a soft bottom vignette. This keeps the decision to keep the glow as a preset.
2. **メッシュ**: very low-alpha mesh of violet, blue, pink and teal.
3. **スレート**: flat matte slate.
4. **ノイズ**: slate with a fine noise texture (SVG turbulence, about 3%).
5. **画像**: pick a file (resized to 1600px, stays in the page) or the drawn abstract sample. A LINE-style **画像の濃さ** slider controls how strongly the image shows. Its maximum is calculated so body text keeps at least 7:1 contrast against the background, with a hard cap of 85%.

V2's 夕暮れ and 六角形 presets and the sky-and-hill images were removed.

## 4. Mobile, designed separately
- **Top bar.** One 48px sticky row holds the avatar (opens the menu), the みんな/フォロー中 segmented control and the background button. The category row scrolls away with the content, so more of the feed is visible.
- **Cards** have 12px side margins, 16px padding, and are full-width within the margins.
- **Modules.** The party strip loses its names, the damage card stacks, the battle record moves the rating down, and tags shrink slightly.
- **Bottom navigation** is a floating raised bar with 64px height, 5 items and safe-area padding (`env(safe-area-inset-bottom)`; simulated as 34px in the phone frame). The hexagonal compose button sits above it on the right.
- **Composing** happens in a bottom sheet with a 16px input (no iOS zoom). Esc and the backdrop close it.
- **No horizontal overflow** except the category row, which is meant to scroll. This was checked at 390px with automated tests.

## 5. Accessibility
- Text contrast: t1 and t2 meet 4.5:1 on cards in both themes. The image slider enforces 7:1 for body text.
- Visible focus ring in the brand colour.
- All icon buttons have labels.
- Tabs use `role=tab`/`aria-selected`; filters and toggles use `aria-pressed`; menus and backgrounds use radio roles.
- Esc closes menus, sheets and notes.
- `prefers-reduced-motion` turns off transitions and animations.

## 6. Functional vs visual-only
| Works in the preview | Visual only (shows a 「見本」 toast) |
|---|---|
| Switching between the 4 variants | Reply, repost, share, the "…" menu |
| みんな / フォロー中, category filter | Navigation to other screens, the tool shortcuts |
| Composer: category menu, 140 counter, posting (desktop card, mobile sheet) | Attaching an image or team, "このパーティを使う" |
| Like and bookmark | Pokémon chips and concept tags (they would open the dex or a search) |
| Backgrounds: 4 presets, image, intensity | Damage and battle numbers (sample values, not real calculations) |

The yellow "見た目だけの部品" button outlines every visual-only element.

## 7. Decisions that need the owner's approval
1. **Dark mode canvas changes from pure black (current site) to slate `#12141B`.** This was requested for V3, but it changes the site-wide look.
2. **Background presets change** from V2's 光/夕暮れ/六角形/なし to 光/メッシュ/スレート/ノイズ (+ image). 光 stays the default.
3. **Concept tags** (up to 3 per post) are a new post feature: who writes them and whether they come from a fixed list.
4. **Damage calc and battle record modules** in posts are new. Where they come from needs deciding: probably "share" buttons on the calculator and the replay tool.
5. The image-intensity rule (body text 7:1, maximum 85%) replaces V2's overlay slider for the feed.

Open questions U1–U11 in `../plan.md` are unchanged.
