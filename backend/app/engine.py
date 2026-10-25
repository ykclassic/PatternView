"""Deterministic, causal pattern recognition and interpretation rules."""
from __future__ import annotations

from dataclasses import dataclass
from math import isfinite
from typing import Literal

from app.schemas import Candle

PatternKind = Literal[
    "DOUBLE_TOP", "DOUBLE_BOTTOM", "HEAD_AND_SHOULDERS",
    "INVERSE_HEAD_AND_SHOULDERS", "ASCENDING_TRIANGLE",
    "DESCENDING_TRIANGLE", "SYMMETRICAL_TRIANGLE",
    "BULL_FLAG", "BEAR_FLAG", "RISING_WEDGE", "FALLING_WEDGE",
]
PatternStatus = Literal[
    "FORMING", "CONFIRMED", "WAITING FOR BREAKOUT",
    "QUALIFIED", "INVALIDATED", "NO TRADE",
]
RULE_VERSION = "patternview-engine-v1.1"
PIVOT_RADIUS = 3
MIN_CANDLES = 40


@dataclass(frozen=True)
class Pivot:
    index: int
    time: int
    price: float
    kind: Literal["high", "low"]
    confirmed_at: int


@dataclass(frozen=True)
class PatternResult:
    kind: PatternKind
    status: PatternStatus
    quality_score: int
    first_pivot_time: int
    last_pivot_time: int
    detection_time: int
    neckline: float
    breakout_level: float
    invalidation: float
    entry: float | None
    stop_loss: float | None
    take_profit: float | None
    explanation: list[str]
    rule_version: str = RULE_VERSION


def confirmed_pivots(candles: list[Candle], radius: int = PIVOT_RADIUS) -> list[Pivot]:
    """Return only pivots with all right-side confirmation candles available."""
    pivots: list[Pivot] = []
    if radius < 1:
        raise ValueError("radius must be positive")
    for index in range(radius, len(candles) - radius):
        current = candles[index]
        window = candles[index - radius:index + radius + 1]
        if all(current.high >= item.high for item in window) and any(
            offset != radius and current.high > item.high
            for offset, item in enumerate(window)
        ):
            pivots.append(Pivot(index, current.time, current.high, "high", candles[index + radius].time))
        if all(current.low <= item.low for item in window) and any(
            offset != radius and current.low < item.low
            for offset, item in enumerate(window)
        ):
            pivots.append(Pivot(index, current.time, current.low, "low", candles[index + radius].time))
    return sorted(pivots, key=lambda item: (item.index, item.kind))


def _slope(points: list[Pivot]) -> float:
    if len(points) < 2:
        return 0.0
    mean_x = sum(point.index for point in points) / len(points)
    mean_y = sum(point.price for point in points) / len(points)
    denominator = sum((point.index - mean_x) ** 2 for point in points)
    if denominator == 0:
        return 0.0
    return sum((point.index - mean_x) * (point.price - mean_y) for point in points) / denominator


def _line_at(points: list[Pivot], index: int) -> float:
    return points[-1].price + _slope(points) * (index - points[-1].index)


def _relative_difference(left: float, right: float) -> float:
    midpoint = (abs(left) + abs(right)) / 2
    return abs(left - right) / midpoint if midpoint else float("inf")


def _make_result(
    kind: PatternKind,
    pivots: list[Pivot],
    candles: list[Candle],
    neckline: float,
    invalidation: float,
    bullish: bool,
    quality: int,
    explanation: list[str],
) -> PatternResult:
    last = candles[-1]
    close = last.close
    if bullish:
        status: PatternStatus = "QUALIFIED" if close > neckline else (
            "INVALIDATED" if close < invalidation else "WAITING FOR BREAKOUT"
        )
        target = neckline + max(0.0, neckline - invalidation)
    else:
        status = "QUALIFIED" if close < neckline else (
            "INVALIDATED" if close > invalidation else "WAITING FOR BREAKOUT"
        )
        target = neckline - max(0.0, invalidation - neckline)
    entry = neckline if status in ("WAITING FOR BREAKOUT", "QUALIFIED") else None
    return PatternResult(
        kind=kind,
        status=status,
        quality_score=max(0, min(100, quality)),
        first_pivot_time=pivots[0].time,
        last_pivot_time=pivots[-1].time,
        detection_time=last.time,
        neckline=neckline,
        breakout_level=neckline,
        invalidation=invalidation,
        entry=entry,
        stop_loss=invalidation,
        take_profit=target if isfinite(target) and target > 0 else None,
        explanation=explanation + [
            "Status is based on the latest closed candle.",
            "Quality score is a deterministic heuristic, not a probability or performance estimate.",
        ],
    )


