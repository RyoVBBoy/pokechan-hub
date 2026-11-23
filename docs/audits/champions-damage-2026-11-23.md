# Pokémon Champions damage audit — 2026-11-23

Scope: source review on repository main, isolated changes on audit/champions-damage-format-20261123. No game-device verification or executed regression test yet.

## Confirmed in source

- src/js/15-battle.js `bcalc` applies spread damage via `o.spread` and selects the screen modifier with `o.spread ? 2732 : 2048`. This couples wall strength to multi-target damage rather than an explicit battle format. Do not assert a Champions-specific correct multiplier without direct evidence.
- src/js/21-calc.js `calcOpt` passes `spread: FMT==='double'&&CS.spread`, while the UI has a separate wall toggle. The battle format does not reach `bcalc` as an independent option.
- tests/calc-cases.mjs previously used `gameType:o.spread?'Doubles':'Singles'` for the external reference, preventing double/single-target independent coverage. This branch introduces explicit `o.format` for reference selection and sets case 10 to `format:'double'`. It does not alter production damage math.
- src/js/16-assist.js has a `bcalc(a,mv,d,{})` caller, so screen/spread flags are absent at that call. Trace all current diagnosis, selection, and counter callers before concluding the impact is confined to the calculator.
- src/js/21-calc.js lists `unaware`, `marvel-scale`, `friend-guard` and others in `CALC_UNIMPL`. Verify their actual effect and active callers; a UI warning does not implement their mechanics.
- `bhits` uses `!o.spread` for Parental Bond eligibility. Any change to spread semantics needs regression checks here.
- `hitDist` builds independent per-hit random damage distributions. It is a source implementation, not proof of Champions mechanics.

## Required follow-up

1. Establish Champions-specific evidence for singles/doubles screen multipliers and exact rounding. Mark unverified if unavailable.
2. Independently model battle format, target count, and screen condition; avoid changing production multipliers until evidence exists.
3. Add regression scenarios: doubles single-target with and without Reflect/Light Screen; doubles multi-target with and without screens; critical-hit variants; physical and special moves; Parental Bond.
4. Trace all current calculator/diagnosis/selection/counter calls to `bcalc`, `bhits`, and `dmgRolls`.
5. Execute tests with dependencies in a clean checkout and record exact commands/results. The existing Gen 9 Smogon comparison is not an independent Pokémon Champions verification.

## Change status

- Test harness reference-format decoupling: committed on audit branch.
- Production calculations: unchanged.
- Test execution: not yet performed.
- Main branch: unchanged.

## 2026-11-23 follow-up: real-data test harness audit

- `tests/calc-ref.mjs` previously generated `spread` randomly and inferred Smogon `gameType` from `spread`. This made doubles single-target scenarios impossible. The audit branch now generates `format` independently and restricts spread attacks to doubles, while the reference `Field` uses `format`.
- `tests/calc-cases.mjs` now has 40 named Pokémon-data cases, including #37–40 for doubles single-target physical/special attacks with screens and critical hits. Its `Field` and the site calculator receive the same explicit format.
- The changes were read back from GitHub and checked for the intended source patterns. This is **not** a successful Playwright/@smogon/calc test execution.
- The local runtime could not reach GitHub over the network, and no complete repository checkout or installed Playwright/Smogon environment was available to run the existing integration tests. Do not claim 40/40 or 1500/1500.
- Required commands in a clean checkout of this branch: `npm ci`, `npm run build`, `node tests/screen-format-regression.mjs`, `node tests/screen-damage-regression.mjs`, `node tests/calc-cases.mjs`, `CALC_N=1500 CALC_SEED=20261123 node tests/calc-ref.mjs`. The browser tests require a working Playwright Chromium installation.
- Important: @smogon/calc Gen 9 is a comparative oracle, **not** proof of Pokémon Champions game-specific mechanics. Investigate any new double single-target mismatches; do not weaken assertions or revert independent format generation merely to obtain green tests.
