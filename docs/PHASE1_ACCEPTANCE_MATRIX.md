# Phase 1 Acceptance Matrix

This file is the evidence register for PatternView Phase 1. Update statuses only with observed evidence; do not infer a pass from source code alone.

| ID | Acceptance test | Evidence required | Status at baseline |
|---|---|---|---|
| REQ-01 | PRD, market contract, catalogue and non-goals are versioned | PRD reviewed in repository | PASS after PRD merge |
| DATA-01 | BTC/USDT × 15m | Live HTTP result, provider header, candle validation | NOT RUN |
| DATA-02 | BTC/USDT × 1h | Live HTTP result, provider header, candle validation | PARTIAL: prior smoke test returned Kraken candles |
| DATA-03 | BTC/USDT × 4h | Live HTTP result, provider header, candle validation | NOT RUN |
| DATA-04 | BTC/USDT × 1d | Live HTTP result, provider header, candle validation | NOT RUN |
| DATA-05 | ETH/USDT × 15m | Live HTTP result, provider header, candle validation | NOT RUN |
| DATA-06 | ETH/USDT × 1h | Live HTTP result, provider header, candle validation | NOT RUN |
| DATA-07 | ETH/USDT × 4h | Live HTTP result, provider header, candle validation | NOT RUN |
| DATA-08 | ETH/USDT × 1d | Live HTTP result, provider header, candle validation | NOT RUN |
| DATA-09 | SOL/USDT × 15m | Live HTTP result, provider header, candle validation | NOT RUN |
| DATA-10 | SOL/USDT × 1h | Live HTTP result, provider header, candle validation | NOT RUN |
| DATA-11 | SOL/USDT × 4h | Live HTTP result, provider header, candle validation | NOT RUN |
| DATA-12 | SOL/USDT × 1d | Live HTTP result, provider header, candle validation | NOT RUN |
| DATA-13 | Provider timeout, invalid payload and total outage | Automated failover tests and sanitized response | PARTIAL: unit tests exist; full provider matrix not run |
| DET-01 | Double top positive, wait, qualify, invalidate | Labeled fixtures and tests | PARTIAL |
| DET-02 | Double bottom positive, wait, qualify, invalidate | Labeled fixtures and tests | PARTIAL |
| DET-03 | Triple top positive/negative | Labeled fixtures and tests | NOT RUN |
| DET-04 | Triple bottom positive/negative | Labeled fixtures and tests | NOT RUN |
| DET-05 | Head-and-shoulders positive/negative | Labeled fixtures and tests | NOT RUN |
| DET-06 | Inverse head-and-shoulders positive/negative | Labeled fixtures and tests | NOT RUN |
| DET-07 | Historical labeled-data evaluation | Dataset provenance, labels, reproducible metrics | NOT RUN |
| HIST-01 | Every completed scan persisted and inspectable | Automated persistence tests and UI evidence | NOT RUN |
| UI-01 | Desktop 1440×900 layout | Screenshot/visual test and interaction checklist | NOT RUN |
| UI-02 | Mobile 390×844 layout | Screenshot/visual test and interaction checklist | NOT RUN |
| UI-03 | Loading, retry, error, empty and overlay states | Component/browser tests | PARTIAL |
| REL-01 | CI tests, type-check, lint, build pass | Green PR checks | Must be verified per release |
| REL-02 | Production deploy matches accepted main commit | Vercel deployment SHA | Must be verified per release |
| REL-03 | Live smoke tests after deployment | Captured responses for all 12 combinations | NOT RUN |

## Historical evaluation protocol

Before reporting accuracy, create a versioned labeled sample with source exchange, pair, timeframe, UTC range, labeling rules, and independent review where practical. Freeze the detector version and evaluate without look-ahead. Report per-pattern sample count, precision, recall, false-positive rate, and confusion counts. Separate overlapping labels and ambiguous formations from clear positives. Synthetic unit tests must not be counted as evaluation observations.
