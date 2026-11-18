# Feed V3.2 (hybrid) — how to open

**Entry point: `index.html`** (one file with no server or internet needed; only the site's own logo is embedded).

- Open `docs/social-redesign/v3.2/index.html` in Chrome. Narrow windows and iPhones open in the mobile layout.
- The yellow-dashed bar at the top is for the preview only:
  - **PC・ダーク / PC・ライト / スマホ・ダーク / スマホ・ライト** switch the variant;
  - **ポケチャン / 架空のゲーム（構造の確認）** switch the game pack (the second is made up, to check the multi-game structure);
  - **見た目だけの部品** outlines elements that only show a sample message;
  - **設計メモ** opens a summary of the notes.
- Direct links: `index.html?v=dd|dl|md|ml`, plus `&g=arena` and `&bg=atmos|mesh|slate|noise|img`.

## Things to try
- Scroll the feed and compare the three post types:
  - ordinary text;
  - structured (team, battle record);
  - analytical (damage, weakness coverage, speed), marked with a small 分析 label.
- **PC:** click the composer (tools appear), pick a category and post.
- **Phone:** post with the hexagon in the tab bar, and scroll down to see the top bar hide.
- 背景 (PC right column, or the slider icon on phones): choose 画像 and move 画像の濃さ.

## Files
- `index.html`: generated prototype (don't edit by hand)
- `src/feed.template.html`, `src/build.py`: source and build (`python3 docs/social-redesign/v3.2/src/build.py` from the repository root)
- `design-notes.md`: inspection findings, post types, rules, architecture, **test results, remaining issues, open decisions**
- `screenshots/hybrid/`: 2× images of this version:
  - all four variants (`desktop-*`, `mobile-*`), each with close-ups `-calc`, `-cover`, `-speed`, `-record`;
  - custom background (`bgimage-*`) and the fictional game pack (`pack-arena-*`)
- `screenshots/production-reference/`: the current production feed built locally with sample data
- `first-pass/`: the earlier V3.2 pass (prototype, source, notes, screenshots), kept unchanged. The other images directly in `screenshots/` also belong to that pass.
