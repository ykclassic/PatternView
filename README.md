# PatternView

**An explainable crypto chart-pattern analysis workspace.** Phase 1 covers crypto spot pairs only; forex and equities are planned for later phases.

## Phase 1

- BTC/USDT, ETH/USDT and SOL/USDT
- 15m, 1h, 4h and 1d timeframes
- Read-only candlestick data with Binance host failover and Kraken OHLC fallback
- Deterministic double top, double bottom, triple top, triple bottom, head-and-shoulders and inverse head-and-shoulders detection
- Confirmed pivot markers, neckline and invalidation level overlays
- Explainable criteria and conditional measured-move entry/stop/target proposals
- Browser-local scan history with provider provenance and candle snapshots for reproducibility
- No order execution, API keys or exchange account access

## Run locally

Requirements: Node.js 22+ and npm.

```bash
npm install
npm run dev
```

Open http://localhost:3000. The app reads public market data from Binance, then falls back to Kraken OHLC if all Binance hosts fail. Both providers are accessed server-side with bounded request timeouts and normalized candle validation. No credentials are needed.

## Quality checks

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

GitHub Actions runs these checks on pull requests and pushes to `main`.

## Detection contract and limitations

- Only closed candles are included in the scan; the still-open candle is discarded.
- A pivot requires three bars to its left and right, so it is not confirmed until those right-side bars close.
- Matching highs/lows use a 1.2% relative tolerance and must be separated by 8–100 bars.
- A neckline close is required to qualify a breakout.
- This is a deterministic starter heuristic, not a validated trading strategy. It does not estimate win probability or claim profitability.
- Entry, stop-loss and target levels are conditional reference levels only. PatternView never submits or routes orders.

## Phase 1 product requirements and acceptance

See [Phase 1 PRD](docs/PHASE1_PRD.md) and [acceptance evidence matrix](docs/PHASE1_ACCEPTANCE_MATRIX.md). The matrix distinguishes CI results from live production checks and labeled historical detection evaluation.

## Current limitations

- The detector returns the latest qualifying formation, not a ranked list of every simultaneous formation.
- Scan history is stored in the current browser only and is capped at 20 records; it is not synced across devices.
- Labeled historical evaluation, precision/recall measurement, viewport QA and exhaustive live production checks remain release acceptance gates.
- CoinGecko, CoinMarketCap and DefiLlama are not currently used as candle fallbacks because their general-purpose endpoints do not consistently provide the same exchange-pair OHLCV contract for every supported timeframe. Public market-data availability and rate limits depend on the upstream provider.
