from fastapi.testclient import TestClient

from app.main import app
from app.market_data import MarketSnapshot
from app.schemas import Candle

client = TestClient(app)


def test_scan_contract_reports_non_persisted_status_without_database(monkeypatch) -> None:
    from app.routes import scan as scan_route

    monkeypatch.delenv("DATABASE_URL", raising=False)

    async def fake_snapshot(symbol: str, timeframe: str, limit: int) -> MarketSnapshot:
        return _snapshot(symbol, timeframe)

    monkeypatch.setattr(scan_route, "fetch_market_snapshot", fake_snapshot)
    monkeypatch.setattr(scan_route, "detect_patterns", lambda candles: [])
    monkeypatch.setattr(scan_route, "persist_scan", lambda snapshot, patterns: ("scan-test", False))

    response = client.post(
        "/api/v1/scan",
        json={"symbol": "BTCUSDT", "timeframe": "1h", "limit": 300},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["scan_id"] == "scan-test"
    assert payload["scan_status"] == "NO TRADE"
    assert payload["patterns"] == []
    assert payload["persisted"] is False
    assert payload["rule_version"]


def _snapshot(symbol: str, timeframe: str) -> MarketSnapshot:
    return MarketSnapshot(
        symbol=symbol,
        timeframe=timeframe,
        provider="binance",
        candles=[Candle(time=1, open=10, high=12, low=9, close=11, volume=1)],
        fetched_at=2,
    )
