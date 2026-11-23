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

## 2026-11-23 full damage-pipeline static audit (first pass)

**Execution status:** The existing 40-case Playwright + @smogon/calc suite and the 1,500-case randomized suite were **not run**. GitHub is reachable only via the connected GitHub tool; the local terminal cannot resolve github.com, and the required repository checkout, built dist, and browser dependencies are not present. No numerical pass rate is asserted.

**Test infrastructure:** `tests/run.mjs` previously omitted both newly added wall regressions. The audit branch now includes `screen-format-regression.mjs` and `screen-damage-regression.mjs` in the default test runner, ahead of `calc-cases.mjs` and `calc-ref.mjs`.

### Confirmed source observations

- **Battle format / screens:** `src/js/21-calc.js` passes `format:FMT` separately from `spread`. `src/js/15-battle.js` uses the explicit format for the wall factor (with a legacy fallback). `tests/calc-cases.mjs` now has 40 named scenarios, and `tests/calc-ref.mjs` generates format independently of spread. All these are source-verified, not end-to-end executed.
- **Abilities:** `src/js/21-calc.js` explicitly flags `unaware`, `marvel-scale`, `friend-guard`, `infiltrator`, `cloud-nine`, `sheer-force`, `sniper`, `fluffy`, `purifying-salt`, etc. as not reflected in calculation. `bcalc` has no dedicated branches for these examples. This means tests using only implemented abilities cannot establish full coverage.
- **Items:** `src/js/21-calc.js` flags `ironball`, `metronome`, and terrain seeds as unsupported. `bcalc` does implement several attack/defense/power/final item modifiers, but its item handling is not exhaustive.
- **Weather:** `bcalc` applies sun/rain damage factors, snow physical-defense boost, sand special-defense boost, and selected ability modifiers. There is no exhaustive Champions-device verification for combined weather, abilities, and items.
- **Critical hits:** `bcalc` removes negative attacking ranks, positive defending ranks, and the wall factor on critical hits. The precise game-specific intermediate rounding and exceptions remain unverified.
- **Stat ranks:** `stgV` computes floor of scaled stats. `bcalc` applies the stat ranks before attack/defense modifiers. The exact device rounding order has not been confirmed.
- **Calculation order:** source pipeline is variable power -> chained power modifiers -> attack stat/rank/modifiers -> defense stat/rank/modifiers -> base damage -> spread -> parental-bond -> weather -> critical -> random -> STAB -> effectiveness -> burn -> chained final modifiers (screens, multiscale, filter, tinted lens, items). The order is source-confirmed; **not** confirmed as Pokémon Champions' game rule.
- **Rounding:** `pR` uses ties-down rounding; `chM` uses `(c*m+2048)>>12`; `apM` uses `pR(v*c/4096)`; basic damage and random stages use floor. Compound intermediate rounding is not proven against the game.
- **Actual consumers:** `src/js/16-assist.js` uses `bcalc(a,mv,d,{})` inside `estHit0`; `src/js/56-duel.js` also uses `bcalc(...,{})` for priority attacks. These calculations are not automatically protected by the calculator UI's unsupported-ability warnings. Confirm diagnosis/selection user-facing impact before release.
- **Old simulator separation:** `src/js/15-battle.js` includes an old battle-simulator section; do not confuse it with the current party diagnosis. The `bcalc` function is shared and is called by current selection/duel code.

### Risks and next action

1. Run the full built-site tests on this branch: `npm ci && npm run build && node tests/screen-format-regression.mjs && node tests/screen-damage-regression.mjs && node tests/calc-cases.mjs && CALC_N=1500 CALC_SEED=20261123 node tests/calc-ref.mjs` (install Playwright Chromium as needed). Capture every mismatch and its conditions; avoid reporting a green result without logs.
2. Audit the missing ability/item behavior and whether the party-diagnosis/selection consumers should warn or omit unsupported comparisons.
3. Compare the order and rounding of stacked modifiers against Champions primary evidence; @smogon/calc Gen 9 is only a reference implementation, not an authoritative Champions specification.

