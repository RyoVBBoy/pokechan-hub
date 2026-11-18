# Social redesign — how to view

**Entry point: `prototype/index.html`** (one file with no internet or server needed).

## Open it
- **On a PC (Chrome):** download or copy `prototype/index.html` and double-click it.
- **In the Claude app:** open the attached file `index.html`; it shows in the side panel.
- **On an iPhone:** open the file. It starts in the phone layout automatically.

## Use it
The bar with the **yellow dashed line** at the top is only for the preview:
- **1–4:** switch screens (フィード／プレイヤーカード／パーティの共有／背景の設定).
- **PC／スマホ:** desktop layout, or the phone layout in a phone frame.
- **ダーク／ライト:** theme.
- **設計メモ:** opens the notes panel. The yellow numbered dots on the screen open the matching note.
- On the Player Card screen: **見る人** (others or the owner) and **ゲームプロフィール** (public or private).
- On narrow windows these are under **見本の操作 ▾**.

Things to try: pick a category and post, filter by category, like or bookmark, share a team at each disclosure level, use "パーティ1を編集してみる" to see that snapshots don't change, switch backgrounds, choose an image and move the darkness slider, and test name auto-linking in the notes panel.

Nothing is saved or sent. Reloading resets everything.

Direct links (add after `index.html`): `?s=card&d=m&t=light`. Parameters:
- `s`: feed, card, share or bg.
- `d`: d (PC) or m (phone).
- `t`: dark or light.
- `bg`: glow, dusk, hex, none or img.
- `viewer=self`, `priv=1`, `lv=p|i|f`, `notes=0` (hide the dots), `np=1` (open the notes panel).

## Files
- `plan.md` — the redesign plan, decisions D1–D6, open questions U1–U11
- `design-notes.md` — why the screens look and behave this way
- `prototype/index.html` — the prototype (v2)
- `prototype/v1.html` — the first version, kept for comparison
