import test from "node:test";
import assert from "node:assert/strict";
import type { Candle } from "./types";
import { DEFAULT_ENGINE_CONFIG, detectPivots, detectPatternsV1 } from "./engine-v1";

function candlesFrom(closes: number[]): Candle[] {
  return closes.map((close, index) => ({
    time: 1_700_000_000 + index * 3600,
    open: close,
    high: close + 1,
    low: close - 1,
    close,
    volume: 100,
  }));
}

function structuredCandles(): Candle[] {
  const values = Array.from({ length: 70 }, () => 105);
  for (const [index, value] of [[8, 110], [16, 100], [24, 110.2], [32, 100], [40, 105]] as Array<[number, number]>) values[index] = value;
  return values.map((close, index) => ({
    time: 1_700_000_000 + index * 3600,
    open: close,
    high: close + (index === 8 || index === 24 ? 0 : 1),
    low: close - (index === 16 || index === 32 ? 0 : 1),
    close,
    volume: 100,
  }));
}

test("pivot confirmation time is later than the pivot candle", () => {
  const data = candlesFrom([10, 11, 12, 15, 12, 11, 10, 11, 12]);
  const pivots = detectPivots(data, { ...DEFAULT_ENGINE_CONFIG, leftBars: 2, rightBars: 2 });
  const high = pivots.find((pivot) => pivot.kind === "HIGH");
  assert.ok(high);
  assert.equal(high.confirmed, true);
  assert.equal(high.confirmedAtIndex, high.index + 2);
  assert.equal(high.confirmedAtTime, data[high.index + 2].time);
  assert.ok(high.confirmedAtTime! > high.time);
});

test("latest unconfirmed local extreme is marked potential, not confirmed", () => {
  const data = candlesFrom([10, 11, 12, 15, 12, 11, 10, 11, 12, 13]);
  const pivots = detectPivots(data, { ...DEFAULT_ENGINE_CONFIG, leftBars: 2, rightBars: 3 });
  const latestPotential = pivots.find((pivot) => pivot.index === data.length - 1 && pivot.kind === "HIGH");
  assert.ok(latestPotential);
  assert.equal(latestPotential.confirmed, false);
  assert.equal(latestPotential.confirmedAtIndex, null);
});

test("as-of replay cannot use candles beyond the supplied prefix", () => {
  const full = candlesFrom([10, 11, 12, 15, 12, 11, 10, 11, 12, 13, 14, 15, 10]);
  const prefix = full.slice(0, 5);
  const fullPivots = detectPivots(full, { ...DEFAULT_ENGINE_CONFIG, leftBars: 2, rightBars: 2 });
  const prefixPivots = detectPivots(prefix, { ...DEFAULT_ENGINE_CONFIG, leftBars: 2, rightBars: 2 });
  assert.ok(fullPivots.some((pivot) => pivot.index === 3 && pivot.confirmed));
  assert.ok(prefixPivots.some((pivot) => pivot.index === 3 && !pivot.confirmed));
});

test("detector is deterministic for identical candles and config", () => {
  const candles = structuredCandles();
  const config = { ...DEFAULT_ENGINE_CONFIG, version: "test-v1" };
  assert.deepEqual(detectPatternsV1(candles, config), detectPatternsV1(candles, config));
});

test("double top detection includes explainable measured criteria and version", () => {
  const candles = structuredCandles();
  const result = detectPatternsV1(candles, { ...DEFAULT_ENGINE_CONFIG, minQualityScore: 0 });
  const top = result.find((pattern) => pattern.kind === "DOUBLE_TOP");
  assert.ok(top);
  assert.equal(top.algorithmVersion, DEFAULT_ENGINE_CONFIG.version);
  assert.equal(top.isProbability, false);
  assert.ok(top.explanation.some((item) => item.code === "PIVOT_LEVEL_SIMILARITY" && item.measuredValue !== undefined));
  assert.ok(top.pivots.every((pivot) => pivot.confirmed));
});

test("rejects invalid candles and invalid config", () => {
  assert.throws(() => detectPivots([{ ...candlesFrom([10])[0], high: 1 }]));
  assert.throws(() => detectPivots(candlesFrom([10, 11]), { ...DEFAULT_ENGINE_CONFIG, rightBars: 0 }));
});

test("does not emit a pattern when there is insufficient data", () => {
  assert.deepEqual(detectPatternsV1(candlesFrom([10, 11, 10])), []);
});
