from fastapi import APIRouter

from app.schemas import MarketCatalog

router = APIRouter(prefix="/api/v1/markets", tags=["markets"])


@router.get("", response_model=MarketCatalog)
def list_markets() -> MarketCatalog:
    return MarketCatalog(
        symbols=["BTCUSDT", "ETHUSDT", "SOLUSDT"],
        timeframes=["15m", "1h", "4h", "1d"],
    )
