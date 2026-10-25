"""PatternView read-only analysis API entry point."""
from fastapi import FastAPI

app = FastAPI(
    title="PatternView API",
    description="Read-only market data and explainable chart-pattern analysis.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url=None,
)


@app.get("/health", tags=["operations"])
def health() -> dict[str, str]:
    """Liveness probe; does not depend on upstream market providers or storage."""
    return {"status": "ok", "service": "patternview-api", "version": app.version}


@app.get("/ready", tags=["operations"])
def readiness() -> dict[str, str]:
    """Readiness probe. Dependency checks are added with the data layer."""
    return {"status": "ready", "service": "patternview-api", "version": app.version}
