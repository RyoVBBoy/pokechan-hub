# Game Kid/s social redesign — design notes (prototype v2)

Date: 2026-11-17 · Status: design preview only, nothing implemented.
Prototype: `prototype/index.html` (open instructions in `README.md`). The previous version is kept as `prototype/v1.html` for comparison.

The approved decisions D1–D6 and the constraints in `plan.md` were treated as fixed. Where the prototype had to show something that is not decided yet, it shows the proposal and labels it with its open-question number (U1–U11).

---

## 1. Visual direction

| Goal | How v2 does it |
|---|---|
| Premium, restrained glass | Only the sticky header, the phone tab bar and the phone's bottom action bar use blur. Cards are semi-transparent with a 1px border and no per-card blur, as on today's site, because per-card blur is expensive on phones. |
| Purple spotlight, no neon | One soft accent glow at the top right (the existing "光" background). The accent colour is used only for: the active navigation icon, primary buttons, links, selected states and the tab underline. There are no glowing outlines or gradients on text. |
| Readable feed | Category colour is reduced to an 8px dot; the label text stays neutral grey. Post text is 14.5px with 1.62 line height. Pokémon name links use a thin underline rather than a filled pill, so linked text does not shout. |
| Consistent system | Tokens for surfaces (`--s1/2/3`), borders (`--bd/--bd2`), text (`--t1/2/3`) and accent (`--acc`, `--accf`, `--acc-t`). Radii: cards 18px, inputs 12px, pills fully round. One type scale (11–23px). |
| Game Kid/s identity | Circle = person, hexagon = Pokémon and the post button (kept). Pokémon are drawn as stat shapes in their type colours, never official art. The Player Card cover keeps the existing hexagon pattern and partner stat shape. |
| Not X | No X-style blue, verified tick or layout copy. The rail has a rounded-rectangle active state instead of a pill. Hexagonal post button, stat-shape cover, game profile cards. |
| Dark and light | Every colour is a token with a light override. The light theme uses the existing #EEF0F5 base with white cards and soft shadows. Category dots, type colours and rank badges were checked in both themes. |

## 2. Screen-by-screen decisions

### ① Feed
- **Categories replace the separate menu entries.** The left menu no longer has 対戦募集 / 構築相談・質問. A chip row under the tabs filters the feed (すべて + 4), and the desktop right column lists the same categories with a short description. (Decided; storage is U2, whether the shortcut disappears completely is U9, counts are U10.)
- **Composer.** The category is optional and starts as "none". The picker is a small menu (keyboard and Esc work). The character counter appears only once you start typing, so the empty composer stays calm. The party button opens the sharing flow; nothing is attached without going through that preview.
- **Post card.** The action order is unchanged (reply → repost → like → bookmark → share), and each action has at least a 44px tap area. Like and bookmark toggle visibly. The category label sits above the text, not in the header, so the name / @ID line stays one line on phones.
- **Auto-linking (D4)** runs on every post in the prototype using the real rules: normalisation like `kfold`, at least 3 characters, exclusion list, Japanese and English boundaries handled separately, #tags and @IDs skipped, once per post. The 設計メモ panel has a live tester that explains why each word was or wasn't linked.

### ② Player Card
- **Universal part** (all games): cover, avatar, name, @ID, bio, joined month, and follow counts as one inline line. The counts are links, as on X-like sites, but styled in Game Kid/s greys; the four-box stats card from today is simplified to reduce visual weight.
- **Game profile card** for Pokémon Champions: the header with game mark and visibility, then partner, ranks, and showcase team as separated sections inside one card, so there are no cards inside cards. A footer line explains that other games will appear in the same shape (D3; no switcher and no featured-game setting while there is one game, D2).
- **Ranks (D1).** 確認済み is a tinted badge with a tick. 自己申告 is a dashed outline with no icon, deliberately weaker. A one-line legend explains that self-reported results are not used in rankings or statistics. "＋ 追加" appears only for the owner and points at the existing season-results form (U8).
- **Private game profile.** The prototype bar has "見る人：ほかの人／本人" and "ゲームプロフィール：公開／非公開":
  - **Others:** the game section is replaced by a neutral empty state, and the cover falls back to the user's colour plus the theme colour, so the private partner's type colours don't leak.
  - **The owner:** sees the section with an amber "非公開・あなただけ" label.
  - This shows the constraint that featured-game fallback must never expose a private profile (D2, U1).

### ③ Party sharing
- **Three explicit steps:** pick a team (empty slots are disabled with a reason), choose how much to show, then check exactly what will be posted. On phones the tab bar is replaced by a fixed bottom bar with やめる / この内容で投稿する, so the main action is always reachable.
- **Disclosure levels.** ポケモンだけ is the default and matches today's showcase. The top level is now "＋ 技・性格"; stat points (能力ポイント) were removed from it until U3 is decided, rather than deciding it silently.
- **What is never shared** is always visible in a locked box: tactical notes, battle-plan notes, selection plans and match records.
- **Snapshot demonstration.** A yellow prototype-only panel lets you edit the source team (カイリュー → ドラパルト). The preview of the next post changes, but already-posted snapshots do not. Posting from this screen adds the post to the feed with a dated snapshot and a "このパーティを使う" button.

### ④ Background settings
- **Presets:** 光 (today's glow, default, with 弱め/ふつう/強め), 夕暮れ, 六角形, なし, 画像. Each swatch is drawn in the current theme. Every choice changes the whole screen behind the panel immediately (live preview), and "元に戻す" resets to 光 + purple.
- **Custom image.**
  - Two sample images drawn by the page itself, plus a working local file picker. The file is shrunk to 1280px and never leaves the page.
  - Overlay slider ("暗さ" in dark mode, "明るさ" in light mode) and blur.
  - A readability meter shows the real WCAG contrast ratio between body text and the average image colour after the overlay, with the 4.5:1 target marked on the bar.
  - "読みやすさを保つ" (on by default) stops the slider below the minimum readable overlay. Turning it off lets you see the warning state.
- **Sync clarity (D5, D6).** Two rows state exactly what syncs (preset, theme colour, glow strength) and what stays on this device (the image and its overlay and blur). Behaviour on a device without the image is U4.
- **Mobile performance.** The prototype uses a live CSS blur only to preview. The production plan renders the blur once into the stored image.

## 3. Prototype-only parts (never in the product)
Everything with a **yellow dashed border or yellow badge**:
- the top bar (screen, PC/phone, dark/light, viewer and visibility switches);
- the numbered yellow pins and the 設計メモ side panel;
- the toast messages, which always start with a 「見本」 badge;
- the snapshot test panel on the sharing screen.

Buttons that would leave the four screens (search, tools, messages and so on) show a 「見本」 toast instead of navigating.

## 4. Accessibility checks done
- Text contrast meets 4.5:1 for body text in both themes. The background meter enforces 4.5:1 for custom images by default.
- Every icon-only button has an `aria-label`. Toggles use `aria-pressed`, single choices use `role=radio` with `aria-checked`, and the category menu uses `menuitemradio`.
- Visible focus ring (`:focus-visible`), Esc closes the menu and the notes panel, and `prefers-reduced-motion` disables animations.
- Tap targets are 44px or more for post actions; the phone layout was checked at 390px with no horizontal page scroll.

## 5. Open questions surfaced by the prototype
Listed in `plan.md` §7 (U1–U11) and inside the prototype's 設計メモ panel. New in v2:
- **U10.** Show post counts per category in the right column?
- **U11.** Size limit and inappropriate-image handling for custom backgrounds (device-only, so moderators can't see them).
- **U3** (refined). Stat points are excluded from sharing until decided.
