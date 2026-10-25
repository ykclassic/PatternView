# PatternView

**An explainable crypto chart-pattern analysis workspace.** Phase 1 covers crypto spot pairs only; forex and equities are planned for later phases.

## Phase 1

- BTC/USDT, ETH/USDT and SOL/USDT
- 15m, 1h, 4h and 1d timeframes
- Read-only candlestick data with Binance host failover and Kraken OHLC fallback
- Deterministic backend pattern interpretation for double tops/bottoms, head-and-shoulders, triangles, flags and wedges; browser-side candlestick recognizers remain separate
- Confirmed pivot markers, neckline and invalidation level overlays
- Explainable criteria and conditional measured-move entry/stop/target proposals
- Browser-local scan history with provider provenance and candle snapshots for reproducibility
- No order execution, API keys or exchange account access

## Run locally

Requirements: Node.js 22+, npm, and Python 3.12+.

Start the API in one terminal:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

In a second terminal, from the repository root:

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. The Next.js server proxies pattern scans to the FastAPI backend using the server-only `PATTERNVIEW_API_URL`. Public market candles use Binance host failover and Kraken OHLC fallback with bounded timeouts and normalized validation. No exchange credentials are needed.

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
- Independent blind historical labels and validated precision/recall remain release gates. CI passing is not evidence of market accuracy.
- Production pattern scans require a reachable FastAPI backend configured with `PATTERNVIEW_API_URL`; persistence is optional unless `DATABASE_REQUIRED=true` is set.
- CoinGecko, CoinMarketCap and DefiLlama are not currently used as candle fallbacks because their general-purpose endpoints do not consistently provide the same exchange-pair OHLCV contract for every supported timeframe. Public market-data availability and rate limits depend on the upstream provider.
