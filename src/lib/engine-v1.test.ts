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


function fixtureConfig() {
  return {
    ...DEFAULT_ENGINE_CONFIG,
    leftBars: 1,
    rightBars: 1,
    atrPeriod: 3,
    minPivotSeparation: 3,
    maxFormationBars: 60,
    levelToleranceAtr: 1.5,
    minProminenceAtr: 1.5,
    horizontalBoundaryAtr: 0.2,
    minQualityScore: 0,
  };
}

function structuredBottomCandles(): Candle[] {
  const values = Array.from({ length: 55 }, () => 105);
  for (const [index, value] of [[8, 100], [16, 110], [24, 100.2], [32, 110], [40, 105]] as Array<[number, number]>) values[index] = value;
  return values.map((close, index) => ({
    time: 1_710_000_000 + index * 3600,
    open: close,
    high: close + (index === 16 || index === 32 ? 0 : 1),
    low: close - (index === 8 || index === 24 ? 0 : 1),
    close,
    volume: 100,
  }));
}

function triangleFixture(
  highPeaks: number[],
  lowTroughs: number[],
): Candle[] {
  const length = 48;
  const peakIndices = [5, 15, 25, 35];
  const troughIndices = [10, 20, 30, 40];
  return Array.from({ length }, (_, index) => {
    let high = 22;
    let low = 20;
    const peak = peakIndices.indexOf(index);
    const trough = troughIndices.indexOf(index);
    if (peak >= 0) high = highPeaks[peak];
    if (trough >= 0) low = lowTroughs[trough];
    const close = (high + low) / 2;
    return {
      time: 1_720_000_000 + index * 3600,
      open: close,
      high,
      low,
      close,
      volume: 100,
    };
  });
}

test("positive fixture: double bottom is detected with confirmed pivots", () => {
  const results = detectPatternsV1(structuredBottomCandles(), fixtureConfig());
  const bottom = results.find((pattern) => pattern.kind === "DOUBLE_BOTTOM");
  assert.ok(bottom, "expected a double-bottom detection");
  assert.ok(bottom.pivots.every((pivot) => pivot.confirmed));
  assert.equal(bottom.isProbability, false);
  assert.ok(bottom.explanation.some((item) => item.code === "STRUCTURAL_PROMINENCE"));
});

test("positive fixtures: each triangle subtype is classified from confirmed swing structure", () => {
  const cases = [
    { kind: "ASCENDING_TRIANGLE", highs: [26, 26, 26, 26], lows: [10, 12, 14, 16] },
    { kind: "DESCENDING_TRIANGLE", highs: [30, 28, 26, 24], lows: [10, 10, 10, 10] },
    { kind: "SYMMETRICAL_TRIANGLE", highs: [30, 28, 26, 24], lows: [10, 12, 14, 16] },
  ] as const;
  for (const item of cases) {
    const results = detectPatternsV1(triangleFixture(item.highs, item.lows), fixtureConfig());
    assert.ok(
      results.some((pattern) => pattern.kind === item.kind),
      `expected ${item.kind}; got ${results.map((pattern) => pattern.kind).join(", ")}`,
    );
  }
});

test("negative fixtures: monotonic price action emits none of the five foundational patterns", () => {
  const candles = candlesFrom(Array.from({ length: 80 }, (_, index) => 100 + index * 0.2));
  const results = detectPatternsV1(candles, fixtureConfig());
  assert.deepEqual(results, []);
});

test("negative fixture: unequal swing highs do not qualify as a double top", () => {
  const candles = structuredCandles().map((candle, index) => {
    if (index === 24) return { ...candle, open: 116, high: 117, close: 116, low: 115 };
    return candle;
  });
  const results = detectPatternsV1(candles, { ...fixtureConfig(), levelToleranceAtr: 0.00001 });
  assert.equal(results.some((pattern) => pattern.kind === "DOUBLE_TOP"), false);
});

test("stale double-top formations expire instead of persisting indefinitely", () => {
  const candles = structuredCandles();
  const extension = candlesFrom(Array.from({ length: 120 }, (_, index) => 106 + index * 0.01))
    .map((candle, index) => ({ ...candle, time: candles[candles.length - 1].time + (index + 1) * 3600 }));
  const results = detectPatternsV1([...candles, ...extension], {
    ...fixtureConfig(),
    maxFormationBars: 50,
  });
  assert.equal(results.some((pattern) => pattern.kind === "DOUBLE_TOP"), false);
});


test("negative fixture: unequal swing lows do not qualify as a double bottom", () => {
  const candles = structuredBottomCandles().map((candle, index) => {
    if (index === 24) return { ...candle, open: 94, high: 95, close: 94, low: 93 };
    return candle;
  });
  const results = detectPatternsV1(candles, { ...fixtureConfig(), levelToleranceAtr: 0.00001 });
  assert.equal(results.some((pattern) => pattern.kind === "DOUBLE_BOTTOM"), false);
});

test("negative fixtures: non-converging triangle lookalikes are rejected", () => {
  const cases = [
    { name: "flat upper and flat lower", highs: [26, 26, 26, 26], lows: [10, 10, 10, 10] },
    { name: "both boundaries falling", highs: [30, 28, 26, 24], lows: [16, 14, 12, 10] },
    { name: "both boundaries rising", highs: [24, 26, 28, 30], lows: [10, 12, 14, 16] },
  ];
  for (const item of cases) {
    const results = detectPatternsV1(triangleFixture(item.highs, item.lows), fixtureConfig());
    assert.equal(
      results.some((pattern) => pattern.kind.endsWith("TRIANGLE")),
      false,
      `unexpected triangle for ${item.name}: ${results.map((pattern) => pattern.kind).join(", ")}`,
    );
  }
});

test("all reported pivots were observable by the pattern detection time", () => {
  const candles = structuredCandles();
  const results = detectPatternsV1(candles, fixtureConfig());
  for (const pattern of results) {
    assert.equal(pattern.detectedAtTime, candles[candles.length - 1].time);
    for (const pivot of pattern.pivots) {
      assert.equal(pivot.confirmed, true);
      assert.ok(pivot.confirmedAtTime !== null);
      assert.ok(pivot.confirmedAtTime! <= pattern.detectedAtTime);
    }
  }
});
