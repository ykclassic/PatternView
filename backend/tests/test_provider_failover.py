from __future__ import annotations

import asyncio

import httpx
import pytest
import time

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
