"""Exchange-agnostic public OHLCV fetching with bounded provider failover."""
from __future__ import annotations

import asyncio
import math
import time
from dataclasses import dataclass
from typing import Any

import httpx

from app.schemas import Candle, Symbol, Timeframe

BINANCE_HOSTS = (
    "https://api.binance.com",
    "https://api1.binance.com",
    "https://api2.binance.com",
    "https://api3.binance.com",
)
KRAKEN_PAIRS: dict[str, str] = {
    "BTCUSDT": "XBTUSDT",
    "ETHUSDT": "ETHUSDT",
    "SOLUSDT": "SOLUSDT",
}
INTERVAL_SECONDS: dict[str, int] = {
    "15m": 900,
    "1h": 3600,
    "4h": 14400,
    "1d": 86400,
}
KRAKEN_INTERVALS: dict[str, int] = {"15m": 15, "1h": 60, "4h": 240, "1d": 1440}
CACHE_TTL_SECONDS = 10.0


class MarketDataUnavailable(Exception):
    """Provider failure with a bounded, safe diagnostic code."""

    def __init__(self, reason_code: str = "provider_unavailable") -> None:
        self.reason_code = reason_code
        super().__init__(reason_code)


@dataclass(frozen=True)
class MarketSnapshot:
    symbol: Symbol
    timeframe: Timeframe
    provider: str
    candles: list[Candle]
    fetched_at: int
    stale: bool = False


_cache: dict[tuple[str, str, int], tuple[float, MarketSnapshot]] = {}


def _validate_order(candles: list[Candle]) -> list[Candle]:
    previous = 0
    for candle in candles:
        if candle.time <= previous:
            raise ValueError("timestamps_not_increasing")
        previous = candle.time
    return candles


def normalize_binance(payload: Any, timeframe: Timeframe, now: int | None = None) -> list[Candle]:
    if not isinstance(payload, list) or not payload:
        raise ValueError("invalid_payload")
    current_time = int(time.time()) if now is None else now
    interval = INTERVAL_SECONDS[timeframe]
    candles: list[Candle] = []
    for row in payload:
        if not isinstance(row, list) or len(row) < 6:
            raise ValueError("invalid_payload")
        try:
            timestamp = int(row[0]) // 1000
            candle = Candle(
                time=timestamp,
                open=float(row[1]),
                high=float(row[2]),
                low=float(row[3]),
                close=float(row[4]),
                volume=float(row[5]),
            )
        except (TypeError, ValueError, OverflowError) as exc:
            raise ValueError("invalid_payload") from exc
        if candle.time + interval <= current_time:
            candles.append(candle)
    return _validate_order(candles)


def normalize_kraken(payload: Any, timeframe: Timeframe, now: int | None = None) -> list[Candle]:
    if not isinstance(payload, dict) or not isinstance(payload.get("error"), list):
        raise ValueError("invalid_envelope")
    if payload["error"]:
        raise ValueError("provider_error")
    result = payload.get("result")
    if not isinstance(result, dict):
        raise ValueError("invalid_result")
    pair_key = next((key for key in result if key != "last"), None)
    rows = result.get(pair_key) if pair_key else None
    if not isinstance(rows, list) or not rows:
        raise ValueError("missing_pair_data")
    # Kraken includes a final, currently forming candle. Never scan it.
    current_time = int(time.time()) if now is None else now
    interval = INTERVAL_SECONDS[timeframe]
    candles: list[Candle] = []
    for row in rows[:-1]:
        if not isinstance(row, list) or len(row) < 7:
            raise ValueError("invalid_payload")
        try:
            candle = Candle(
                time=int(float(row[0])),
                open=float(row[1]),
                high=float(row[2]),
                low=float(row[3]),
                close=float(row[4]),
                volume=float(row[6]),
            )
        except (TypeError, ValueError, OverflowError) as exc:
            raise ValueError("invalid_payload") from exc
        if candle.time + interval <= current_time:
            candles.append(candle)
    return _validate_order(candles)


async def _fetch_binance(
    client: httpx.AsyncClient, symbol: Symbol, timeframe: Timeframe, limit: int
) -> list[Candle]:
    async def request(host: str) -> httpx.Response:
        return await client.get(
            f"{host}/api/v3/klines",
            params={"symbol": symbol, "interval": timeframe, "limit": limit},
        )

    tasks = [asyncio.create_task(request(host)) for host in BINANCE_HOSTS]
    reasons: list[str] = []
    try:
        for task in asyncio.as_completed(tasks):
            try:
                response = await task
                if response.status_code != 200:
                    reasons.append(f"http_{response.status_code}")
                    continue
                try:
                    candles = normalize_binance(response.json(), timeframe)
                except (ValueError, TypeError):
                    reasons.append("invalid_payload")
                    continue
                if len(candles) < 40:
                    reasons.append("insufficient_closed_candles")
                    continue
                return candles
            except (httpx.HTTPError, ValueError, TypeError):
                reasons.append("request_failed")
        raise MarketDataUnavailable(reasons[0] if reasons else "provider_unavailable")
    finally:
        for task in tasks:
            if not task.done():
                task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)


async def _fetch_kraken(
    client: httpx.AsyncClient, symbol: Symbol, timeframe: Timeframe
) -> list[Candle]:
    response = await client.get(
        "https://api.kraken.com/0/public/OHLC",
        params={"pair": KRAKEN_PAIRS[symbol], "interval": KRAKEN_INTERVALS[timeframe]},
    )
    if response.status_code != 200:
        raise MarketDataUnavailable(f"http_{response.status_code}")
    try:
        candles = normalize_kraken(response.json(), timeframe)
    except (ValueError, TypeError) as exc:
        raise MarketDataUnavailable("invalid_payload") from exc
    if len(candles) < 40:
        raise MarketDataUnavailable("insufficient_closed_candles")
    return candles


async def fetch_market_snapshot(
    symbol: Symbol, timeframe: Timeframe, limit: int = 300
) -> MarketSnapshot:
    """Fetch normalized closed candles; use short-lived cache and provider failover."""
    cache_key = (symbol, timeframe, limit)
    now_monotonic = time.monotonic()
    cached = _cache.get(cache_key)
    if cached and now_monotonic - cached[0] < CACHE_TTL_SECONDS:
        return cached[1]

    async with httpx.AsyncClient(timeout=httpx.Timeout(4.0), headers={"Accept": "application/json"}) as client:
        try:
            candles = await _fetch_binance(client, symbol, timeframe, limit)
            provider = "binance"
        except MarketDataUnavailable:
            try:
                candles = await _fetch_kraken(client, symbol, timeframe)
                provider = "kraken"
            except (MarketDataUnavailable, httpx.HTTPError):
                raise MarketDataUnavailable("provider_unavailable") from None

    # Provider limits vary; retain the newest requested number of closed candles.
    snapshot = MarketSnapshot(
        symbol=symbol,
        timeframe=timeframe,
        provider=provider,
        candles=candles[-limit:],
        fetched_at=int(time.time()),
    )
    _cache[cache_key] = (time.monotonic(), snapshot)
    return snapshot
