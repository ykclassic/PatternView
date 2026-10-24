# PatternView — Post-Phase 1 Capability Roadmap

**Principle:** close evidence gates before expanding product scope. PatternView remains crypto-only, read-only, and non-executing until Phase 1 acceptance is complete.

## Stage 0 — Close Phase 1 acceptance (current priority)

**Exit gates**
- [ ] Independently annotate the frozen 72-packet pilot without access to detector outputs.
- [ ] Have a second reviewer independently label and adjudicate every test-split observation.
- [ ] Run `npm run evaluation:run`; preserve the report, label digest, prediction digest, per-pattern confusion counts, and support.
- [ ] Expand the sample beyond the current 72-packet pilot. Current support is too sparse for claims across 15 pattern classes.
- [ ] Run real browser QA at 1440×900 and 390×844: controls, chart overlays, history, loading/retry/error/empty states, keyboard focus, and horizontal overflow.
- [ ] Run a controlled provider-outage drill in a test environment and verify failover plus sanitized errors.
- [ ] Keep production deployment SHA and the 12-combination data smoke matrix in the acceptance evidence.

**Release rule:** until all gates pass, do not advertise accuracy, predictive edge, profitability, or production-grade detector quality. Do not add new market classes as a substitute for acceptance.

## Stage 1 — Historical coverage and detector quality

- Expand candle history through paginated exchange APIs and retain per-series source provenance and hashes.
- Include multiple market regimes, volatility conditions, and both positive and negative examples; keep chronological train/validation/test splits and prohibit overlapping packet windows.
- Add annotation adjudication tracking and class-support thresholds before publishing metrics.
- Revisit detector thresholds only on train/validation data; never tune against the held-out test split.
- Version each rule change and regenerate frozen predictions under a new rule version rather than mutating existing artifacts.

## Stage 2 — Crypto UX reliability

Only after Stage 0 passes:
- Improve accessible chart/overlay explanations, empty/error/retry messaging, and mobile navigation based on observed QA findings.
- Consider exportable scan reports and user-controlled, read-only alerts.
- Decide explicitly whether scan history should remain browser-local or become account-synced; if persistence expands, define privacy, retention, deletion, and cross-device semantics first.
- Keep all alerts and reports informational; no order placement or exchange credentials.

## Stage 3 — Additional crypto capabilities

Only add patterns when independently labeled examples support the class:
- Add a pattern only with positive, negative, invalidation, and near-miss fixtures.
- Keep a versioned pattern catalogue with required evidence, confirmation state, invalidation rule, and known limitations.
- Require per-pattern sample counts and temporal holdout results before surfacing a new pattern as a qualified finding.
- Avoid adding dozens of low-support patterns simply to increase catalogue size.

## Stage 4 — Forex and equities as separate market adapters

Forex and stocks are future updates, not Phase 1 scope. Do not implement them as symbol-list additions alone.

Before enabling either market, design and test:
- A market-instrument abstraction separate from crypto spot pairs.
- Provider-specific symbol mapping, trading calendars/sessions, holidays, time zones, session gaps, price precision, and corporate-action handling where relevant.
- Source licensing, rate limits, fallback behavior, freshness, and provenance.
- Instrument-specific candle validation and historical coverage.
- New acceptance matrices and provider-outage tests for each market.

Roll out one market class at a time behind explicit capability flags. Crypto acceptance must remain green independently.

## Stage 5 — Statistical ranking or ML assistance

Defer ML until:
- Reference labels have stable adjudication and adequate positive/negative support for each target class.
- A frozen rule-based baseline exists.
- Walk-forward evaluation, leakage controls, calibration, drift checks, and reproducibility are implemented.
- ML only changes ranking/explanatory prioritization; it must not fabricate detections, hide uncertainty, or convert an unqualified pattern into a trade recommendation without explicit evidence.

## Explicit non-goals

- No order execution, broker connectivity, or trading automation.
- No claims of guaranteed accuracy or profitability.
- No forex/equities before their own data and market-semantics acceptance.
- No model tuning against the final test set.
- No persistent user data until its privacy and retention contract is approved.

## Decision checkpoints

At each stage, publish: scope, acceptance matrix, test results, artifact versions/digests, known limitations, and a GO/NO-GO decision. Feature work should stop if it weakens any existing data-integrity, temporal-leakage, or read-only safety gate.
