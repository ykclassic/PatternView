"""PatternView read-only analysis API entry point."""
from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.persistence import check_database
from app.routes.candles import router as candles_router
from app.routes.markets import router as markets_router
from app.routes.scan import router as scan_router
from app.security import RateLimitMiddleware

app = FastAPI(
    title="PatternView API",
    description="Read-only market data and explainable chart-pattern analysis.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url=None,
)
try:
    configured_limit = int(os.getenv("RATE_LIMIT_PER_MINUTE", "120"))
except ValueError:
    configured_limit = 120
app.state.rate_limit_requests_per_minute = max(1, configured_limit)
app.include_router(markets_router)
app.include_router(candles_router)
app.include_router(scan_router)

# Add the limiter first so CORS is outermost and can decorate 429 responses.
app.add_middleware(RateLimitMiddleware)
_allowed_origins = [
    origin.strip().rstrip("/")
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
    and "*" not in origin
    and (origin.strip().startswith("https://") or origin.strip().startswith("http://localhost"))
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Accept", "Content-Type"],
    max_age=600,
)


@app.get("/health", tags=["operations"])
def health() -> dict[str, str]:
    """Liveness probe; does not depend on upstream market providers or storage."""
    return {"status": "ok", "service": "patternview-api", "version": app.version}


@app.get("/ready", tags=["operations"])
def readiness():
    """Readiness probe checks required configured persistence dependencies."""
    try:
        ready = check_database()
    except Exception:
        ready = False
    if not ready:
        return JSONResponse(
            status_code=503,
            content={"status": "not_ready", "service": "patternview-api"},
        )
    return {"status": "ready", "service": "patternview-api", "version": app.version}