## Additional independent work without Claude (2026-11-23)

- Executed the fetched production `bcalc` body in a sandbox with neutral dependency stubs for **1,500 deterministic generated conditions** (seed 20261123). Checked `screenDamage <= noScreenDamage` and `criticalScreenDamage === criticalNoScreenDamage` across varied attack/defense stats, rank stages, physical/special moves, power, formats, spread, and random rolls. **1,500/1,500 invariant checks passed; zero violations.** This is **not** the pre-existing 1,500-case @smogon/calc comparison and **not** Champions device validation.
- Committed `tests/screen-property-regression.mjs` to reproduce the above neutral-fixture invariant test under Node; added it to `tests/run.mjs`. The newly committed file itself was read back from GitHub, but **was not run in Node** here.
- Found and fixed an independent test-harness defect in `tests/calc-cases.mjs`: when `CALC_CASES_REPORT` was set, the ESM script called `require('fs')` without declaring `require`; changed to `import {writeFileSync} from 'node:fs'` and used the import. The optional JSON report path was previously liable to fail after the assertions.
- Still blocked: actual Playwright/@smogon/calc runs for 40 named and 1,500 randomized comparisons; exact game-specific modifier order/rounding and missing abilities/items.

## Priority audit: unsupported abilities/items in current diagnosis and selection (2026-11-24)

**Confirmed impact chain:** `src/js/60-diag.js` `dgMove` calls shared `bcalc` at min/max rolls; `dgBest` and `dgMatch0` derive KO, survival, switch-in, and match category; `dgTeam1` aggregates opponent categories; `src/js/61-select.js` `dgSelect` ranks selection combinations from those categories. Therefore unsupported damage abilities/items can bias both diagnosis and selection. The simpler `estHit0` path in `16-assist.js` and `duel` also uses `bcalc` and needs further review.

**Confirmed warning gap:** Diagnosis previously relied on `ABIMPL` and `DG_SIMONLY` to build `T.unk`. The calculator has a separate explicit `CALC_UNIMPL` and `CALC_UNIMPL_IT` list; effects in that list were not reliably represented by the diagnosis warning. Item effects were absent from this warning altogether. The selection UI did not surface `T.unk` next to its rankings.

**Branch changes:** `src/js/60-diag.js` now detects explicitly unsupported calculator abilities/items on both the user's team and opponents, incorporates them into `T.unk`, and shows a visible provisional-results caveat when present. `dgPremise` now labels these as unsupported *effects*, not only abilities. `src/js/61-select.js` now displays a caveat for selection ranking, leads, and switch-in outcomes when `S.T.unk` is nonempty. These are warning/accuracy-label fixes, **not implementations** of the missing effects.

**Isolated test:** Evaluated the fetched production `dgCalcUnsupported` with the actual calculator's unsupported lists: unaware, marvel-scale, friend-guard, ironball, and a supported combination; **5/5 passed**. Added `tests/diagnosis-unsupported-regression.mjs` with further assertions and registered it in `tests/run.mjs`. The new Node test file itself is not executed here.

**Remaining:** Determine whether the effects should be implemented in shared `bcalc` and whether a stronger strategy than provisional labels is needed for high-impact rankings. Validate the full site/browser UI, build, and 40/1,500 Smogon comparison. No Pokémon Champions device-accuracy claim.

## Diagnosis-to-selection impact regression (2026-11-24)

Verified from source: `dgMove` -> `dgBest` -> `dgMatch0` -> `dgTeam1` -> `dgSelect`. The selection function scores opponent coverage, switch-in wins, speed, one-hit danger and role coverage; a modifier error can alter both labels and rankings.

