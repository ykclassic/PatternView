"""Exchange-agnostic public OHLCV fetching with bounded provider failover."""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from typing import Any

import httpx

from app.schemas import Candle, Symbol, Timeframe

logger = logging.getLogger(__name__)

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
MIN_CLOSED_CANDLES = 40


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
    """Try equivalent Binance hosts sequentially; 451 is terminal for this provider."""
    failures: list[str] = []
    for host in BINANCE_HOSTS:
        try:
            response = await client.get(
                f"{host}/api/v3/klines",
                params={"symbol": symbol, "interval": timeframe, "limit": limit},
            )
        except httpx.HTTPError:
            failures.append("request_failed")
            continue

        if response.status_code == 451:
            raise MarketDataUnavailable("http_451")
        if response.status_code != 200:
            failures.append(f"http_{response.status_code}")
            continue
        try:
            candles = normalize_binance(response.json(), timeframe)
        except (ValueError, TypeError):
            failures.append("invalid_payload")
            continue
        if len(candles) < MIN_CLOSED_CANDLES:
            failures.append("insufficient_closed_candles")
            continue
        return candles

    reason = failures[0] if failures else "provider_unavailable"
    raise MarketDataUnavailable(reason)


async def _fetch_kraken(
    client: httpx.AsyncClient, symbol: Symbol, timeframe: Timeframe, limit: int
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
    if len(candles) < MIN_CLOSED_CANDLES:
        raise MarketDataUnavailable("insufficient_closed_candles")
    return candles[-limit:]


async def fetch_market_snapshot(
    symbol: Symbol, timeframe: Timeframe, limit: int = 300
) -> MarketSnapshot:
    """Fetch normalized closed candles; use short-lived cache and provider failover."""
    if not 40 <= limit <= 720:
        raise ValueError("limit_out_of_range")

    cache_key = (symbol, timeframe, limit)
    now_monotonic = time.monotonic()
    cached = _cache.get(cache_key)
    if cached and now_monotonic - cached[0] < CACHE_TTL_SECONDS:
        return cached[1]

    async with httpx.AsyncClient(timeout=httpx.Timeout(4.0), headers={"Accept": "application/json"}) as client:
        try:
            candles = await _fetch_binance(client, symbol, timeframe, limit)
            provider = "binance"
        except MarketDataUnavailable as binance_error:
            logger.warning(
                "market_data_provider_failed",
                extra={"provider": "binance", "reason_code": binance_error.reason_code},
            )
            try:
                candles = await _fetch_kraken(client, symbol, timeframe, limit)
                provider = "kraken"
            except (MarketDataUnavailable, httpx.HTTPError) as kraken_error:
                reason = (
                    kraken_error.reason_code
                    if isinstance(kraken_error, MarketDataUnavailable)
                    else "request_failed"
                )
                logger.error(
                    "market_data_all_providers_failed",
                    extra={
                        "binance_reason_code": binance_error.reason_code,
                        "kraken_reason_code": reason,
                        "symbol": symbol,
                        "timeframe": timeframe,
                    },
                )
                raise MarketDataUnavailable("all_providers_unavailable") from None

    snapshot = MarketSnapshot(
        symbol=symbol,
        timeframe=timeframe,
        provider=provider,
        candles=candles[-limit:],
        fetched_at=int(time.time()),
    )
    _cache[cache_key] = (time.monotonic(), snapshot)
    return snapshot
