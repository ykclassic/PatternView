# Phase 2 — Historical Evaluation and Scan Auditability

## Objective

Make detector quality measurable against independently labeled observations and make each scan reproducible from explicit provenance. Phase 2 does not add execution, exchange credentials, alerts, machine learning, or new markets.

## Evaluation contract

The pure evaluator in `src/lib/evaluation.ts` scores frozen predictions against human-labeled observations. Each observation has a unique ID, pair, timeframe, candle end timestamp, expected pattern (or explicit no-pattern label), and detector output (or no detection). The report records detector rule version and dataset version and reports per-pattern TP/FP/FN/TN, precision, recall and false-positive rate.

- No labels are inferred from detector output.
- Empty denominators produce `null`, not a fabricated zero.
- Duplicate observation IDs, missing provenance versions, invalid timestamps, and missing pair/timeframe are rejected.
- A single observation can be a positive for at most one pattern in this first evaluator; multi-label evaluation requires a deliberate schema extension.
- Synthetic unit-test fixtures are implementation tests, not historical evaluation evidence.

## Dataset protocol

Before claiming detection quality, create a versioned dataset with source venue, pair, timeframe, UTC start/end, candle source or immutable dataset digest, labeling guide, annotator/reviewer, ambiguity handling, and detector rule version. Keep a temporal holdout. Labels must be assigned independently of predictions where practical. Freeze predictions before calculating metrics. Report per-pattern counts and confusion metrics alongside sample sizes; do not claim profitability from classification metrics.

No historical dataset is bundled by this change, so this PR adds the scoring harness only. It does not claim that precision, recall or false-positive rate have been measured on real market history.

## Scan auditability

Existing browser-local scan history retains provider, timeframe, timestamps, rule version, detection result and candle snapshot. It remains local to one browser and capped at 20 records. A future migration to durable server-side history must be separately scoped and must not silently upload user data.

## Acceptance gates

1. CI: unit tests, type-check, lint and production build pass.
2. Evaluator: confusion-count and zero-denominator tests pass.
3. Data: no historical accuracy claim until a reviewed, versioned labeled dataset has been evaluated.
4. Existing live market-data and detector safety checks remain green.
5. No order execution, private exchange credentials, alerting or ML added.
