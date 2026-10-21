import test from "node:test";
import assert from "node:assert/strict";
import { detectLatestPattern } from "./patterns";
import type { Candle } from "./types";

function makeTopCandles(lastClose = 105): Candle[] {
  return Array.from({ length: 60 }, (_, index): Candle => {
    const candle: Candle = {
      time: 1_700_000_000 + index * 3600,
      open: 105,
      high: 106,
      low: 104,
      close: 105,
      volume: 1000,
    };
    if (index === 8) Object.assign(candle, { high: 110, close: 107 });
    if (index === 15) Object.assign(candle, { low: 100, close: 103 });
    if (index === 22) Object.assign(candle, { high: 110.2, close: 107 });
    if (index === 59) Object.assign(candle, {
      close: lastClose,
      high: Math.max(106, lastClose + 1),
      low: Math.min(104, lastClose - 1),
    });
    return candle;
  });
}

function makeBottomCandles(lastClose = 105): Candle[] {
  return Array.from({ length: 60 }, (_, index): Candle => {
    const candle: Candle = {
      time: 1_700_000_000 + index * 3600,
      open: 105,
      high: 106,
      low: 104,
      close: 105,
      volume: 1000,
    };
    if (index === 8) Object.assign(candle, { low: 100, close: 103 });
    if (index === 15) Object.assign(candle, { high: 110, close: 107 });
    if (index === 22) Object.assign(candle, { low: 100.2, close: 103 });
    if (index === 59) Object.assign(candle, {
      close: lastClose,
      high: Math.max(106, lastClose + 1),
      low: Math.min(104, lastClose - 1),
    });
    return candle;
  });
}

test("returns no pattern when there are too few closed candles", () => {
  assert.equal(detectLatestPattern(makeTopCandles().slice(0, 20)), null);
});

test("detects a double top and waits for a neckline close", () => {
  const pattern = detectLatestPattern(makeTopCandles(105));
  assert.equal(pattern?.kind, "DOUBLE_TOP");
  assert.equal(pattern?.status, "WAITING FOR BREAKOUT");
  assert.equal(pattern?.neckline, 100);
  assert.equal(pattern?.entry, null);
});

test("qualifies a double top only after a closed candle breaks the neckline", () => {
  const pattern = detectLatestPattern(makeTopCandles(99));
  assert.equal(pattern?.kind, "DOUBLE_TOP");
  assert.equal(pattern?.status, "QUALIFIED");
  assert.equal(pattern?.entry, 100);
  assert.ok(pattern?.stopLoss !== null && pattern.stopLoss !== undefined);
  assert.ok(pattern?.takeProfit !== null && pattern.takeProfit !== undefined);
});

test("invalidates a double top after price closes beyond its invalidation buffer", () => {
  const pattern = detectLatestPattern(makeTopCandles(112));
  assert.equal(pattern?.kind, "DOUBLE_TOP");
  assert.equal(pattern?.status, "INVALIDATED");
  assert.equal(pattern?.entry, null);
});

test("detects a double bottom and waits for a neckline close", () => {
  const pattern = detectLatestPattern(makeBottomCandles(105));
  assert.equal(pattern?.kind, "DOUBLE_BOTTOM");
  assert.equal(pattern?.status, "WAITING FOR BREAKOUT");
  assert.equal(pattern?.neckline, 110);
  assert.equal(pattern?.entry, null);
});

test("qualifies a double bottom only after a closed candle breaks the neckline", () => {
  const pattern = detectLatestPattern(makeBottomCandles(111));
  assert.equal(pattern?.kind, "DOUBLE_BOTTOM");
  assert.equal(pattern?.status, "QUALIFIED");
  assert.equal(pattern?.entry, 110);
  assert.ok(pattern?.stopLoss !== null && pattern.stopLoss !== undefined);
  assert.ok(pattern?.takeProfit !== null && pattern.takeProfit !== undefined);
});

test("rejects malformed OHLC input rather than inventing a pattern", () => {
  const candles = makeTopCandles();
  candles[12] = { ...candles[12], high: 1, low: 200 };
  assert.equal(detectLatestPattern(candles), null);
});


