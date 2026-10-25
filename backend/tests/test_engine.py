from app.engine import RULE_VERSION, confirmed_pivots, detect_patterns
from app.schemas import Candle


def make_candles(count: int = 80) -> list[Candle]:
    result = []
    for index in range(count):
        close = 100.0
        high = 102.0
        low = 98.0
        if index in (20, 40):
            high = 110.0
        if index == 30:
            low = 90.0
        result.append(Candle(
            time=1_700_000_000 + index * 900,
            open=close,
            high=high,
            low=low,
            close=close,
            volume=100.0,
        ))
    return result


def test_pivot_confirmation_time_is_later_than_pivot_time() -> None:
    candles = make_candles()
    pivots = confirmed_pivots(candles)

    peak = next(pivot for pivot in pivots if pivot.kind == "high" and pivot.index == 20)

    assert peak.confirmed_at == candles[23].time
    assert peak.confirmed_at > peak.time


def test_engine_detects_a_double_top_and_explains_heuristic_score() -> None:
    results = detect_patterns(make_candles())

    top = next(result for result in results if result.kind == "DOUBLE_TOP")

    assert top.status == "WAITING FOR BREAKOUT"
    assert 0 <= top.quality_score <= 100
    assert top.rule_version == RULE_VERSION
    assert any("not a probability" in line for line in top.explanation)


def test_engine_returns_no_detection_for_insufficient_history() -> None:
    assert detect_patterns(make_candles(20)) == []


def test_engine_rejects_duplicate_or_out_of_order_candle_times() -> None:
    candles = make_candles()
    candles[1] = candles[0]

    try:
        detect_patterns(candles)
    except ValueError as exc:
        assert "strictly increasing" in str(exc)
    else:
        raise AssertionError("invalid candle sequence must be rejected")
