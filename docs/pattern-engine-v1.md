# Pattern Engine v1.0.0 — implementation specification

## Scope
This first deterministic engine version provides configurable, causal pivot detection; double-top/double-bottom candidates; and first-pass triangle classification. It is an experimental scanner, not a trade-execution system. It does not claim calibrated confidence or profitability.

## Input contract
- Input is a chronological array of completed OHLCV candles.
- Candle timestamps must be strictly increasing.
- OHLCV values must be finite and internally consistent; prices must be positive and volume non-negative.
- Historical replay must call the engine with only candles available at the decision time. The engine cannot infer a safe as-of cutoff if later candles are included in the input.

## Pivot confirmation
- A pivot candidate must be an extreme relative to the configured number of candles on its left and the available candles on its right.
- A pivot is confirmed only when the full configured right-hand window exists.
- A detected pattern is emitted only while its formation remains within `maxFormationBars` of the current as-of candle; stale structures expire.
- `time` is the pivot candle time; `confirmedAtTime` is the time when confirmation became observable.
- Unconfirmed tail candidates are marked `confirmed: false` and are never used for pattern detections.
- This avoids backdating a confirmed pattern to a time before its right-side confirmation candles closed.

## Default configuration
| Parameter | Default | Meaning |
|---|---:|---|
| leftBars | 3 | Completed candles required to the left |
| rightBars | 3 | Completed candles required to the right for confirmation |
| atrPeriod | 14 | Rolling true-range averaging period |
| minPivotSeparation | 8 | Minimum candle distance between outer pivots |
| maxFormationBars | 100 | Maximum formation span |
| levelToleranceAtr | 1.25 | Maximum outer-pivot difference in ATR units |
| minProminenceAtr | 1.5 | Minimum reaction depth/height in ATR units |
| horizontalBoundaryAtr | 0.75 | Slope-change threshold for horizontal/converging triangle boundaries |
| minQualityScore | 55 | Heuristic score threshold; not a probability |

These are initial engineering defaults, not empirically validated production thresholds. They must be versioned and evaluated against independently labeled data before becoming production defaults.

## Pattern rules
### Double top
Two confirmed swing highs, separated by at least `minPivotSeparation`, with an intervening confirmed swing low. Outer highs must be within `levelToleranceAtr` ATR units; the reaction low must provide at least `minProminenceAtr` ATR of prominence. The reaction low is the neckline. A close below the neckline changes state to `CONFIRMED`; a close above the calculated invalidation level changes state to `INVALIDATED`.

### Double bottom
Mirror of double top: two confirmed swing lows with an intervening swing high, ATR-normalized level similarity and sufficient reaction height. The intervening high is the neckline. A close above it confirms; a close below the invalidation level invalidates.

### Ascending triangle
Last confirmed swing highs form a near-horizontal upper boundary while swing lows rise beyond the configured slope tolerance.

### Descending triangle
Last confirmed swing lows form a near-horizontal lower boundary while swing highs fall beyond the configured slope tolerance.

### Symmetrical triangle
Confirmed swing highs decline while confirmed swing lows rise. Direction remains neutral until a close breaks a boundary.

Triangle boundary fitting is a first-pass linear fit from the first and last of the selected confirmed swing pivots, projected to the latest supplied candle. Breakout checks use these projected boundaries rather than the average of the pivot prices. It remains an approximation and requires independent validation before production acceptance.

## Quality score
The output's `qualityScore` is a deterministic 0–100 heuristic composed of measurable structural features. It is explicitly marked `isProbability: false`. It must not be described as a confidence probability until calibration and out-of-sample validation demonstrate that interpretation.

## Output/explanation
Each result includes algorithm version, state, bias, detection time, pivot timestamps, computed boundaries, breakout/invalidation levels when available, quality score, measured pass/fail criteria, and warnings. Prices are computed from supplied candles; the engine does not fabricate placeholder values.

## Non-goals / acceptance gaps
- No claims of predictive edge or profitability.
- No live orders or trade execution.
- No validated production thresholds until independent labels and chronological test adjudication are complete.
- Head-and-shoulders, wedges, and flags remain later-stage patterns; implement only after Stage A validation.
