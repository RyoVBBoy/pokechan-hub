# Independent reference audit — 2026-11-24

## Evidence tiers and release gate
- **DEVICE**: reproducible Pokémon Champions capture/log with version, full stats, move, field, RNG/damage observation. No qualifying fixtures are currently committed. Device-accuracy claim **BLOCKED**.
- **INDEPENDENT IMPLEMENTATION**: @smogon/calc Gen 9, Champions-oriented PokeCalc, NCP calculator. Useful to identify disagreements, but multiple sites may share Showdown mechanics/code and are **not independent device observations**.
- **INVARIANT**: monotonicity, critical/screen bypass, format relationships. Valid regression constraints, **not numeric game truth**.
- **SELF**: output generated from the same production bcalc or mocked fixtures. Never label as independently verified.

## Source audit and conflicts
1. The repository's `tests/calc-ref.mjs` explicitly uses `@smogon/calc` Gen 9; `tests/calc-cases.mjs` also derives most numeric expectations from Smogon. 1500/1500 is **comparative agreement**, not Champions verification.
2. `src/js/15-battle.js` contains damage paths for Choice Band, Choice Specs and Assault Vest; `tests/calc-ref.mjs` includes those items in random reference generation. Independent Champions M-C reference PokeCalc reports these three items **not legal in Regulation M-C**, while Choice Scarf is legal. Confirm against official/current regulation list before enforcing any exclusion; if confirmed, filter invalid fixtures separately from mechanic correctness. This is a **legality/coverage issue**, not proof that their damage multipliers are wrong.
3. `src/js/21-calc.js` explicitly lists Iron Ball, Metronome and four terrain seeds as unsupported in calculation. The calculator's own warnings must propagate through diagnosis and selection; ensure any high-impact unknown does not yield a definitive ◎/○/△/× or ranked recommendation.
4. Source `src/js/15-battle.js` uses `chM=(c*m+2048)>>12` and `apM=(v,c)=>pR(v*c/4096)`. Independent PokeCalc describes 16.12 fixed-point, modifier chaining, half-down rounding. These agree in *approach*; exact operation order and all intermediate floors still need case-by-case differential validation. A generic webpage displaying one product of multipliers cannot prove the order.
5. Independent references describe doubles screens as approximately 2/3 damage and singles screens as 1/2, critical hits bypassing both. Verify with actual 16-roll outputs, not only `singles < doubles < unscreened`.
6. The existing diagnosis-selection synthetic rating test proves propagation of changed ratings, not correctness of source damage or matchup thresholds. End-to-end real-set fixtures remain mandatory.

## Independent sources (secondary; not device proof)
- https://github.com/tinoxo/PokeCalc — Champions M-C calculator; details fixed-point chain and M-C legality; claims agreement with Smogon, therefore **correlated evidence**.
- https://github.com/D35P4C1T0/pkmn-dmg-lib-rs — Rust port with pinned NCP reference, rounding and broad differential coverage; **correlated implementation evidence**.
- https://mypokepanion.com/en/champions/guide/damage-calculation/ — descriptions of screen/critical/weather/items; explanatory secondary source.
- https://dexdb.io/calc/ — Champions-specific calculator, also built on Smogon; not independent device evidence.

## CI status
`.github/workflows/damage-audit.yml` executes focused regressions, browser comparisons, 40 named cases, and 1500 random cases. The separate device-evidence gate is configured `continue-on-error: true` so a comparative CI green cannot be mistaken for device validation. **The gate's failure is intentional until genuine observations are recorded.** Its metadata validation is not yet a replay oracle. GitHub Actions logs have not been verified in this audit session.

## Next engineering requirements
1. Fetch Actions push-run logs and artifacts; record exact commit SHA, job conclusions, named-case and random-case mismatch reports. Fix failures without weakening expectations.
2. Build an item inventory from `CH_ITEMS` and every `bcalc` item branch; join to official Champions M-C legal list and effects, mark `supported`, `unsupported`, `not damage relevant`, `illegal`, `unknown`. Distinguish current item from an item's previous-turn effect (berry/terrain/consumption).
3. Replay sourced fixed-case 16-roll expectations from at least two independently implemented calculators; preserve discrepancies rather than averaging or choosing a winner. Record provenance and version.
4. Obtain primary/device observations for the high-risk rounding/modifier combinations and compare production output against them, including critical + screens + spread, item + ability + weather, ranks + Unaware, multi-hit + berry.
5. Execute actual `bcalc -> dgMatch0 -> dgTeam1 -> dgSelect` with legal Pokémon/builds and document damage, KO, switch-in and ranking changes. Unknown mechanics should never be silently promoted to a definitive recommendation.
6. Only after the above and verified CI may the project claim complete Champions damage accuracy. No merge/deploy without approval.
