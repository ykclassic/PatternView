"""PatternView read-only analysis API entry point."""
from fastapi import FastAPI
from fastapi.responses import JSONResponse

from app.persistence import check_database
from app.routes.candles import router as candles_router
from app.routes.markets import router as markets_router
from app.routes.scan import router as scan_router

app = FastAPI(
    title="PatternView API",
    description="Read-only market data and explainable chart-pattern analysis.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url=None,
)
app.include_router(markets_router)
app.include_router(candles_router)
app.include_router(scan_router)


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
