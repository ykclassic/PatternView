# Phase 1 Production Evidence — 2026-10-21

## Deployment identity

- Repository: [ykclassic/PatternView](https://github.com/ykclassic/PatternView)
- Production URL: https://patternview.vercel.app
- Accepted main commit: `d45ca9e1597e9e04d2f5f7078f082b34cd05c35b`
- Vercel deployment: `dpl_2YNZVYQL47jP4JDBkcxJrFRRKnpi`
- Deployment state: READY
- Pull request: [#5](https://github.com/ykclassic/PatternView/pull/5), merged
- GitHub Actions CI run #20: `39683382536`, success

## Live market-data matrix

The deployed production endpoint was queried for all supported symbols and intervals. Each request returned HTTP 200 and provider header `X-Market-Data-Provider: kraken`.

| Pair | 15m | 1h | 4h | 1d |
|---|---|---|---|---|
| BTC/USDT | PASS | PASS | PASS | PASS |
| ETH/USDT | PASS | PASS | PASS | PASS |
| SOL/USDT | PASS | PASS | PASS | PASS |

Each of the 12 responses contained 720 candles. The response validation found zero malformed OHLCV rows, zero duplicate/out-of-order timestamps, and zero timestamp gaps at the requested interval spacing. This is a point-in-time production smoke test, not a guarantee of future provider availability.

## Code and test evidence

- Unit tests: 21 passed, 0 failed.
- Type-check: passed.
- Lint: passed.
- Production build: passed.
- Automated route matrix: all 12 symbol/timeframe combinations map to the requested provider interval.
- Provider fallback tests cover mocked provider outages and malformed payloads. A forced live outage was not run.
- Scan-history tests cover persistence, the 20-record cap, and recovery from corrupt browser storage.
- Pattern fixtures cover double top/bottom confirmation states, triple top/bottom, head-and-shoulders/inverse head-and-shoulders, malformed OHLC, and a flat near-miss.

## Remaining acceptance gates

1. **Historical labeled-data evaluation:** no curated, independently labeled historical candle dataset has been supplied or verified. Do not infer precision, recall, false-positive rate, or profitability from synthetic tests.
2. **Viewport/browser verification:** desktop 1440×900 and mobile 390×844 screenshots and interactive checks were not performed in this run. CSS breakpoints exist, but that is not equivalent to visual acceptance.
3. **Full detection negative fixtures:** add dedicated near-miss fixtures for triple patterns and both head-and-shoulders variants, and test invalidation for all six patterns.
4. **Live outage drill:** confirm that a controlled provider failure produces sanitized diagnostics and only surfaces an error after all suitable providers fail.
5. **Persistence scope:** scan history is browser-local, capped at 20 records, and does not synchronize across browsers/devices.

## Release decision

**Production deployment and live market-data matrix: PASS. Phase 1: NOT YET FULLY ACCEPTED.** Historical accuracy evaluation, full UI viewport verification, and the remaining negative/invalidation cases are still open.
