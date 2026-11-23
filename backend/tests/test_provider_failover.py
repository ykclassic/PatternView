from __future__ import annotations

import asyncio
import time

import httpx
import pytest

from app.market_data import MarketDataUnavailable, _fetch_binance


class FakeResponse:
    def __init__(self, status_code: int, payload=None):
        self.status_code = status_code
        self._payload = payload

    def json(self):
        return self._payload


class FakeClient:
    def __init__(self, responses):
        self.responses = iter(responses)
        self.calls = []

    async def get(self, url, params=None):
        self.calls.append(url)
        response = next(self.responses)
        if isinstance(response, Exception):
            raise response
        return response


def test_binance_451_stops_host_rotation_immediately():
    client = FakeClient([FakeResponse(451)])
    with pytest.raises(MarketDataUnavailable) as error:
        asyncio.run(_fetch_binance(client, "BTCUSDT", "1h", 300))
    assert error.value.reason_code == "http_451"
    assert len(client.calls) == 1


def test_binance_transient_host_failure_can_try_next_host():
    now = int(time.time())
    rows = []
    for index in range(45):
        timestamp = (now - (45 - index) * 3600) * 1000
        rows.append([timestamp, "100", "110", "90", "105", "42"])
    client = FakeClient([FakeResponse(503), FakeResponse(200, rows)])
    candles = asyncio.run(_fetch_binance(client, "BTCUSDT", "1h", 300))
    assert len(client.calls) == 2
    assert len(candles) == 45


def test_binance_network_failure_is_bounded_to_next_host():
    client = FakeClient([httpx.ConnectError("offline"), FakeResponse(451)])
    with pytest.raises(MarketDataUnavailable) as error:
        asyncio.run(_fetch_binance(client, "BTCUSDT", "1h", 300))
    assert error.value.reason_code == "http_451"
    assert len(client.calls) == 2


class AsyncContextClient(FakeClient):
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, traceback):
        return False


def test_http_451_falls_back_to_kraken_and_reports_kraken_provenance(monkeypatch):
    import app.market_data as market_data

    now = int(time.time())
    kraken_rows = []
    for index in range(45):
        timestamp = now - (45 - index) * 3600
        kraken_rows.append([timestamp, "100", "110", "90", "105", "106", "42", 2])
    kraken_payload = {"error": [], "result": {"XBTUSDT": kraken_rows, "last": kraken_rows[-1][0]}}
    client = AsyncContextClient([FakeResponse(451), FakeResponse(200, kraken_payload)])
    monkeypatch.setattr(market_data.httpx, "AsyncClient", lambda **kwargs: client)
    market_data._cache.clear()

    snapshot = asyncio.run(market_data.fetch_market_snapshot("BTCUSDT", "1h", 300))

    assert snapshot.provider == "kraken"
    assert len(snapshot.candles) == 44
    assert client.calls[0].startswith("https://api.binance.com/")
    assert client.calls[1].startswith("https://api.kraken.com/")


def test_both_provider_failures_return_bounded_failure(monkeypatch):
    import app.market_data as market_data

    client = AsyncContextClient([FakeResponse(451), FakeResponse(503)])
    monkeypatch.setattr(market_data.httpx, "AsyncClient", lambda **kwargs: client)
    market_data._cache.clear()

    with pytest.raises(MarketDataUnavailable) as error:
        asyncio.run(market_data.fetch_market_snapshot("ETHUSDT", "1h", 300))

    assert error.value.reason_code == "all_providers_unavailable"
    assert len(client.calls) == 2
