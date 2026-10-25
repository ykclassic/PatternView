from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.engine import RULE_VERSION, PatternResult, detect_patterns
from app.market_data import MarketDataUnavailable, fetch_market_snapshot
from app.persistence import persist_scan
from app.schemas import Symbol, Timeframe

router = APIRouter(prefix="/api/v1/scan", tags=["pattern analysis"])


class ScanRequest(BaseModel):
    symbol: Symbol
    timeframe: Timeframe
    limit: int = Field(default=300, ge=40, le=720)


class ScanResponse(BaseModel):
    scan_id: str
    symbol: Symbol
    timeframe: Timeframe
    provider: str
    scanned_at: int
    candle_count: int
    first_candle_time: int
    last_candle_time: int
    rule_version: str
    scan_status: str
    explanation: list[str]
    patterns: list[PatternResult]
    persisted: bool


@router.post("", response_model=ScanResponse)
async def scan_market(request: ScanRequest) -> ScanResponse:
    try:
        snapshot = await fetch_market_snapshot(request.symbol, request.timeframe, request.limit)
    except MarketDataUnavailable:
        raise HTTPException(
            status_code=502,
            detail={
                "code": "market_data_unavailable",
                "message": "Market data is temporarily unavailable from supported providers.",
            },
        ) from None

    patterns = detect_patterns(snapshot.candles)
    try:
        scan_id, persisted = persist_scan(snapshot, patterns)
    except Exception:
        # Do not leak connection strings, SQL or provider payloads to clients.
        raise HTTPException(
            status_code=503,
            detail={
                "code": "persistence_unavailable",
                "message": "Scan completed but persistence is temporarily unavailable.",
            },
        ) from None

    scanned_at = snapshot.fetched_at
    return ScanResponse(
        scan_id=scan_id,
        symbol=snapshot.symbol,
        timeframe=snapshot.timeframe,
        provider=snapshot.provider,
        scanned_at=scanned_at,
        candle_count=len(snapshot.candles),
        first_candle_time=snapshot.candles[0].time,
        last_candle_time=snapshot.candles[-1].time,
        rule_version=RULE_VERSION,
        scan_status="QUALIFIED" if any(p.status == "QUALIFIED" for p in patterns) else "NO TRADE",
        explanation=(
            ["One or more formations qualified on the latest closed candle."]
            if any(p.status == "QUALIFIED" for p in patterns)
            else ["No formation qualified on the latest closed candle; this is not a directional forecast."]
        ),
        patterns=patterns,
        persisted=persisted,
    )
