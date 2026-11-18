# Player Card V3.4 — design rationale

Date: 2026-11-18 · Status: proposal for owner review · Scope: the Player Card screen only.
V3.4 is a new direction for the profile. It isn't a polish of the current profile UI. It reuses V3.3's tokens and patterns:
- surface colours and elevation (`--raised`, `--lift`, `--hl`);
- the text levels `--t1` to `--t4`;
- the brand purple and its text variant;
- the symbol plate (neutral plate plus inner ring);
- the bottom bar with the action inside it.

Nothing in V3.3 or the application was changed.

## Pillar 1 — the Player Card as one object
- **One raised surface.** The identity, the game plate, the season record and the showcase all live on a single charcoal card with V3.3 elevation: a slightly lighter top, a soft long shadow and a 1px top highlight. Posts sit outside the card, on the reading surface. The card reads as a thing you hold, and everything below it as activity.
- **The cover is a window, not a banner.** It is a rounded plate inset 6px inside the card, in purple-tinted near-black. Its geometry was made for this screen:
  - a hexagon lattice that fades in from the left;
  - two diagonal facets;
  - the partner's stat shape drawn as a crisp purple outline inside two concentric hexagons.

  It uses one hue only, with no type-colour gradient, no gold and no faded watermark. It is also lower than before: 104px on phones, 128px on desktop.
- **The avatar is anchored.** It sits half on the cover edge, and a 5px ring in the card's own colour cuts it out of the cover. Actions sit on the same baseline to its right, and name, @ID and join date sit directly under it. Together they read as one identity group.
- **No divider lines.** Stats and join date use spacing, not 1px rules. Groups are separated by surface steps (card → well → inner well), not by borders. No dashed boxes.

## Pillar 2 — the game identity plate
- A module per game pack (`GAME` in the source: id, name, colour and an emblem function).
- **44px symbol plate** in V3.3's treatment: neutral backing, a light tint of the game colour and an inner ring. The emblem is original: a hexagon split into six facets. No official artwork.
- **Hierarchy:** the game name comes first (16px, 800), then 「相棒」 with a 20px partner symbol and name (13px).
- **Two facts:** main format, and the number of verified results. The best placement isn't repeated here because the season record leads with it.
- For the owner, the plate shows its effective visibility (「フォロワーのみ」) when it is narrower than public, plus an edit affordance. Visitors get a chevron to the partner's dex page.
- The plate is the header of the game section. Results and the showcase sit under it inside the same well, so another game can bring its own plate and section without changing the card.

## Pillar 3 — the competitive season record
- **Headline** (only when a verified result exists): a large 「8位」 (46px tabular figures), labelled 最高位 with season, format and tier. It sits on a subtly brand-lit well and carries the verification seal at the right.
- **Rows:** each row reads tier mark, season, format · tier, placement, then seal. Placements are right-aligned tabular figures (22px), so they line up like a ladder. The latest three verified results are shown, then 「もっと見る（N件）」.
- **Tier marks:** a hexagon filled from the bottom. 1-digit finishes are full, 2-digit two thirds and 3-digit one third. It's original geometry and reads at a glance.
- **Verification seal:** a small hexagon with a check, in the brand text colour, with the word 確認済み in the headline. It's restrained: no gold, no glow.
- **Self-reported results** form a separate, quieter group on a dimmer well. The heading is 「自己申告 · 運営者の確認はまだです」 and the tier marks are grey outlines only. Every row carries the 「自己申告」 tag, so nothing borrows credibility.
- **Explanation:** the long sentence is gone. 「確認済みとは」 opens a small dialog with the two definitions.

## IA and policy kept
- Four source categories, defined in the IA. Only 確認済み and 自己申告 appear on the card; 記事から集計 and 運営が登録 never do (IA §7).
- Latest three verified results, then 「もっと見る」 (A23).
- Join date reads 「利用開始：YYYY年M月」 (A24).
- No likes-received count (A12).
- **Private account, non-follower:** identity, lock, counts and 「フォローをリクエスト」 only. The game section and posts are absent, not placeholders (IA §6.3).
- **No game profile:** visitors see no trace of it. The owner sees one optional 「ゲームのプロフィールを追加」 row (IA §8.1–8.2).
- **⚡ action:** inside the bottom bar as V3.3's hexagon, so nothing floats over the card.

## Checks run (Playwright, Chromium)
**214 of 214 passed.** The checks cover 390px and 1280px × 3 viewers × 3 data states × public/private. They found:
- no page errors, no horizontal overflow and no clipped text;
- no card text under 11px;
- content never behind the phone bottom bar when scrolled to the end;
- locked view: no game information;
- no-game view: no trace for visitors;
- no headline without a verified result;
- headline and seals present when verified results exist.

Found and fixed during the work:
- a hashtag breaking mid-word;
- the join date stranded on its own line;
- the showcase names cut off at six columns on phones (now three columns);
- the visibility badge stretching to full width;
- a duplicated private-account message;
- the add-game row's text being centred;
- a 10px note.

## Open points for the owner
- The headline repeats the best result, which also appears as a row. I chose a full history over removing the row.
- Light theme and the multi-game chip row aren't drawn yet. The tokens exist from V3.3.
- The avatar fallback (initial on a colour) is unchanged from production.
- Not checked on a real iPhone.
