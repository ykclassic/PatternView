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

function makeHeadShouldersCandles(inverse = false): Candle[] {
  return Array.from({ length: 70 }, (_, index): Candle => {
    const candle: Candle = { time: 1_700_000_000 + index * 3600, open: 105, high: 106, low: 104, close: 105, volume: 1000 };
    const levels = inverse
      ? [{ i: 8, low: 100 }, { i: 15, high: 110 }, { i: 22, low: 95 }, { i: 29, high: 111 }, { i: 36, low: 100.5 }]
      : [{ i: 8, high: 110 }, { i: 15, low: 100 }, { i: 22, high: 115 }, { i: 29, low: 101 }, { i: 36, high: 110.5 }];
    for (const level of levels) if (index === level.i) Object.assign(candle, level);
    if (index === 69) Object.assign(candle, { close: 105, high: 106, low: 104 });
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