def _double_patterns(candles: list[Candle], pivots: list[Pivot]) -> list[PatternResult]:
    results: list[PatternResult] = []
    highs = [point for point in pivots if point.kind == "high"]
    lows = [point for point in pivots if point.kind == "low"]
    close = candles[-1].close
    for kind in ("DOUBLE_TOP", "DOUBLE_BOTTOM"):
        points = highs if kind == "DOUBLE_TOP" else lows
        for left_index, first in enumerate(points):
            for second in points[left_index + 1:]:
                distance = second.index - first.index
                if distance < 8:
                    continue
                if distance > 100:
                    break
                if _relative_difference(first.price, second.price) > 0.012:
                    continue
                between = [
                    point for point in (lows if kind == "DOUBLE_TOP" else highs)
                    if first.index < point.index < second.index
                ]
                if not between:
                    continue
                neck = min(point.price for point in between) if kind == "DOUBLE_TOP" else max(
                    point.price for point in between
                )
                peak_or_trough = max(first.price, second.price) if kind == "DOUBLE_TOP" else min(
                    first.price, second.price
                )
                bullish = kind == "DOUBLE_BOTTOM"
                invalidation = peak_or_trough * (0.997 if bullish else 1.003)
                results.append(_make_result(
                    kind, [first, second], candles, neck, invalidation, bullish, 72,
                    [f"Two confirmed {('highs' if not bullish else 'lows')} match within 1.2%.",
                     "An intervening confirmed swing defines the neckline.",
                     "The formation expires after 100 bars between pivots."],
                ))
    return results


def _head_shoulders(candles: list[Candle], pivots: list[Pivot]) -> list[PatternResult]:
    results: list[PatternResult] = []
    highs = [point for point in pivots if point.kind == "high"]
    lows = [point for point in pivots if point.kind == "low"]
    for bullish in (False, True):
        points = lows if bullish else highs
        for i in range(len(points) - 2):
            left, head, right = points[i:i + 3]
            if not (5 <= head.index - left.index <= 50 and 5 <= right.index - head.index <= 50):
                continue
            shoulder_match = _relative_difference(left.price, right.price) <= 0.05
            head_valid = head.price < min(left.price, right.price) * 0.99 if bullish else (
                head.price > max(left.price, right.price) * 1.01
            )
            if not shoulder_match or not head_valid:
                continue
            troughs = [p for p in lows if left.index < p.index < right.index] if not bullish else [
                p for p in highs if left.index < p.index < right.index
            ]
            left_neck = [p for p in troughs if p.index < head.index]
            right_neck = [p for p in troughs if p.index > head.index]
            if not left_neck or not right_neck:
                continue
            neckline = (left_neck[-1].price + right_neck[0].price) / 2
            invalidation = min(left.price, right.price) * 0.997 if bullish else max(
                left.price, right.price
            ) * 1.003
            kind: PatternKind = "INVERSE_HEAD_AND_SHOULDERS" if bullish else "HEAD_AND_SHOULDERS"
            results.append(_make_result(
                kind, [left, head, right], candles, neckline, invalidation, bullish, 78,
                ["Three confirmed pivots form two similar shoulders and a distinct head.",
                 "The neckline is the average of the two intervening confirmed swings."],
            ))
    return results


def _triangles(candles: list[Candle], pivots: list[Pivot]) -> list[PatternResult]:
    highs = [p for p in pivots if p.kind == "high"][-4:]
    lows = [p for p in pivots if p.kind == "low"][-4:]
    if len(highs) < 3 or len(lows) < 3:
        return []
    highs = highs[-3:]
    lows = lows[-3:]
    if max(highs[-1].index, lows[-1].index) - min(highs[0].index, lows[0].index) > 80:
        return []
    high_slope, low_slope = _slope(highs), _slope(lows)
    high_level = sum(p.price for p in highs) / len(highs)
    low_level = sum(p.price for p in lows) / len(lows)
    gap_start = _line_at(highs, min(highs[0].index, lows[0].index)) - _line_at(
        lows, min(highs[0].index, lows[0].index)
    )
    gap_now = _line_at(highs, len(candles) - 1) - _line_at(lows, len(candles) - 1)
    if gap_start <= 0 or gap_now <= 0 or gap_now >= gap_start:
        return []
    if abs(high_slope) <= high_level * 0.0003 and low_slope > low_level * 0.0003:
        kind: PatternKind = "ASCENDING_TRIANGLE"
    elif high_slope < -high_level * 0.0003 and abs(low_slope) <= low_level * 0.0003:
        kind = "DESCENDING_TRIANGLE"
    elif high_slope < -high_level * 0.0003 and low_slope > low_level * 0.0003:
        kind = "SYMMETRICAL_TRIANGLE"
    else:
        return []
    pivots_used = sorted(highs + lows, key=lambda p: p.index)
    return [_make_result(
        kind, pivots_used, candles, (high_level + low_level) / 2,
        high_level * 1.003, True, 64,
        ["Three confirmed swing highs and lows form converging boundaries.",
         f"Projected upper/lower boundary slopes are {high_slope:.6g} and {low_slope:.6g}.",
         "Triangle breakout direction is not predicted; qualification uses the midpoint reference only."],
    )]


