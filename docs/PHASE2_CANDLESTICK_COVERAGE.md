# Phase 2: Candlestick Pattern Coverage

## Scope
Extend the crypto spot analysis workspace with deterministic detection of common candlestick formations from closed OHLC candles. This is additive to the existing double/triple top and bottom, head-and-shoulders and inverse head-and-shoulders detectors.

## Initial pattern set
- Single-candle: Doji, Hammer, Shooting Star
- Two-candle: Bullish Engulfing, Bearish Engulfing
- Three-candle: Morning Star, Evening Star, Three White Soldiers, Three Black Crows

## Safety and interpretation
- Patterns are descriptive rule-based detections, not probability estimates or trading signals.
- Candlestick formations do not generate entry, stop-loss or take-profit levels.
- Use only closed candles; keep synthetic fixtures separate from historical evaluation.
- Detection rules must be deterministic, versioned and documented.
- Follow-on candidates from the supplied reference posters (e.g. harami, piercing/dark-cloud cover, tweezers, marubozu, wedges, flags, pennants, triangles and rectangles) require their own fixtures and acceptance tests before being advertised as supported.

## Acceptance
- Positive and negative fixtures for each pattern.
- No fabricated trade levels for candle-only detections.
- Existing tests, type-check, lint and build pass.
- Historical precision/recall remain unclaimed until independently labeled market history is evaluated.
