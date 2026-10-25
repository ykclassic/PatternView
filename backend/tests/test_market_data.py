from __future__ import annotations

from app.market_data import normalize_binance, normalize_kraken
from app.schemas import Candle


def test_candle_schema_rejects_invalid_ohlc_relationships() -> None:
    try:
        Candle(time=1, open=10, high=9, low=8, close=10, volume=1)
    except ValueError:
        pass
    else:
        raise AssertionError("invalid high must be rejected")


def test_binance_normalization_discards_open_candle_and_normalizes_seconds() -> None:
    now = 9_500
    payload = [
        [1_000_000, "10", "12", "9", "11", "4"],
        [9_000_000, "11", "12", "10", "11", "5"],
    ]

    candles = normalize_binance(payload, "15m", now=now)

    assert len(candles) == 1
    assert candles[0].time == 1000
    assert candles[0].close == 11


def test_binance_normalization_rejects_out_of_order_rows() -> None:
    payload = [
        [9_000_000, "10", "12", "9", "11", "4"],
        [1_000_000, "11", "12", "10", "11", "5"],
    ]

    try:
        normalize_binance(payload, "15m", now=10_000_000)
    except ValueError as exc:
        assert "timestamps" in str(exc)
    else:
        raise AssertionError("out-of-order timestamps must be rejected")


def test_kraken_normalization_discards_provider_open_row() -> None:
    now = 10_000
    rows = [
        [100, "10", "12", "9", "11", "10.5", "4", 2],
        [9000, "11", "12", "10", "11", "10.5", "5", 2],
    ]
    payload = {"error": [], "result": {"XBTUSDT": rows, "last": 9000}}

    candles = normalize_kraken(payload, "15m", now=now)

    assert len(candles) == 1
    assert candles[0].time == 100
    assert candles[0].volume == 4


def test_kraken_error_envelope_is_rejected() -> None:
    try:
        normalize_kraken({"error": ["EAPI:Rate limit exceeded"], "result": {}}, "1h", now=10000)
    except ValueError as exc:
        assert str(exc) == "provider_error"
    else:
        raise AssertionError("provider error envelope must be rejected")
