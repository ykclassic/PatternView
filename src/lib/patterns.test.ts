import test from "node:test";
import assert from "node:assert/strict";
import { detectLatestPattern } from "./patterns";
import type { Candle } from "./types";

function makeCandles(lastClose = 105): Candle[] {
  return Array.from({ length: 60 }, (_, index) => {
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
    if (index === 59) Object.assign(candle, { close: lastClose, low: Math.min(104, lastClose - 1) });
    return candle;
  });
}

test("returns no pattern when there are too few closed candles", () => {
  assert.equal(detectLatestPattern(makeCandles().slice(0, 20)), null);
});

test("detects a double top and waits for a neckline close", () => {
  const pattern = detectLatestPattern(makeCandles(105));
  assert.equal(pattern?.kind, "DOUBLE_TOP");
  assert.equal(pattern?.status, "WAITING FOR BREAKOUT");
  assert.equal(pattern?.neckline, 100);
  assert.equal(pattern?.entry, null);
});

test("qualifies a double top only after a closed candle breaks the neckline", () => {
  const pattern = detectLatestPattern(makeCandles(99));
  assert.equal(pattern?.kind, "DOUBLE_TOP");
  assert.equal(pattern?.status, "QUALIFIED");
  assert.equal(pattern?.entry, 100);
  assert.ok(pattern?.stopLoss !== null && pattern.stopLoss !== undefined);
  assert.ok(pattern?.takeProfit !== null && pattern.takeProfit !== undefined);
});
