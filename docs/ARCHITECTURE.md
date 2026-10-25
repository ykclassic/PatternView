# PatternView architecture baseline

## Product boundary

PatternView is a crypto spot chart-pattern recognition and interpretation app. It is read-only and does not connect to trading accounts, request exchange credentials, submit orders, or automate trading. The supported initial market remains BTC/USDT, ETH/USDT and SOL/USDT on 15m, 1h, 4h and 1d candles.

## Deployment topology

- `frontend/` is the logical Next.js presentation tier; the existing Next.js app remains at the repository root during the migration to avoid breaking the current Vercel project root configuration.
- `backend/` is the independent FastAPI service deployed from the same repository with its root directory set to `backend`.
- `docs/` contains product requirements, contracts, operational evidence and acceptance decisions.
- `.github/workflows/` runs frontend and backend checks on pull requests and main pushes.
- PostgreSQL is the intended persistent store for scan requests, detected formations and provenance. Database configuration must be supplied through deployment environment variables; secrets must never be committed.

## Layer boundaries

1. Provider adapters normalize and validate exchange-specific OHLCV into a single candle contract.
2. Detection is deterministic, versioned and causal; pivots are not confirmed until the required right-hand candles close.
3. Interpretation is a separate layer that derives status and conditional entry/stop/target reference levels. These are analytical explanations, not orders.
4. API handlers validate inputs, return sanitized errors and preserve source/rule provenance.
5. Persistence stores scan requests, detections and metadata when a configured PostgreSQL database is available.
6. The Next.js UI renders candles, pattern geometry, status, explanations and history; it never contains provider credentials.

## Engineering and release rules

- Python API code uses typed functions, pinned direct dependencies, pytest and explicit request/response schemas.
- TypeScript remains strict; npm test, typecheck, lint and production build must pass.
- Provider timeouts, bounded retries/fallbacks, payload validation, rate limiting and CORS allowlists are required before production acceptance.
- Synthetic fixtures prove deterministic contracts only. Historical accuracy requires independent labels, frozen predictions and chronological holdout evaluation.
- Each milestone is merged only after the associated GitHub Actions workflow completes successfully. Production acceptance is a separate gate from CI.
