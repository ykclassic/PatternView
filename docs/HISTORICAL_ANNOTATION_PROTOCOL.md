# Historical Annotation Protocol — v1

## Purpose

Create reference labels for the frozen crypto-pattern predictions without using detector outputs to decide what the labels should be. This is a human-reference exercise, not an attempt to prove profitability.

## Blindness and provenance

1. Use only the `patternview-blind-dataset` artifact from the same preparation run. Do not provide annotators the `patternview-frozen-predictions` artifact, detector output, or model-generated labels.
2. Preserve the prepared manifest, source venue per snapshot, UTC timestamps, and SHA-256 digests. Do not edit source candles.
3. Keep the split assigned before annotation. Do not move samples between train, validation, and test after labels or detector outputs are reviewed.
4. Record the dataset artifact/run ID, dataset version, label-guide version, annotator, reviewer, and review timestamp.

## Unit of annotation

Each blind packet is one observation. Inspect only candles inside that packet. Label the latest objectively identifiable formation that is fully visible by the packet's final closed candle. If no in-scope formation is objectively present at that cutoff, use `expected_pattern: null` with `disposition: "LABELED"` (explicit NO_PATTERN).

Allowed pattern labels:
- `DOUBLE_TOP`, `DOUBLE_BOTTOM`
- `TRIPLE_TOP`, `TRIPLE_BOTTOM`
- `HEAD_AND_SHOULDERS`, `INVERSE_HEAD_AND_SHOULDERS`
- `DOJI`, `HAMMER`, `SHOOTING_STAR`
- `BULLISH_ENGULFING`, `BEARISH_ENGULFING`
- `MORNING_STAR`, `EVENING_STAR`
- `THREE_WHITE_SOLDIERS`, `THREE_BLACK_CROWS`

Do not use candles beyond the packet end, later market outcome, detector output, or trading profitability to decide the label. A formation that requires a future breakout is not labeled as already qualified unless that breakout is visible within the packet.

## Ambiguity and disagreements

- Use `disposition: "AMBIGUOUS"` when the formation cannot be labeled consistently under this guide. Leave `expected_pattern` as `null`; ambiguous rows are excluded from metric denominators and reported separately.
- Use `disposition: "LABELED"` and `expected_pattern: null` only when the reviewer affirmatively sees no qualifying formation.
- Do not leave any `UNREVIEWED` row in a final label artifact.
- For every test-split observation, a second reviewer must inspect the blind candles independently. Record both annotator and reviewer and set `adjudicated: true` only after disagreements have been resolved. Do not adjudicate by looking at detector predictions.
- If a disagreement cannot be resolved from the packet alone, mark it ambiguous rather than guessing.

## Evaluation and interpretation

1. Freeze the predictions and their SHA-256 digest before final labels are supplied.
2. Run evaluation separately by chronological split; the latest test split is the release holdout.
3. Report sample count, TP/FP/FN/TN, precision, recall, false-positive rate, and support per pattern. Null metrics mean the denominator is zero; they are not zero-performance values.
4. The pilot has only 72 packets across 15 pattern classes and 12 pair/timeframe series. Metrics are descriptive until the sample is expanded and each class has sufficient positive and negative support. Synthetic tests are never historical observations.
5. Classification metrics do not establish profitability, expected return, or suitability for live trading.
