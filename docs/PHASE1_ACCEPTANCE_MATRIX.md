# Phase 1 Acceptance Matrix

This file is the evidence register for PatternView Phase 1. Update statuses only with observed evidence; do not infer a pass from source code alone.

| ID | Acceptance test | Evidence required | Status at baseline |
|---|---|---|---|
| REQ-01 | PRD, market contract, catalogue and non-goals are versioned | PRD reviewed in repository | PASS — versioned Phase 1 PRD and acceptance contract present |
| DATA-01 | BTC/USDT × 15m | Live HTTP 200; Kraken header; 720 candles; 0 malformed, ordering errors, or interval gaps | PASS (2026-10-24; production commit 4ec3935c794588e8729c212c83f276a8522db76a) |
| DATA-02 | BTC/USDT × 1h | Live HTTP 200; Kraken header; 720 candles; 0 malformed, ordering errors, or interval gaps | PASS (2026-10-24; production commit 4ec3935c794588e8729c212c83f276a8522db76a) |
| DATA-03 | BTC/USDT × 4h | Live HTTP 200; Kraken header; 720 candles; 0 malformed, ordering errors, or interval gaps | PASS (2026-10-24; production commit 4ec3935c794588e8729c212c83f276a8522db76a) |
| DATA-04 | BTC/USDT × 1d | Live HTTP 200; Kraken header; 720 candles; 0 malformed, ordering errors, or interval gaps | PASS (2026-10-24; production commit 4ec3935c794588e8729c212c83f276a8522db76a) |
| DATA-05 | ETH/USDT × 15m | Live HTTP 200; Kraken header; 720 candles; 0 malformed, ordering errors, or interval gaps | PASS (2026-10-24; production commit 4ec3935c794588e8729c212c83f276a8522db76a) |
| DATA-06 | ETH/USDT × 1h | Live HTTP 200; Kraken header; 720 candles; 0 malformed, ordering errors, or interval gaps | PASS (2026-10-24; production commit 4ec3935c794588e8729c212c83f276a8522db76a) |
| DATA-07 | ETH/USDT × 4h | Live HTTP 200; Kraken header; 720 candles; 0 malformed, ordering errors, or interval gaps | PASS (2026-10-24; production commit 4ec3935c794588e8729c212c83f276a8522db76a) |
| DATA-08 | ETH/USDT × 1d | Live HTTP 200; Kraken header; 720 candles; 0 malformed, ordering errors, or interval gaps | PASS (2026-10-24; production commit 4ec3935c794588e8729c212c83f276a8522db76a) |
| DATA-09 | SOL/USDT × 15m | Live HTTP 200; Kraken header; 720 candles; 0 malformed, ordering errors, or interval gaps | PASS (2026-10-24; production commit 4ec3935c794588e8729c212c83f276a8522db76a) |
| DATA-10 | SOL/USDT × 1h | Live HTTP 200; Kraken header; 720 candles; 0 malformed, ordering errors, or interval gaps | PASS (2026-10-24; production commit 4ec3935c794588e8729c212c83f276a8522db76a) |
| DATA-11 | SOL/USDT × 4h | Live HTTP 200; Kraken header; 720 candles; 0 malformed, ordering errors, or interval gaps | PASS (2026-10-24; production commit 4ec3935c794588e8729c212c83f276a8522db76a) |
| DATA-12 | SOL/USDT × 1d | Live HTTP 200; Kraken header; 720 candles; 0 malformed, ordering errors, or interval gaps | PASS (2026-10-24; production commit 4ec3935c794588e8729c212c83f276a8522db76a) |
| DATA-13 | Provider timeout, invalid payload and total outage | Automated failover tests and sanitized response | PARTIAL: mocked outage/invalid-payload tests pass; live forced-outage test not run |
| DET-01 | Double top positive, wait, qualify, invalidate | Synthetic positive, wait, qualify and invalidation fixtures pass | PASS for synthetic contract tests; historical quality blocked pending reference labels |
| DET-02 | Double bottom positive, wait, qualify, invalidate | Synthetic positive, wait, qualify and invalidation fixtures pass | PASS for synthetic contract tests; historical quality blocked pending reference labels |
| DET-03 | Triple top positive/negative | Synthetic positive, qualification, invalidation and near-miss fixtures pass | PASS for synthetic contract tests; historical quality blocked pending reference labels |
| DET-04 | Triple bottom positive/negative | Synthetic positive, qualification, invalidation and near-miss fixtures pass | PASS for synthetic contract tests; historical quality blocked pending reference labels |
| DET-05 | Head-and-shoulders positive/negative | Synthetic positive, qualification, invalidation, right-side confirmation and near-miss fixtures pass | PASS for synthetic contract tests; historical quality blocked pending reference labels |
| DET-06 | Inverse head-and-shoulders positive/negative | Synthetic positive, qualification, invalidation and right-side confirmation fixtures pass | PASS for synthetic contract tests; historical quality blocked pending reference labels |
| DET-07 | Historical labeled-data evaluation | Versioned blind dataset, frozen predictions, independently reviewed labels and reproducible metrics | PARTIAL — 72 blind packets and 72 frozen predictions generated; SHA-256 verified; no reference labels or performance metrics yet |
| DET-08 | Candlestick pattern negative/near-miss cases | Clear negative fixtures for DOJI, HAMMER, SHOOTING_STAR, engulfing, stars, and three-soldiers/crows | PASS for synthetic near-miss contract tests; historical quality blocked pending reference labels |
| HIST-01 | Every completed scan persisted and inspectable | Browser-local persistence/cap/corrupt-storage tests pass; history and JSON detail appear in deployed HTML | PARTIAL: interactive browser inspection not manually exercised |
| UI-01 | Desktop 1440×900 layout | Screenshot/visual test and interaction checklist | NOT RUN — browser viewport tooling not available in this verification run |
| UI-02 | Mobile 390×844 layout | Screenshot/visual test and interaction checklist | NOT RUN — browser viewport tooling not available in this verification run |
| UI-03 | Loading, retry, error, empty and overlay states | Existing UI states and retry controls; pattern overlay logic compiles | PARTIAL: no full browser interaction suite |
| REL-01 | CI tests, type-check, lint, build pass | GitHub Actions candidate run #56 (`40133171551`) passed all four gates | PASS (2026-10-24) |
| REL-02 | Production deploy matches accepted main commit | Vercel production deployment READY on `4ec3935c794588e8729c212c83f276a8522db76a` | PASS (2026-10-24) |
| REL-03 | Live smoke tests after deployment | All 12 production pair/timeframe requests returned HTTP 200 with Kraken, 720 candles each, valid OHLCV, strictly increasing timestamps and no interval gaps | PASS (2026-10-24; production commit 4ec3935c794588e8729c212c83f276a8522db76a) |

## Historical evaluation status and protocol

Phase 3 has generated 72 blind packets and 72 frozen predictions with deterministic chronological splits (36 train / 12 validation / 24 test) and verified input/prediction SHA-256 digests. The prepared dataset artifact is separate from the prediction artifact. No reference labels exist yet, so precision, recall, false-positive rate and confusion counts must not be reported as detector performance.

Use [`HISTORICAL_ANNOTATION_PROTOCOL.md`](HISTORICAL_ANNOTATION_PROTOCOL.md). Labels must be produced without access to predictions; every test-split label requires independent review and adjudication. Ambiguous rows are excluded from metric denominators and reported separately. The 72-packet pilot is too small for broad claims across 15 pattern classes; expand the historical window and require meaningful positive/negative support before release claims.

The production matrix is a fresh API smoke check, not a browser interaction test. UI-01/UI-02 and the controlled provider-outage drill remain release blockers.
