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
- `GET /ready` — readiness probe; checks PostgreSQL when configured or required.
- `GET /api/v1/markets` — supported symbols/timeframes.
- `GET /api/v1/candles?symbol=BTCUSDT&timeframe=1h&limit=300` — normalized closed OHLCV candles and provider provenance.
- `POST /api/v1/scan` with JSON `{"symbol":"BTCUSDT","timeframe":"1h","limit":300}` — fetches candles, runs the deterministic detector and interpretation layer, and records scan/detection provenance when persistence is configured.
- `/openapi.json` and `/docs` — API schema and interactive docs.

## Persistence

Set `DATABASE_URL` to a PostgreSQL connection string and apply `migrations/001_initial.sql` before production use. The driver normalizes common `postgres://` and `postgresql://` URL forms to psycopg 3. Set `DATABASE_REQUIRED=true` in the deployed service so readiness fails closed if the database URL is absent or the database cannot be reached. When no database is configured locally, scans remain read-only and return `persisted: false`; they are not falsely represented as stored.

## Market-data contract

Only BTCUSDT, ETHUSDT and SOLUSDT spot pairs and 15m, 1h, 4h and 1d timeframes are accepted. Binance public spot OHLCV is attempted first, with Kraken public OHLC as fallback. Provider requests have a four-second timeout, candle payloads are validated, and forming candles are excluded. Responses expose only bounded error codes, not raw provider payloads. Successful results are cached for ten seconds; stale cache entries are not silently returned as current data.

No credentials are needed for market data. No order execution or trading automation exists in this service.