Added `tests/diagnosis-selection-impact-regression.mjs`, registered in `tests/run.mjs`. The fixture executes the **actual extracted `dgSelect` source**, with synthetic `dgTeam` inputs representing boundary changes in matchup ratings and switch-in wins. In the isolated evaluation, an A/C selection ranked first when A's matchups had rating 4 and switch-in wins; changing those ratings to 1 and assigning rating 4 to B instead switched the first selection to B/C. For the best selection, four opponent matchups were ○ (rating 3 aggregate) and four switch-in wins; the runner-up had four × (rating 1) and zero switch-in wins. This proves that such changes propagate through the ranking algorithm, **not** that a specific ability or item changes Pokémon Champions damage by a given amount.

Outstanding required verification: construct real Pokémon/set fixtures with known Champions mechanics for unaware, marvel-scale, friend-guard and relevant items; execute shared `bcalc` and full `dgMatch` / `dgTeam` / `dgSelect` end-to-end, record before/after damage, KO counts, matchup category, switch-in classification and ranking. Current fixture uses synthetic ratings; do not count it as Champions mechanics validation. Run the committed Node test in the project checkout and perform browser tests before marking complete.

## Pokémon species-stat ability integration progress (2026-11-24)

Cross-checked the Champions-specific Unaware rule against Smogon Champions ability documentation and the Champions damage-calc source. Implemented in shared `bcalc`: defender's Unaware ignores the attacker's offensive rank, attacker's Unaware ignores defender's defensive rank, and Mold Breaker ignores defender Unaware. Implemented Marvel Scale: a statused defender's physical defense is multiplied by 1.5, subject to Mold Breaker. Added both to `ABIMPL`, removed both from `CALC_UNIMPL`, and updated warning regression expectations.

**Executed isolated real-source comparison:** Used actual Pokémon base stats from `src/js/02-data.js` for Garchomp (445), Skeledirge (911), and Milotic (350), the site's confirmed zero-AP neutral stat formulas, and the extracted production `bcalc` with neutral stubs. A **controlled 80-power Normal physical move** was used; it is NOT a Pokémon move-availability fixture or a Champions game log. Against Skeledirge with attacker's Attack +2: no Unaware 135, with Unaware 69 (HP 179; 2-hit vs 3-hit ceiling). Against Milotic: Marvel Scale inactive 82, active with burn 55 (HP 170; 3-hit vs 4-hit ceiling). No full real-data matchup/selection ranking was executed. These damage values use neutral effectiveness and simplified dependencies; they are not authoritative Champions damage outputs.

Added `tests/champions-ability-data-regression.mjs` and registered in `tests/run.mjs`; Node execution of committed file and full browser/build regression remain outstanding. Prior synthetic `dgSelect` regression proved rankings can change when inputs change, but did NOT verify that these two Pokémon-specific damage changes alter a real party's ◎○△×, switch-in result, or ranking.

Further checks required: crit interaction with Unaware, Foul Play/Body Press, Mold Breaker, actual damage reference comparison, real `dgMatch0` and `dgSelect` integration, supported item list, and double battle ally-dependent Friend Guard. The main branch remains unchanged.

## Real-source diagnosis-to-selection integration (2026-11-24)

Added `tests/ability-diagnosis-selection-integration.mjs` to the default test runner. The isolated evaluation executed the **production source** of `bcalc`, `dgMove`, `dgBest`, `dgMatch0`, `duTurns` (from `56-duel.js`), and `dgSelect`, using actual base-stat rows from `02-data.js` for Garchomp #445, Snorlax #143, Milotic #350, and Skeledirge #911. Controlled neutral physical moves and fixed speed values were used to exercise boundary behavior; ancillary dependencies (type effectiveness, accuracy, live usage, weather, selection data access) were stubbed. **Not a real battle log or a full site browser test.**

