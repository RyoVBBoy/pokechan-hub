# Player Card V3.4 — standalone visual prototype

Design preview only, not production code. Every person, result and post in it is **prototype data**.

**Entry point: `index.html`.** It's a single file and needs no server or internet. The only embedded image is the site's own logo.

- Open `docs/social-redesign/v3.4/index.html` in Chrome. Narrow windows open the phone layout.
- The yellow-dashed bar at the top exists only in the preview. It switches:
  - device: スマホ / PC;
  - viewer: 本人 / フォロワー / 訪問者;
  - data: 確認済みあり / 自己申告だけ / ゲームなし;
  - account: 公開 / 非公開.
- Direct links: `index.html?dev=m|d&viewer=owner|follower|visitor&data=full|self|nogame&priv=0|1`. Add `&bar=0` to hide the preview bar.

## Screenshots (`screenshots/`, 2×)
- `mobile-390.png` (first screen) and `mobile-390-full.png` (whole page): visitor, verified results present.
- `desktop-1280.png` and `desktop-1280-full.png`: the same content at 1280px.
- States at 390px:
  - `mobile-390-follower.png`: approved follower;
  - `mobile-390-owner-private-self.png`: owner, private account, self-reported results only;
  - `mobile-390-visitor-private.png`: private account seen by a non-follower;
  - `mobile-390-owner-nogame.png`: owner with no game profile.

## Files
- `src/card.template.html`, `src/build.py`: source and build. Run `python3 docs/social-redesign/v3.4/src/build.py` from the repository root.
- `index.html`: generated, don't edit by hand.
- `design-notes.md`: rationale for the three pillars, what follows the IA, checks and open points.