function makeTripleTopCandles(lastClose = 105): Candle[] {
  return Array.from({ length: 70 }, (_, index): Candle => {
    const candle: Candle = { time: 1_700_000_000 + index * 3600, open: 105, high: 106, low: 104, close: 105, volume: 1000 };
    if ([8, 24, 40].includes(index)) Object.assign(candle, { high: index === 24 ? 110.3 : 110, close: 107 });
    if ([16, 32].includes(index)) Object.assign(candle, { low: 100, close: 103 });
    if (index === 69) Object.assign(candle, { close: lastClose, high: Math.max(106, lastClose + 1), low: Math.min(104, lastClose - 1) });
    return candle;
  });
}

function makeHeadShouldersCandles(inverse = false, lastClose = 105): Candle[] {
  return Array.from({ length: 70 }, (_, index): Candle => {
    const candle: Candle = { time: 1_700_000_000 + index * 3600, open: 105, high: 106, low: 104, close: 105, volume: 1000 };
    const levels = inverse
      ? [{ i: 8, low: 100 }, { i: 15, high: 110 }, { i: 22, low: 95 }, { i: 29, high: 111 }, { i: 36, low: 100.5 }]
      : [{ i: 8, high: 110 }, { i: 15, low: 100 }, { i: 22, high: 115 }, { i: 29, low: 101 }, { i: 36, high: 110.5 }];
    for (const level of levels) if (index === level.i) Object.assign(candle, level);
    if (index === 69) Object.assign(candle, { close: lastClose, high: Math.max(106, lastClose + 1), low: Math.min(104, lastClose - 1) });
    return candle;
  });
}

test("detects a triple top and identifies its three pivots", () => {
  const pattern = detectLatestPattern(makeTripleTopCandles());
  assert.equal(pattern?.kind, "TRIPLE_TOP");
  assert.ok(pattern?.thirdPivotTime);
});

test("detects head-and-shoulders and inverse head-and-shoulders", () => {
  assert.equal(detectLatestPattern(makeHeadShouldersCandles())?.kind, "HEAD_AND_SHOULDERS");
  assert.equal(detectLatestPattern(makeHeadShouldersCandles(true))?.kind, "INVERSE_HEAD_AND_SHOULDERS");
});

test("does not label a flat near-miss as a pattern", () => {
  const flat = Array.from({ length: 70 }, (_, index): Candle => ({
    time: 1_700_000_000 + index * 3600, open: 100, high: 101, low: 99, close: 100, volume: 0,
  }));
  assert.equal(detectLatestPattern(flat), null);
});

function makeTripleBottomCandles(lastClose = 105): Candle[] {
  return Array.from({ length: 70 }, (_, index): Candle => {
    const candle: Candle = { time: 1_700_000_000 + index * 3600, open: 105, high: 106, low: 104, close: 105, volume: 1000 };
    if ([8, 24, 40].includes(index)) Object.assign(candle, { low: index === 24 ? 100.2 : 100, close: 103 });
    if (index === 69) Object.assign(candle, { close: lastClose, high: Math.max(106, lastClose + 1), low: Math.min(104, lastClose - 1) });
    if ([16, 32].includes(index)) Object.assign(candle, { high: 110, close: 107 });
    return candle;
  });
}

test("detects a triple bottom", () => {
  assert.equal(detectLatestPattern(makeTripleBottomCandles())?.kind, "TRIPLE_BOTTOM");
});


test("triple top qualifies only after a neckline close and invalidates above the peak buffer", () => {
  assert.equal(detectLatestPattern(makeTripleTopCandles(105))?.status, "WAITING FOR BREAKOUT");
  const qualified = detectLatestPattern(makeTripleTopCandles(99));
  assert.equal(qualified?.kind, "TRIPLE_TOP");
  assert.equal(qualified?.status, "QUALIFIED");
  assert.equal(qualified?.entry, 100);
  const invalidated = detectLatestPattern(makeTripleTopCandles(112));
  assert.equal(invalidated?.kind, "TRIPLE_TOP");
  assert.equal(invalidated?.status, "INVALIDATED");
  assert.equal(invalidated?.entry, null);
});

