# PatternView API

The API is a separate, read-only FastAPI service. It does not connect to exchange accounts, accept exchange credentials, or place trades.

## Local development

Requirements: Python 3.12+.

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
pytest
```

## Versioned endpoints

- `GET /health` — liveness probe.
- `GET /ready` — readiness probe.
- `GET /api/v1/markets` — supported symbols/timeframes.
- `GET /api/v1/candles?symbol=BTCUSDT&timeframe=1h&limit=300` — normalized closed OHLCV candles and provider provenance.
- `/openapi.json` and `/docs` — API schema and interactive docs.

Only BTCUSDT, ETHUSDT and SOLUSDT spot pairs and 15m, 1h, 4h and 1d timeframes are accepted. Binance public spot OHLCV is attempted first, with Kraken public OHLC as fallback. Provider requests have a four-second timeout, candle payloads are validated, and the final open candle is excluded. Responses expose only bounded error codes, not raw provider payloads. Successful results are cached for ten seconds; stale cache entries are not silently returned as current data.

No credentials are needed for market data. Database configuration and authenticated user features are not required by this read-only public API.