def _flags_and_wedges(candles: list[Candle], pivots: list[Pivot]) -> list[PatternResult]:
    results: list[PatternResult] = []
    highs = [p for p in pivots if p.kind == "high"][-3:]
    lows = [p for p in pivots if p.kind == "low"][-3:]
    if len(highs) >= 3 and len(lows) >= 3:
        upper_slope, lower_slope = _slope(highs), _slope(lows)
        start_index = min(highs[0].index, lows[0].index)
        end_index = len(candles) - 1
        gap_start = _line_at(highs, start_index) - _line_at(lows, start_index)
        gap_end = _line_at(highs, end_index) - _line_at(lows, end_index)
        if gap_start > 0 and 0 < gap_end < gap_start * 0.85:
            if upper_slope > 0 and lower_slope > upper_slope:
                kind: PatternKind = "RISING_WEDGE"
            elif upper_slope < 0 and lower_slope < upper_slope:
                kind = "FALLING_WEDGE"
            else:
                kind = ""
            if kind:
                results.append(_make_result(
                    kind, sorted(highs + lows, key=lambda p: p.index), candles,
                    (highs[-1].price + lows[-1].price) / 2,
                    max(highs[-1].price, lows[-1].price) * 1.003,
                    kind == "FALLING_WEDGE", 58,
                    ["Three confirmed swing highs and lows form a narrowing channel.",
                     "Wedge classification uses the direction of both boundary slopes."],
                ))

    # A flag requires a clear directional pole followed by a compact, sloped range.
    if len(candles) >= 40:
        close_now = candles[-1].close
        pole_start = candles[-25].close
        move = (close_now - pole_start) / pole_start if pole_start else 0.0
        recent = candles[-12:]
        recent_range = (max(c.high for c in recent) - min(c.low for c in recent)) / close_now
        if abs(move) >= 0.04 and recent_range <= abs(move) * 0.75:
            highs_recent = [p for p in pivots if p.kind == "high" and p.index >= len(candles) - 15]
            lows_recent = [p for p in pivots if p.kind == "low" and p.index >= len(candles) - 15]
            if len(highs_recent) >= 2 and len(lows_recent) >= 2:
                upper_slope, lower_slope = _slope(highs_recent), _slope(lows_recent)
                parallel = abs(upper_slope - lower_slope) <= max(abs(upper_slope), abs(lower_slope), 0.01) * 0.75
                if parallel and upper_slope * lower_slope >= 0:
                    bullish = move > 0
                    kind = "BULL_FLAG" if bullish else "BEAR_FLAG"
                    neck = (highs_recent[-1].price + lows_recent[-1].price) / 2
                    invalidation = min(c.low for c in recent) if bullish else max(c.high for c in recent)
                    results.append(_make_result(
                        kind, sorted(highs_recent + lows_recent, key=lambda p: p.index), candles,
                        neck, invalidation, bullish, 55,
                        ["A directional price move precedes a compact, approximately parallel consolidation.",
                         "Flag rules are heuristic and require independent historical validation."],
                    ))
    return results


def detect_patterns(candles: list[Candle]) -> list[PatternResult]:
    """Validate candle sequence, then return the strongest recent structural candidates."""
    if len(candles) < MIN_CANDLES:
        return []
    previous_time = 0
    for candle in candles:
        if candle.time <= previous_time:
            raise ValueError("candle timestamps must be strictly increasing")
        previous_time = candle.time
    pivots = confirmed_pivots(candles)
    candidates = (
        _double_patterns(candles, pivots)
        + _head_shoulders(candles, pivots)
        + _triangles(candles, pivots)
        + _flags_and_wedges(candles, pivots)
    )
    # Keep one latest representative per pattern kind and sort newest first.
    latest: dict[str, PatternResult] = {}
    for candidate in candidates:
        current = latest.get(candidate.kind)
        if current is None or candidate.last_pivot_time > current.last_pivot_time:
            latest[candidate.kind] = candidate
    return sorted(latest.values(), key=lambda item: (item.last_pivot_time, item.quality_score), reverse=True)[:6]