test("triple bottom qualifies only after a neckline close and invalidates below the trough buffer", () => {
  assert.equal(detectLatestPattern(makeTripleBottomCandles(105))?.status, "WAITING FOR BREAKOUT");
  const qualified = detectLatestPattern(makeTripleBottomCandles(111));
  assert.equal(qualified?.kind, "TRIPLE_BOTTOM");
  assert.equal(qualified?.status, "QUALIFIED");
  assert.equal(qualified?.entry, 110);
  const invalidated = detectLatestPattern(makeTripleBottomCandles(95));
  assert.equal(invalidated?.kind, "TRIPLE_BOTTOM");
  assert.equal(invalidated?.status, "INVALIDATED");
  assert.equal(invalidated?.entry, null);
});

test("head-and-shoulders qualifies below neckline and invalidates above head buffer", () => {
  assert.equal(detectLatestPattern(makeHeadShouldersCandles(false, 105))?.status, "WAITING FOR BREAKOUT");
  const qualified = detectLatestPattern(makeHeadShouldersCandles(false, 99));
  assert.equal(qualified?.kind, "HEAD_AND_SHOULDERS");
  assert.equal(qualified?.status, "QUALIFIED");
  const invalidated = detectLatestPattern(makeHeadShouldersCandles(false, 117));
  assert.equal(invalidated?.kind, "HEAD_AND_SHOULDERS");
  assert.equal(invalidated?.status, "INVALIDATED");
  assert.equal(invalidated?.entry, null);
});

test("inverse head-and-shoulders qualifies above neckline and invalidates below head buffer", () => {
  assert.equal(detectLatestPattern(makeHeadShouldersCandles(true, 105))?.status, "WAITING FOR BREAKOUT");
  const qualified = detectLatestPattern(makeHeadShouldersCandles(true, 112));
  assert.equal(qualified?.kind, "INVERSE_HEAD_AND_SHOULDERS");
  assert.equal(qualified?.status, "QUALIFIED");
  const invalidated = detectLatestPattern(makeHeadShouldersCandles(true, 94));
  assert.equal(invalidated?.kind, "INVERSE_HEAD_AND_SHOULDERS");
  assert.equal(invalidated?.status, "INVALIDATED");
  assert.equal(invalidated?.entry, null);
});

test("rejects triple-top and triple-bottom near misses outside the similarity tolerance", () => {
  const topNearMiss = makeTripleTopCandles();
  topNearMiss[24] = { ...topNearMiss[24], high: 112, close: 107 };
  assert.notEqual(detectLatestPattern(topNearMiss)?.kind, "TRIPLE_TOP");

  const bottomNearMiss = makeTripleBottomCandles();
  bottomNearMiss[24] = { ...bottomNearMiss[24], low: 98, close: 103 };
  assert.notEqual(detectLatestPattern(bottomNearMiss)?.kind, "TRIPLE_BOTTOM");
});

test("rejects head-and-shoulders near misses when the head does not clear the required margin", () => {
  const nearMiss = makeHeadShouldersCandles();
  nearMiss[22] = { ...nearMiss[22], high: 111.5, close: 107 };
  assert.notEqual(detectLatestPattern(nearMiss)?.kind, "HEAD_AND_SHOULDERS");
  const inverseNearMiss = makeHeadShouldersCandles(true);
  inverseNearMiss[22] = { ...inverseNearMiss[22], low: 98.5, close: 103 };
  assert.notEqual(detectLatestPattern(inverseNearMiss)?.kind, "INVERSE_HEAD_AND_SHOULDERS");
});

test("never confirms a head-and-shoulders pivot without its three right-side candles", () => {
  const candles = makeHeadShouldersCandles().slice(0, 39);
  const beforeRightBars = detectLatestPattern(candles.slice(0, 39));
  const afterRightBars = detectLatestPattern(candles);
  assert.notEqual(beforeRightBars?.kind, "HEAD_AND_SHOULDERS");
  assert.equal(afterRightBars?.kind, "HEAD_AND_SHOULDERS");
});
