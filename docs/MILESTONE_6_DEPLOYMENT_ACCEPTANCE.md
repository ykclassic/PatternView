# Milestone 6 — Deployment and acceptance

## Deployed components
- Frontend: Vercel project `patternview`, connected to `ykclassic/PatternView`, root at repository root.
- Backend: Render service `patternview-api`, connected to the same repository, running the FastAPI app from `backend/`.
- The frontend analysis proxy uses server-only `PATTERNVIEW_API_URL`; do not expose it as `NEXT_PUBLIC_*`.

## Runtime configuration
- Vercel `PATTERNVIEW_API_URL=https://patternview-api.onrender.com` is configured for Production, Preview and Development. Redeploy frontend after changing it.
- Render is pinned to Python 3.12.10 to match the locked dependency set. Configure the service health-check path as `/health` in Render service settings.
- PostgreSQL is optional for read-only scans. Without `DATABASE_URL`, responses explicitly return `persisted: false`. If persistence is required, provision PostgreSQL, apply `backend/migrations/001_initial.sql`, and set `DATABASE_REQUIRED=true` before treating scan history as durable.

## Smoke acceptance
Run after both deployments are ready:

```bash
FRONTEND_URL=https://patternview.vercel.app \
PATTERNVIEW_API_URL=https://patternview-api.onrender.com \
npm run smoke:production
```

The smoke test verifies the frontend home page, backend liveness/readiness, market catalog, normalized closed-candle ordering, direct scan contract, and frontend-to-backend proxy. It does not claim historical predictive accuracy. Public market providers can rate-limit or be temporarily unavailable; investigate sanitized failures before rerunning.

## Release gates
- CI green on main: necessary, not sufficient.
- Vercel and Render deployments READY: necessary, not sufficient.
- Runtime smoke checks passing: required before accepting the integrated feature.
- Independent blind historical labels and evaluation: still pending. Do not claim precision, recall, profitability, or calibrated probability until that evidence exists.
- No automated execution or order submission is implemented or intended.