For a single controlled fixture with Garchomp Attack +2, Skeledirge as opponent, and Milotic as fixed selection axis:
- Without Skeledirge Unaware: Garchomp's `dgMatch0` returned `ko_fast` (r=5), `swIn='win'`, minimum KO turns 4; `dgSelect` ranked Garchomp + Milotic first.
- With Skeledirge Unaware: Garchomp's `dgMatch0` returned `lose` (r=1), `swIn='survive'`, minimum KO turns 6; `dgSelect` ranked Snorlax + Milotic first.
- The opponent rows were repeated controlled fixtures to test ranking propagation, not four distinct real opponent sets.
- This verifies the calculation-to-diagnosis-to-selection wiring under controlled fixtures. It **does not** establish a specific Champions match's recommended selection.

A follow-up review identified a Foul Play edge case: the defender's Unaware should not zero its **own** Attack stage when the attacker uses Foul Play (`ee.fp`). The shared calculator was corrected and regression assertions added for Foul Play and negative-rank Unaware.

Remaining before production completion: execute Node regression files and 40/1500 external comparisons in the full checkout; verify actual Champions battle mechanics with evidence, real move availability, full party data and distinct opponent sets; audit Friend Guard ally-dependent doubles, item effects, critical interaction, special category, and cross-feature impact. Main remains untouched.

## Automated CI without Claude (2026-11-24)

Created `.github/workflows/damage-audit.yml` on the isolated audit branch. It is restricted to pushes on `audit/champions-damage-format-20261123`, uses Node 22 and npm dependencies, runs focused ability/screen/diagnosis/selection regressions, installs Chromium, builds the static site, then runs the 40 named cases and the seeded 1,500-case `@smogon/calc` comparison. **It has no deployment or main-branch write steps.**

GitHub accepted the workflow file and subsequent update, but **workflow run status and logs were not accessible** through the current connected GitHub tool. The combined status endpoint reported no statuses on an earlier workflow commit; this is not a pass or failure. Do not claim the 40/1500 suite passed without actual logs. CI may require GitHub Actions to be enabled and permitted for the branch.

The isolated JavaScript evaluations of production source did show the expected Garchomp/Skeledirge Unaware rating, switch-in, and selection changes with both the production `duTurns` and `dgMatch0`. A reproducible Node test is committed, but its Node execution is still unverified.

## Additional ability/critical/doubles audit (2026-11-24)

The user supplied screenshots showing the GitHub Actions `Damage audit (no deployment)` workflow succeeded at commit `5cdf080`, with green steps for focused regression, browser build, 40 named cases and 1,500 random reference cases. The logs' numeric output was not captured, so the verified fact is that each step exited successfully, not that all Champions mechanics were proven.

New source inspection confirmed the selection assist explicitly models doubles as collections of 1v1 matchups (`61-select.js` header and premise); ally-dependent Friend Guard, spread mechanics in 2v2 and simultaneous moves are omitted. Added an **immediately visible** Japanese provisional-accuracy notice to doubles selection UI rather than implying those rankings are validated.

Fixed `calcSig` in `21-calc.js` to include `CS.hits` and `CS.protean`, which are selectable calculation options and were omitted from the operation fingerprint. Added `tests/ability-critical-double-matrix.mjs`: source-based matrix for Unaware ranks -6..+6 with/without critical, Marvel Scale status conditions, screens in single/double spread/non-spread, and calculator fingerprint coverage. Registered it in both `tests/run.mjs` and the branch-only GitHub Actions workflow.

These new changes are **not yet CI-confirmed**. The connected GitHub commit-run/status lookups for `cd12bc3` returned empty arrays; this is not a failure or success result. No Champions-device proof is available for precise damage ordering/rounding or omitted ally/item mechanics. The audit is not complete; main is unchanged.

## Restarted audit: strict reference acceptance (2026-11-24)

Reviewed the actual `tests/calc-ref.mjs` source and found that the previous success gate was `cases.length<N*.8||rate<.999`: it permitted as few as 80% of the requested cases and could accept a small number of mismatches. This invalidates any interpretation of a green 1,500-case step as proof of **exactly 1,500/1,500 matching**. Tightened the gate to `cases.length!==N||bad.length!==0`, requiring all requested cases and zero mismatches. The previous green run at commit `5cdf080` used the weaker gate. A new CI run is needed before claiming strict 1,500/1,500.

