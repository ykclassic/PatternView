from fastapi import APIRouter, HTTPException, Query

from app.market_data import MarketDataUnavailable, fetch_market_snapshot
from app.schemas import CandleResponse, Symbol, Timeframe

router = APIRouter(prefix="/api/v1/candles", tags=["market data"])


@router.get("", response_model=CandleResponse)
async def get_candles(
    symbol: Symbol = Query(...),
    timeframe: Timeframe = Query(...),
    limit: int = Query(default=300, ge=40, le=720),
) -> CandleResponse:
    try:
        snapshot = await fetch_market_snapshot(symbol, timeframe, limit)
    except MarketDataUnavailable:
        raise HTTPException(
            status_code=502,
            detail={
                "code": "market_data_unavailable",
                "message": "Market data is temporarily unavailable from supported providers.",
            },
        ) from None
    return CandleResponse(
        symbol=snapshot.symbol,
        timeframe=snapshot.timeframe,
        provider=snapshot.provider,
        candles=snapshot.candles,
        fetched_at=snapshot.fetched_at,
        stale=snapshot.stale,
    )
