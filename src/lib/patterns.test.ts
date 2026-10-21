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
