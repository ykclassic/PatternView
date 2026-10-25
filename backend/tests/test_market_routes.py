from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_market_catalog_lists_only_supported_crypto_spot_combinations() -> None:
    response = client.get("/api/v1/markets")

    assert response.status_code == 200
    assert response.json()["symbols"] == ["BTCUSDT", "ETHUSDT", "SOLUSDT"]
    assert response.json()["timeframes"] == ["15m", "1h", "4h", "1d"]
    assert response.json()["market_type"] == "crypto_spot"


def test_candle_endpoint_validates_query_values_before_fetching() -> None:
    response = client.get("/api/v1/candles", params={"symbol": "BTCUSDT", "timeframe": "5m"})

    assert response.status_code == 422


def test_candle_endpoint_rejects_unsupported_symbol() -> None:
    response = client.get("/api/v1/candles", params={"symbol": "DOGEUSDT", "timeframe": "1h"})

    assert response.status_code == 422
