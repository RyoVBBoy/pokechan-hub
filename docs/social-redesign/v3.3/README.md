# Feed V3.3 — how to open

**Entry point: `index.html`** (one file with no server or internet needed; only the site's own logo is embedded). V3.3 is V3.2 plus five small refinements (see `design-notes.md`).

- Open `docs/social-redesign/v3.3/index.html` in Chrome. Narrow windows and iPhones open in the mobile layout.
- The yellow-dashed bar at the top is for the preview only:
  - PC・ダーク / PC・ライト / スマホ・ダーク / スマホ・ライト;
  - ポケチャン / 架空のゲーム（構造の確認）;
  - 見た目だけの部品, and 設計メモ.
- Direct links: `index.html?v=dd|dl|md|ml`, plus `&g=arena`, `&bg=atmos|mesh|slate|noise|img`, and `&cov=1` (opens the 18-type weakness detail).

## Where to see the five changes
- **A. Dark contrast:** PC・ダーク. Look at the composer field and the symbols (for example サーフゴー, アーマーガア).
- **B. Sidebar:** PC at full width. Look at the gap between 「相性を調べる」 and the profile.
- **C. Phone damage card:** スマホ, in the ダメージ計算 post, or the 360px comparison screenshots.
- **D. Weakness:** the なお post. It shows the warning and top types; press 「18タイプすべてを見る」 for the full analysis.
- **E. Phone categories:** スマホ. Note the faded right edge of the category row; swipe it sideways.

## Screenshots (`screenshots/`, 2×)
- **The four variants:** `desktop-dark`, `desktop-light`, `mobile-dark`, `mobile-light`. Each has `-calc`, `-cover`, `-cover-open` and `-speed` close-ups.
- **Before/after:** `compare-v32-*` and `compare-v33-*`:
  - A–B on desktop dark;
  - C (damage), D (weakness) and E (categories) at 360px.
- **Others:** custom background (`bgimage-*`) and the fictional pack (`pack-arena-*`).

## Files
- `index.html`: generated (don't edit by hand)
- `src/feed.template.html`, `src/build.py`: source and build (`python3 docs/social-redesign/v3.3/src/build.py` from the repository root)
- `design-notes.md`: changes from V3.2, test results, remaining issues
