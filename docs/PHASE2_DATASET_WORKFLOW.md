# Phase 2 — Versioned Historical Dataset Workflow

## Current status

The repository defines dataset v1 and provides a deterministic preparation script. The actual market snapshot files and annotation results are generated artifacts and must be created, reviewed, and committed separately. The manifest status remains `PREPARATION` until those gates are complete. Do not report metrics before labels are independently reviewed.

## Prepare raw data and blind packets

Requirements: Node.js 22+ and npm dependencies installed.

Run:

```bash
npx tsx scripts/prepare-historical-dataset.ts
```

The script fetches up to 720 closed candles for BTCUSDT, ETHUSDT and SOLUSDT at 15m, 1h, 4h and 1d from Binance Spot's public klines endpoint. It rejects malformed OHLCV, duplicate/out-of-order timestamps and interval gaps. It writes one immutable-style snapshot per pair/timeframe, a set of contiguous 120-candle blind packets, and a manifest containing SHA-256 digests. It does not produce labels or detector predictions.

Generated files:
- `datasets/historical-v1/{SYMBOL}-{TIMEFRAME}.json`: raw candle snapshot, source and digest.
- `datasets/historical-v1/blind-packets.jsonl`: candle-only packets for reviewers.
- `datasets/historical-v1/prepared-manifest.json`: packet counts and content digests.
- `datasets/historical-v1/annotations.csv`: independent annotation ledger template.

Review the packet windows in `blind-packets.jsonl` with the [labeling guide](../datasets/historical-v1/LABELING_GUIDE.md). Two reviewers must label each packet independently and must not see detector predictions. Preserve individual labels and adjudications in a separate audit file before creating a frozen single-label annotation file.

## Freeze and evaluate

Before evaluation:
1. Commit the raw snapshots and packet manifest under a new dataset version; do not overwrite a previously evaluated version.
2. Record two independent labels, reviewer IDs, review timestamps and adjudication for every packet.
3. Resolve disagreements or mark the packet ambiguous. Exclude ambiguous and invalid-data packets from the primary classification report and report their counts separately.
4. Freeze the label guide, dataset digest and detector rule version.
5. Run the detector on each packet's candles exactly as supplied; store predictions separately with the exact commit/rule version. Never use future candles.
6. Evaluate only the frozen labels and frozen predictions. Keep the latest temporal split untouched until the guide and detector are frozen.

## Known limitations

- The initial 720 candles per pair/timeframe create a small pilot (at most six non-overlapping packets per series), not enough to claim representative performance.
- Pattern frequency is imbalanced; report counts and per-pattern denominators.
- This dataset tests classification at the packet endpoint, not future returns or profitability.
- Public exchange history can be corrected or revised. Preserve the exact retrieved snapshot and digest used for each report.
- Dataset generation requires live network access and has not been executed by CI.
