# Phase 1 Acceptance Matrix

This file is the evidence register for PatternView Phase 1. Update statuses only with observed evidence; do not infer a pass from source code alone.

| ID | Acceptance test | Evidence required | Status at baseline |
|---|---|---|---|
| REQ-01 | PRD, market contract, catalogue and non-goals are versioned | PRD reviewed in repository | IN REVIEW — PRD added on the acceptance branch |
| DATA-01 | BTC/USDT × 15m | Live HTTP 200; Kraken header; 720 candles; 0 malformed, ordering errors, or interval gaps | PASS (2026-10-21) |
| DATA-02 | BTC/USDT × 1h | Live HTTP 200; Kraken header; 720 candles; 0 malformed, ordering errors, or interval gaps | PASS (2026-10-21) |
| DATA-03 | BTC/USDT × 4h | Live HTTP 200; Kraken header; 720 candles; 0 malformed, ordering errors, or interval gaps | PASS (2026-10-21) |
| DATA-04 | BTC/USDT × 1d | Live HTTP 200; Kraken header; 720 candles; 0 malformed, ordering errors, or interval gaps | PASS (2026-10-21) |
| DATA-05 | ETH/USDT × 15m | Live HTTP 200; Kraken header; 720 candles; 0 malformed, ordering errors, or interval gaps | PASS (2026-10-21) |
| DATA-06 | ETH/USDT × 1h | Live HTTP 200; Kraken header; 720 candles; 0 malformed, ordering errors, or interval gaps | PASS (2026-10-21) |
| DATA-07 | ETH/USDT × 4h | Live HTTP 200; Kraken header; 720 candles; 0 malformed, ordering errors, or interval gaps | PASS (2026-10-21) |
| DATA-08 | ETH/USDT × 1d | Live HTTP 200; Kraken header; 720 candles; 0 malformed, ordering errors, or interval gaps | PASS (2026-10-21) |
| DATA-09 | SOL/USDT × 15m | Live HTTP 200; Kraken header; 720 candles; 0 malformed, ordering errors, or interval gaps | PASS (2026-10-21) |
| DATA-10 | SOL/USDT × 1h | Live HTTP 200; Kraken header; 720 candles; 0 malformed, ordering errors, or interval gaps | PASS (2026-10-21) |
| DATA-11 | SOL/USDT × 4h | Live HTTP 200; Kraken header; 720 candles; 0 malformed, ordering errors, or interval gaps | PASS (2026-10-21) |
| DATA-12 | SOL/USDT × 1d | Live HTTP 200; Kraken header; 720 candles; 0 malformed, ordering errors, or interval gaps | PASS (2026-10-21) |
| DATA-13 | Provider timeout, invalid payload and total outage | Automated failover tests and sanitized response | PARTIAL: mocked outage/invalid-payload tests pass; live forced-outage test not run |
| DET-01 | Double top positive, wait, qualify, invalidate | Synthetic positive, wait, qualify and invalidation fixtures pass | PARTIAL: real historical labels not evaluated |
| DET-02 | Double bottom positive, wait, qualify, invalidate | Synthetic positive, wait and qualify fixtures pass | PARTIAL: full invalidation and real historical labels not evaluated |
| DET-03 | Triple top positive/negative | Synthetic positive fixture passes | PARTIAL: near-miss and historical labels not evaluated |
| DET-04 | Triple bottom positive/negative | Synthetic positive fixture passes | PARTIAL: near-miss and historical labels not evaluated |
| DET-05 | Head-and-shoulders positive/negative | Synthetic positive fixture passes | PARTIAL: historical labels and dedicated negative fixture not evaluated |
| DET-06 | Inverse head-and-shoulders positive/negative | Synthetic positive fixture passes | PARTIAL: historical labels and dedicated negative fixture not evaluated |
| DET-07 | Historical labeled-data evaluation | Dataset provenance, labels, reproducible metrics | NOT RUN |
| HIST-01 | Every completed scan persisted and inspectable | Browser-local persistence/cap/corrupt-storage tests pass; history and JSON detail appear in deployed HTML | PARTIAL: interactive browser inspection not manually exercised |
| UI-01 | Desktop 1440×900 layout | Screenshot/visual test and interaction checklist | NOT RUN — browser viewport tooling not available in this verification run |
| UI-02 | Mobile 390×844 layout | Screenshot/visual test and interaction checklist | NOT RUN — browser viewport tooling not available in this verification run |
| UI-03 | Loading, retry, error, empty and overlay states | Existing UI states and retry controls; pattern overlay logic compiles | PARTIAL: no full browser interaction suite |
| REL-01 | CI tests, type-check, lint, build pass | GitHub Actions CI run #20 (`39683382536`) passed all four gates | PASS (2026-10-21) |
| REL-02 | Production deploy matches accepted main commit | Vercel production deployment READY on `d45ca9e1597e9e04d2f5f7078f082b34cd05c35b` | PASS (2026-10-21) |
| REL-03 | Live smoke tests after deployment | All 12 production pair/timeframe requests returned HTTP 200 with Kraken, 720 candles each, valid OHLCV, strictly increasing timestamps and no interval gaps | PASS (2026-10-21) |

## Historical evaluation protocol

Before reporting accuracy, create a versioned labeled sample with source exchange, pair, timeframe, UTC range, labeling rules, and independent review where practical. Freeze the detector version and evaluate without look-ahead. Report per-pattern sample count, precision, recall, false-positive rate, and confusion counts. Separate overlapping labels and ambiguous formations from clear positives. Synthetic unit tests must not be counted as evaluation observations.
