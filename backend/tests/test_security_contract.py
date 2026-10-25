from fastapi.testclient import TestClient

from app.main import app
from app.market_data import MarketDataUnavailable, MarketSnapshot
from app.schemas import Candle

client = TestClient(app)


def _snapshot(symbol: str = "BTCUSDT", timeframe: str = "1h") -> MarketSnapshot:
    candles = [
        Candle(time=index * 3600 + 1, open=100, high=102, low=99, close=101, volume=10)
        for index in range(1, 45)
    ]
    return MarketSnapshot(
        symbol=symbol, timeframe=timeframe, provider="binance",
        candles=candles, fetched_at=200_000,
    )


def test_scan_rejects_unsupported_symbol_without_fetching(monkeypatch) -> None:
    from app.routes import scan as scan_route

    def should_not_fetch(*args, **kwargs):
        raise AssertionError("market provider must not be called for invalid input")

    monkeypatch.setattr(scan_route, "fetch_market_snapshot", should_not_fetch)
    response = client.post("/api/v1/scan", json={"symbol": "DOGEUSDT", "timeframe": "1h"})
    assert response.status_code == 422


def test_market_provider_failure_is_sanitized(monkeypatch) -> None:
    from app.routes import scan as scan_route

    async def fail(*args, **kwargs):
        raise MarketDataUnavailable("secret-header-and-upstream-payload")

    monkeypatch.setattr(scan_route, "fetch_market_snapshot", fail)
    response = client.post("/api/v1/scan", json={"symbol": "BTCUSDT", "timeframe": "1h"})
    assert response.status_code == 502
    assert response.json()["detail"]["code"] == "market_data_unavailable"
    assert "secret-header" not in response.text
    assert "upstream-payload" not in response.text


def test_persistence_failure_is_sanitized(monkeypatch) -> None:
    from app.routes import scan as scan_route

    async def fake_snapshot(symbol: str, timeframe: str, limit: int) -> MarketSnapshot:
        return _snapshot(symbol, timeframe)

    monkeypatch.setattr(scan_route, "fetch_market_snapshot", fake_snapshot)
    monkeypatch.setattr(scan_route, "detect_patterns", lambda candles: [])
    def fail_persist(*args, **kwargs):
        raise RuntimeError("postgres://user:secret-password@db/private")

    monkeypatch.setattr(scan_route, "persist_scan", fail_persist)
    response = client.post("/api/v1/scan", json={"symbol": "BTCUSDT", "timeframe": "1h"})
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "persistence_unavailable"
    assert "secret-password" not in response.text
    assert "postgres://" not in response.text