Executed `tests/ability-critical-double-matrix.mjs` logic in a JavaScript isolate against the fetched production `15-battle.js` and `21-calc.js` sources (Node import/read bindings replaced with equivalent source bindings). Result: **55 boundary invariants passed**, including Unaware across stat ranks/critical, Marvel Scale statuses, screen/spread/format interactions, and calcSig input coverage. The committed Node file and CI execution still need confirmation. These invariants establish internal consistency, **not** Pokémon Champions device-level truth.

Further verification remains essential for actual Champions game mechanics, unimplemented abilities/items, doubles ally effects, distinct real opponent builds, and UI/browser end-to-end behavior. Do not mark complete.

## Continued audit: auditable CI reference evidence (2026-11-24)

Reviewed current `tests/calc-ref.mjs` and `tests/calc-cases.mjs` source. Confirmed the random test now requires `cases.length===N` and `bad.length===0` to pass. The 40 named-case runner exits nonzero when its assertion counter reports a failure, but its test suite includes cases based on rules not independently established for Champions and cases using abilities not supported by the reference; therefore a green result is not complete Champions verification.

Added `CALC_REF_REPORT` support to the random test, saving requested/generated/matched/mismatched counts, seed, pass status, and up to 20 mismatch details as JSON. Updated the audit workflow to save both the fixed-case report (`CALC_CASES_REPORT`) and random report as a downloadable `damage-audit-reports` artifact, including when a step fails. This makes future CI results independently inspectable rather than relying only on green job badges. **New CI run and artifacts have not yet been observed through the connected tool**; no pass is claimed for these commits.

Outstanding: verify CI report contents; correct any strict-reference mismatches; distinguish Gen9 Smogon comparisons from Champions device-confirmed mechanics; cover unsupported ability/item effects and ally-dependent doubles; run full actual-party diagnosis/selection comparisons. Main and production remain unchanged.

## Traceable pass/fail evidence and coverage (2026-11-24)

Added coverage counters to `tests/calc-ref.mjs`'s JSON report: singles/doubles, criticals, spread, screens, attack/defense abilities and items, nonzero attack/defense ranks, and intersections (critical+screen, double+spread+screen, critical+nonzero rank). These are observed counts from the generated randomized cases, **not coverage guarantees**.

Added a GitHub Actions `Summarize auditable results` step with `if: always()`, reporting the exact random reference counts, coverage and missing/invalid report warnings in both the job log and `GITHUB_STEP_SUMMARY`. Both report files are already uploaded as artifacts by an `if: always()` step. This allows evidence inspection even when a preceding test fails, provided the workflow reaches these steps.

Checked the committed YAML after correcting template interpolation and newline escaping. New workflow run and report contents have **not been fetched or confirmed**. GitHub's available commit-to-run connector only returns pull-request-triggered runs, and an attempt to open the Actions page through public web retrieval was blocked. Therefore current status is **instrumented, execution unverified**. Do not infer CI success from the source edits.

The benchmark remains Smogon Gen9; device-specific Champions correctness and end-to-end diagnosis/selection accuracy remain unresolved.

## Fixed-case evidence completeness (2026-11-24)

Inspected `tests/calc-cases.mjs`: the source contains 40 numbered named scenarios, but a green step alone did not distinguish Smogon reference comparisons from rule-based expectations and Champions-unverified abilities. Added an assertion requiring **exactly 40 distinct case numbers**, plus `CALC_CASES_SUMMARY` output with assertion total, failed assertion details, number of comparable cases, rule-based cases and unverified ability cases. Updated the branch-only Actions workflow to preserve this report and show those counts in its job summary.

The changes are committed to the audit branch; **no new CI pass has been observed or independently verified**. The workflow's source now exposes evidence quality and failures, but device-level Champions correctness and full doubles/diagnosis/selection integration are still outstanding. Never conflate 40 cases with 40 independently verified Champions scenarios.
