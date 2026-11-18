# Feed V3.2 (hybrid) — how to open

**Entry point: `index.html`** (one file with no server or internet needed; only the site's own logo is embedded).

- Open `docs/social-redesign/v3.2/index.html` in Chrome. Narrow windows and iPhones open in the mobile layout.
- The yellow-dashed bar at the top is for the preview only:
  - **PC・ダーク / PC・ライト / スマホ・ダーク / スマホ・ライト** switch the variant;
  - **見た目だけの部品** outlines elements that only show a sample message;
  - **設計メモ** opens a summary of the notes.
- Direct links: `index.html?v=dd|dl|md|ml`, plus `&bg=atmos|mesh|slate|noise|img` and `&ov=1` (weakness detail open).

## Things to try
- **PC:** click the composer (tools appear), pick a category and post.
- **Phone:** use the hexagon in the tab bar to post. Scroll down to see the top bar hide.
- Open and close 弱点の重なり in the first post.
- Choose 画像 in 背景 (PC right column, or the slider icon on phones) and move 画像の濃さ: the reading surface keeps text readable.

## Files
- `index.html`: generated prototype (don't edit by hand)
- `src/feed.template.html`, `src/build.py`: source and build (`python3 docs/social-redesign/v3.2/src/build.py` from the repository root)
- `design-notes.md`: comparison with production, rules and decisions
- `screenshots/`: 2× images of all four variants (with scrolled views `-2`, `-3`, `-4`), the background image (`bgimage-*`) and weakness detail (`weakness-open-*`)
- `screenshots/production-reference/`: the current production feed built locally with sample data, for comparison
