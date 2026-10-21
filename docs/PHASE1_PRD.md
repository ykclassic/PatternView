# PatternView Phase 1 Product Requirements Document

**Status:** Proposed acceptance baseline — implementation and production evidence tracked separately  
**Product:** PatternView  
**Release:** Phase 1 — Crypto spot chart-pattern analysis  
**Last updated:** 2026-10-21

## 1. Product objective

Help traders and technical analysts identify classical chart formations consistently across selected crypto spot pairs and timeframes. PatternView is an explainable analysis aid, not an execution platform or a claim of profitable signals.

## 2. Target users

- Crypto spot traders monitoring multiple pairs and timeframes.
- Technical analysts who want repeatable, rule-based pattern identification.
- Traders who want to inspect the evidence, status, and invalidation conditions rather than receive opaque predictions.
- Users who need a responsive chart workspace on desktop and mobile.

## 3. Supported-market contract

| Dimension | Phase 1 contract |
|---|---|
| Market | Spot cryptocurrency only |
| Pairs | BTC/USDT, ETH/USDT, SOL/USDT |
| Internal symbols | BTCUSDT, ETHUSDT, SOLUSDT |
| Timeframes | 15m, 1h, 4h, 1d |
| Primary provider | Binance public spot OHLCV, subject to availability and access |
| Fallback provider | Kraken public OHLC, normalized to the same candle contract |
| Data policy | Closed candles only for detection; no credentials or account access |
| Future markets | Perpetual futures, forex and equities are out of scope |

Each timeframe must map to the exact provider interval or a documented, tested aggregation. A 4h request must never silently return 1h or 1d data. Provider identity, request interval, and candle timestamp range must be retained as scan provenance.

## 4. Phase 1 pattern catalogue

### In-scope for the release
1. Double top — two comparable confirmed swing highs with an intervening neckline low.
2. Double bottom — two comparable confirmed swing lows with an intervening neckline high.
3. Triple top — three comparable confirmed swing highs and a neckline defined by intervening lows.
4. Triple bottom — three comparable confirmed swing lows and a neckline defined by intervening highs.
5. Head and shoulders — three confirmed swing highs with the head higher than both shoulders and a neckline through the intervening lows.
6. Inverse head and shoulders — three confirmed swing lows with the head lower than both shoulders and a neckline through the intervening highs.

A detector must emit only a pattern supported by closed candles and confirmed pivots. Every result includes its rule version, pivot timestamps, detection timestamp, confirmation status, neckline/breakout level, invalidation level, and conditional entry/stop/target when mathematically valid.

### Explicitly deferred
Triangles, wedges, flags, pennants, cup-and-handle, harmonic formations, automated alerts, user subscriptions, portfolio integrations, machine learning, and futures/forex/equities markets.

## 5. Detection and interpretation rules

- Input candles must be finite, positive-price OHLCV records with valid OHLC relationships and chronological, non-duplicate timestamps.
- Only closed candles enter the detector.
- A pivot with a three-bar right radius is not confirmed until all three right-side bars close.
- Similarity tolerance and pivot-separation limits must be versioned constants and documented in the implementation.
- Breakout qualification requires a closed candle beyond the neckline; touching or intrabar movement is insufficient.
- Invalidation rules must be deterministic and tested.
- Entry, stop-loss and measured-move target are conditional analytical reference levels only. They are not orders or financial advice.
- No accuracy, win-rate, or profitability claim is allowed without a reproducible labeled-data evaluation.

## 6. User-facing capabilities

- Select supported pair and timeframe.
- View candlestick chart with pattern pivots and key levels.
- Run a deterministic scan on initial load, pair/timeframe change, and manual refresh.
- Inspect the detected pattern, status, explanation, detection time, and conditional levels.
- Distinguish loading, provider error, insufficient data, and no-pattern states.
- Retry failed data requests.
- Inspect persisted scan history with pair, timeframe, timestamp, source/provider provenance, pattern/status, levels, and reproducibility metadata.
- Responsive desktop and mobile layouts with keyboard-accessible controls.

## 7. Non-goals and safety constraints

- No order submission, trading account connection, wallet connection, portfolio access, or exchange credentials.
- No promise that a detected pattern predicts future prices.
- No hidden substitution of symbols, timeframes, or provider data.
- No credentials, raw provider payloads, authorization headers, or secret-bearing exception text in diagnostics.
- Provider failures must not be converted into fabricated or stale candle data.
- Browser-local history is device/browser scoped unless a future authenticated backend is explicitly approved.

## 8. Measurable acceptance criteria

### A. Requirements and scope
- PRD and acceptance matrix are versioned in the repository.
- Every supported pair/timeframe combination is enumerated in tests.
- Every in-scope pattern has a deterministic rule and labeled positive, negative, confirmation, and invalidation fixtures.

### B. Market data
- All 12 pair/timeframe combinations return valid closed candles from the live service or a clear sanitized failure.
- Returned candles have finite OHLCV values, valid OHLC relationships, strictly increasing timestamps, no duplicates, and expected timeframe spacing subject to documented exchange maintenance gaps.
- Provider failover is tested for each failure path; source provenance is observable.
- A failed source never results in a fabricated success response.

### C. Detection
- Unit tests cover each pattern, breakout qualification, invalidation, insufficient candles, malformed OHLC, and near-miss/false-positive fixtures.
- Pivots cannot be emitted before the required right-side candles exist.
- Historical evaluation reports precision, recall, false-positive rate, sample size, label methodology, and per-pattern results before any accuracy statement is made.
- Synthetic fixtures validate code behavior only and do not count as real-market accuracy evidence.

### D. Scan history
- Every completed scan, including no-pattern results, is persisted.
- Records include pair, timeframe, scan timestamp, provider, data range, rule version, result/status, key levels, and candle snapshot or equivalent reproducible input.
- History can be inspected in the UI and exported or copied for audit.
- Storage limits and browser-local scope are documented; corrupt records are handled without crashing the app.

### E. Interface and production
- Desktop viewport 1440×900 and mobile viewport 390×844 are checked.
- Loading, retry, provider error, insufficient data, no-pattern, and pattern-overlay states are exercised.
- CI passes tests, type-check, lint, and production build.
- Production deployment commit matches the accepted main commit.
- Live endpoint smoke tests and visual checks are recorded separately from CI.
- Release is not accepted until each criterion has an evidence-backed pass or an explicitly approved deferral.

## 9. Evidence status convention

- **PASS:** direct, repeatable evidence exists.
- **FAIL:** a check was run and did not meet the criterion.
- **NOT RUN:** evidence has not yet been collected.
- **DEFERRED:** explicitly outside the approved Phase 1 scope.

A green CI run is not proof of production health or pattern accuracy.
