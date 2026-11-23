# Pre-release decision boundary (2026-11-24)

This document separates work that may proceed without product-owner judgment from choices that must not be silently made.

## Non-discretionary engineering work
- Keep audit changes isolated on `audit/champions-damage-format-20261123`; do not merge to main or deploy.
- Reproduce GitHub Actions jobs and preserve exact failures, fixtures and SHAs. Absence of a returned PR-triggered workflow run is **not** evidence that push-triggered CI passed or failed.
- Treat Gen 9/Smogon, community calculators, internal invariants and production-generated expectations as separate evidence classes. Do not certify Champions mechanics from correlated references.
- Inventory every item/ability and mark implemented, explicitly unsupported, legality uncertain, or mechanics uncertain.
- Propagate unsupported and unverified effects to calculator, diagnosis and selection. No definitive claim of accuracy when the outcome depends on such effects.
- Create focused regression tests for every confirmed defect, using independently justified expectations when possible. Do not weaken or remove tests to obtain green CI.

## Decisions requiring the owner
1. **Release scope:** must all currently exposed Pokémon, abilities, items, moves and battle formats be fully accurate before public release, or may unsupported mechanics be hidden/disabled with explicit warnings? Default pending decision: no blanket accuracy certification.
2. **Evidence threshold:** how many real-device observations, across which mechanics, are required to call the calculator fully verified? Until agreed, do not use “device-verified” or “complete.”
3. **Legal item filtering:** whether to enforce Regulation M-C item restrictions globally or per battle regulation. Do not remove data or block historical/custom calculations without explicit scope approval.
4. **Diagnostic confidence:** whether unknown mechanics should suppress numerical grades/rankings altogether, or display provisional grades with conspicuous warnings. Current behavior is provisional; changing it is product policy, not just a calculation fix.
5. **Deployment and merge:** explicit owner approval required. Never merge or deploy as a side effect of CI success.

## Stop conditions
Do not announce “完成しました” until (a) CI logs and all required jobs are independently confirmed successful for the exact audited SHA; (b) real-device expected values are independently sourced, replayed and reviewed for agreed coverage; (c) the exposed mechanics and diagnosis-selection paths pass scoped tests; (d) owner decisions above are resolved; and (e) deployment is separately authorized if requested.

**Current decision status:** no owner decisions presumed; completion blocked. This is an audit artifact, not a request to make those decisions prematurely.
