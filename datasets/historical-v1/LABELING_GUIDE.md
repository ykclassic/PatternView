# Historical Pattern Dataset v1 — Labeling Guide

## Status

This guide defines the protocol; it does not claim that any sample has been labeled. The annotation ledger intentionally contains only its header until reviewers inspect the blind packets.

## Unit of annotation

One packet is one symbol/timeframe and one contiguous window of 120 closed candles. Annotate only information available by the packet's final candle close. Do not use later candles to decide whether the pattern existed at the packet end. A pattern that would only become confirmed later must not be labeled as confirmed at this cutoff.

## Blind review

- Annotators must not see detector outputs, detector explanations, entry/stop/target levels, or the other annotator's labels.
- At least two reviewers label each packet independently.
- Use one primary label. Choose `NO_PATTERN` if no in-scope pattern is sufficiently supported; choose `AMBIGUOUS` if the candle window does not support a confident single label.
- Record confidence as an integer from 1 to 5 and explain borderline decisions in notes.
- Do not force a label to fit the detector's catalogue if evidence is weak.
- Adjudicate disagreements using the same guide and preserve both original labels plus the adjudicated label in the audit record.

## Formation criteria

### Classical chart structures

- **Double top / bottom:** two confirmed, comparable swing highs/lows with an intervening neckline pivot. A breakout is a separate state and requires a closed candle beyond the neckline.
- **Triple top / bottom:** three distinct, comparable confirmed swing highs/lows with meaningful intervening retracements. Do not count small adjacent fluctuations as separate tests.
- **Head and shoulders / inverse:** three confirmed swing extrema with a central head clearly beyond both shoulders and two identifiable intervening neckline pivots. If shoulder/head ordering or neckline is unclear, use `AMBIGUOUS` or `NO_PATTERN`.

### Candlestick formations

Use the full OHLC body and wick geometry, plus context where the formation requires it. A single candle's shape alone does not establish reversal context for a hammer, shooting star, morning star, or evening star. Engulfing labels require opposite-color bodies and a current body that fully engulfs the previous real body. Three-soldier/crow labels require three consecutive directional bodies with orderly closes and without excessive counter-wicks. Doji means the body is small relative to the candle's full range; do not label near-zero-range or malformed candles.

## Data integrity and time

- Labels refer to the packet's final closed-candle timestamp, stored in UTC epoch seconds.
- Never look beyond that timestamp.
- If the packet contains invalid or missing candles, mark it as a data-quality issue and exclude it until corrected; do not label the pattern.
- A packet can have at most one primary pattern label in v1. Multi-pattern co-occurrence is deferred and must not be silently collapsed.
- Preserve the original raw candle snapshot and its SHA-256 digest.

## Quality control

1. Two independent labels per packet.
2. Report raw agreement and the complete disagreement list.
3. Adjudicate disagreements before freezing labels.
4. Freeze dataset version, labeling guide hash, raw-data digest, and detector rule version before evaluating.
5. Keep the temporal test split untouched during label-guide tuning.
6. Report sample counts and confusion counts with metrics. A missing denominator means metric `null`, not zero.
7. Never interpret pattern classification metrics as profitability, expected return, or win rate.
