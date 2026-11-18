# Feed V3 — how to open

**Entry point: `index.html`** (one file with no server or internet needed; the site logo is embedded).

## Open
- PC: open `docs/social-redesign/v3/index.html` in Chrome.
- iPhone or narrow window: it opens full screen in the mobile layout.

## Switch between the four variants
Use the yellow-dashed preview bar at the top: **PC・ダーク / PC・ライト / スマホ・ダーク / スマホ・ライト**. On a PC, the mobile variants show inside a 390×844 phone frame.

Direct links:
- `index.html?v=dd`: desktop dark
- `index.html?v=dl`: desktop light
- `index.html?v=md`: mobile dark
- `index.html?v=ml`: mobile light
- Add `&bg=mesh`, `slate`, `noise`, `atmos` or `img` to start with a specific background.

## Things to try
- Filter by category, switch みんな/フォロー中, like or bookmark.
- Write a post and choose a category. On mobile, use the hexagon button.
- Backgrounds:
  - **Desktop:** the 背景 panel on the right.
  - **Mobile:** the slider icon at top right.
  - Choosing 画像 shows the drawn sample photo, or you can pick your own file. Then move 画像の濃さ.
- **見た目だけの部品:** outlines everything that is visual only.
- **設計メモ:** a short summary of the design notes.

Nothing is saved or sent; reload to reset. Damage and battle numbers are sample values.

## Files
- `index.html`: the prototype (generated; do not edit by hand)
- `src/feed.template.html`: source
- `src/build.py`: run `python3 docs/social-redesign/v3/src/build.py` from the repository root to rebuild (embeds `src/static/logo.png`)
- `design-notes.md`: visual system, component rules, decisions
- `screenshots/`: the four variants at 2× (`desktop-dark.png`, `desktop-light.png`, `mobile-dark.png`, `mobile-light.png`), plus scrolled views (`-2`, `-3`)
