"""PatternView read-only analysis API entry point."""
from fastapi import FastAPI

from app.routes.candles import router as candles_router
from app.routes.markets import router as markets_router

app = FastAPI(
    title="PatternView API",
    description="Read-only market data and explainable chart-pattern analysis.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url=None,
)
app.include_router(markets_router)
app.include_router(candles_router)


@app.get("/health", tags=["operations"])
def health() -> dict[str, str]:
    """Liveness probe; does not depend on upstream market providers or storage."""
    return {"status": "ok", "service": "patternview-api", "version": app.version}


@app.get("/ready", tags=["operations"])
def readiness() -> dict[str, str]:
    """Readiness probe. Dependency checks are added with the data layer."""
    return {"status": "ready", "service": "patternview-api", "version": app.version}
