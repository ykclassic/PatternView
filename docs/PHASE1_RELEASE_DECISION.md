# PatternView Phase 1 — Formal Release Decision

**Decision date:** 2026-10-24  
**Scope:** Crypto-only Phase 1: BTC/USDT, ETH/USDT, SOL/USDT at 15m, 1h, 4h, and 1d. Read-only market data and pattern analysis. No order execution.

## Decision

**NO-GO for full Phase 1 acceptance. GO for continued controlled crypto-MVP operation as an analysis-only preview.**

The deployed site is reachable and the production market-data pipeline passed a fresh 12-combination smoke check on 2026-10-24. CI and the frozen-prediction workflow pass. Those results establish deployment and data-path functionality, not detector quality or complete visual acceptance.

## Evidence accepted

- After both Phase 3 and release-gate changes were merged, the production deployment is READY on main commit `4ec3935c794588e8729c212c83f276a8522db76a`; the production alias serves that commit.
- Homepage returned HTTP 200 and rendered the PatternView title, pair/timeframe controls, read-only notice, chart workspace, interpretation panel, scan history, and no-execution disclaimer in server-rendered HTML.
- All 12 production market-data combinations returned HTTP 200, provider `kraken`, 720 candles, valid OHLCV values, strictly increasing timestamps, and exact requested interval spacing.
- Phase 3 PR #11 was merged after CI passed unit tests, type-check, lint, and production build. Dataset preparation and prediction freezing succeeded on 2026-10-24: 72 packets, 36 train / 12 validation / 24 test; input and prediction SHA-256 digests matched.
- Detector tests cover positive/wait/qualified/invalidation paths for the six classical formations, negative/near-miss fixtures, and closed-pivot confirmation. These are synthetic correctness tests, not historical accuracy evidence.

## Release blockers

1. **Independent reference labels:** no completed human-labeled artifact exists. Historical precision, recall, false-positive rate, and class support are therefore unavailable.
2. **Sample breadth:** the 72-packet dataset is a pilot with six packets per pair/timeframe series and sparse support across 15 pattern classes. Expand history and label it before making detector-performance claims.
3. **Interactive visual QA:** a live HTML fetch is not a substitute for browser interaction. Desktop 1440×900 and mobile 390×844 screenshots, pair/timeframe controls, chart overlays, scan history expansion, loading/retry/error states, and overflow still need actual browser verification.
4. **Live provider outage:** mocked failover and malformed-payload tests pass, but a controlled production provider-outage drill has not been observed. Do not force an outage on the production providers; use a controlled test route or test environment.
5. **Interactive production UI QA:** the production build is deployed, but HTML fetches do not establish that client-side interactions, responsive layout, chart overlays, and retry/error states behave correctly in a real browser.

## Acceptance gates to change this decision

- [ ] Versioned, blinded reference labels completed; test split independently reviewed and adjudicated.
- [ ] Evaluation report generated from the frozen prediction digest with per-pattern confusion counts and sample support.
- [ ] Dataset expanded enough to cover varied market regimes and meaningful per-pattern positive/negative support.
- [ ] Desktop/mobile interactive browser QA passed with saved evidence.
- [ ] Controlled provider-outage behavior verified and sanitized.
- [x] Production deployment identity checked against accepted main commit `4ec3935c794588e8729c212c83f276a8522db76a` on 2026-10-24.

Until all gates pass, keep PatternView crypto-only, read-only, and explicitly non-execution. Do not add forex/stocks, ML ranking, alerts, or execution as a way to bypass Phase 1 acceptance.
