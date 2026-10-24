# Phase 3 — Frozen Predictions and Leakage-Safe Evaluation Inputs

## Objective

Make historical evaluation reproducible without blocking app engineering on human annotation. Phase 3 generates a deterministic prediction artifact from the versioned blind packet file and records an immutable-style manifest. It does not generate ground-truth labels or claim detector accuracy.

## Run

After preparing the historical dataset with `npm run dataset:prepare`, run:

```bash
npm run predictions:freeze
```

The command reads `datasets/historical-v1/blind-packets.jsonl`, validates packet identity, boundaries, OHLCV and timeframe spacing, and calls the detector with only the candles inside each packet. It writes:

- `datasets/historical-v1/predictions-v1.jsonl`: one frozen detector result per packet.
- `datasets/historical-v1/prediction-manifest-v1.json`: input packet SHA-256, output prediction SHA-256, detector rule version, split counts and limitations.

The generated artifact records the split for each packet. Within each symbol/timeframe series, packets are sorted by UTC end time; the earliest 60% are train, the next through 80% are validation, and the latest remainder are test, with deterministic floor boundaries and at least one train packet per non-empty series.

## Guardrails

- Detector inputs are bounded to each packet; later packets and future candles are never passed to a detector invocation.
- The script refuses malformed candles, bad packet boundaries, duplicate IDs, overlapping packet windows within a symbol/timeframe series, and empty packet files.
- Prediction artifact digests support reproducibility but do not prove data authenticity or detector correctness.
- Predictions are not labels. Do not use predictions to create or adjudicate the reference-label file.
- Human annotation does not block app development or deployment. Until trustworthy reference labels exist, metrics are not accepted as historical performance and no accuracy or profitability claim is permitted.
- The initial sample is a pilot. A temporal split does not itself prove broad market representativeness.

## Acceptance gates

1. CI tests, type-check, lint and production build pass.
2. Dataset preparation succeeds in a network-enabled environment and source provenance is retained.
3. Prediction generation succeeds from the prepared packet file and produces matching SHA-256 digests.
4. Automated tests establish deterministic split assignment and prove each detector input is bounded to its packet.
5. Historical metrics remain explicitly unavailable until a frozen reference-label artifact is supplied.
