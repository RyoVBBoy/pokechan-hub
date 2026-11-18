# Feed V3.1 — how to open

**Entry point: `index.html`** (one file with no server or internet needed; only the site's own logo is embedded).

## Open
Open `docs/social-redesign/v3.1/index.html` in Chrome. On an iPhone or a narrow window it opens full-screen in the mobile layout.

## Preview bar (yellow dashed line; not part of the product)
- **Variants:** PC・ダーク / PC・ライト / スマホ・ダーク / スマホ・ライト
- **ゲームの例:**
  - ポケチャン (real game data, original symbols);
  - 架空のゲーム (a made-up game that shows a second game needs no redesign);
  - 混在（将来） (a future mixed feed with game badges).
- **見た目だけの部品:** outlines elements that only show a sample message.
- **設計メモ:** a short summary of the notes.

Direct links: `index.html?v=dd|dl|md|ml`, optionally with `&g=pokechamp|arena|mix` and `&bg=atmos|mesh|slate|noise|img`. Add `&still=1` to skip the entrance animation.

## Things to try
- Scroll through the Pokémon feed: party plus weakness overlap, damage calc with 16-roll distribution, speed ranking, battle record.
- Switch ゲームの例 to 架空のゲーム: the same components with a different symbol, data and words.
- Filter, post, like, bookmark, change background or image intensity (as in V3).

## Files
- `index.html`: generated prototype (don't edit by hand)
- `src/feed.template.html`, `src/build.py`: source and build (`python3 docs/social-redesign/v3.1/src/build.py` from the repository root)
- `design-notes.md`: architecture, symbols, modules, decisions
- `screenshots/refined/`: screenshots after the refinement pass (2×, all four variants plus scrolled views, fictional and mixed)
- `index-before-refine.html`, `src/feed.template.before-refine.html`: the version before the refinement, kept for comparison
- `screenshots/`: 2× images of each variant and scrolled views (`desktop-*`, `mobile-*`), plus `arena-*` and `mix-*`
