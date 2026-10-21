import type { Candle, DetectedPattern } from "@/lib/types";

type Pivot = { index: number; price: number; time: number; kind: "high" | "low" };

const RELATIVE_TOLERANCE = 0.012;
const MIN_PEAK_SEPARATION = 8;
const MAX_PEAK_SEPARATION = 100;
const PIVOT_RADIUS = 3;

function findPivots(candles: Candle[]): Pivot[] {
  const pivots: Pivot[] = [];
  for (let i = PIVOT_RADIUS; i < candles.length - PIVOT_RADIUS; i += 1) {
    const current = candles[i];
    const window = candles.slice(i - PIVOT_RADIUS, i + PIVOT_RADIUS + 1);
    if (window.every((c) => current.high >= c.high) &&
        window.some((c, offset) => offset !== PIVOT_RADIUS && current.high > c.high)) {
      pivots.push({ index: i, price: current.high, time: current.time, kind: "high" });
    }
    if (window.every((c) => current.low <= c.low) &&
        window.some((c, offset) => offset !== PIVOT_RADIUS && current.low < c.low)) {
      pivots.push({ index: i, price: current.low, time: current.time, kind: "low" });
    }
  }
  return pivots.sort((a, b) => a.index - b.index);
}

/**
 * Deterministic starter detector. A pivot is only considered after three bars
 * have closed on its right. This is intentionally conservative and not a
 * profitability claim or a statistical probability estimate.
 */
export function detectLatestPattern(candles: Candle[]): DetectedPattern | null {
  if (candles.length < 40) return null;
  const pivots = findPivots(candles);
  const lastClose = candles[candles.length - 1].close;
  let candidate: DetectedPattern | null = null;
  let candidateIndex = -1;

  for (let i = 0; i < pivots.length; i += 1) {
    const first = pivots[i];
    if (first.kind !== "high") continue;
    for (let j = i + 1; j < pivots.length; j += 1) {
      const second = pivots[j];
      if (second.kind !== "high") continue;
      const separation = second.index - first.index;
      if (separation < MIN_PEAK_SEPARATION) continue;
      if (separation > MAX_PEAK_SEPARATION) break;
      const tolerance = Math.abs(first.price - second.price) / ((first.price + second.price) / 2);
      if (tolerance > RELATIVE_TOLERANCE) continue;
      const valley = pivots.find((p) => p.kind === "low" && p.index > first.index && p.index < second.index);
      if (!valley) continue;

      const invalidation = Math.max(first.price, second.price) * 1.003;
      const broken = lastClose < valley.price;
      const invalid = lastClose > invalidation;
      const target = valley.price - (Math.max(first.price, second.price) - valley.price);
      const item: DetectedPattern = {
        kind: "DOUBLE_TOP",
        status: invalid ? "INVALIDATED" : broken ? "QUALIFIED" : "WAITING FOR BREAKOUT",
        firstPivotTime: first.time,
        secondPivotTime: second.time,
        neckline: valley.price,
        breakoutLevel: valley.price,
        invalidation,
        entry: broken ? valley.price : null,
        stopLoss: broken ? invalidation : null,
        takeProfit: broken && target > 0 ? target : null,
        explanation: [
          `Two confirmed swing highs differ by ${(tolerance * 100).toFixed(2)}%, within the 1.20% starter tolerance.`,
          "The neckline is the lowest confirmed swing low between the two highs.",
          broken ? "The latest closed candle is below the neckline." : "A close below the neckline is required; no breakout is assumed.",
          "Pivots require three closed candles on their right, so the pattern is not backdated before confirmation.",
        ],
      };
      if (second.index > candidateIndex) {
        candidate = item;
        candidateIndex = second.index;
      }
    }
  }

  for (let i = 0; i < pivots.length; i += 1) {
    const first = pivots[i];
    if (first.kind !== "low") continue;
    for (let j = i + 1; j < pivots.length; j += 1) {
      const second = pivots[j];
      if (second.kind !== "low") continue;
      const separation = second.index - first.index;
      if (separation < MIN_PEAK_SEPARATION) continue;
      if (separation > MAX_PEAK_SEPARATION) break;
      const tolerance = Math.abs(first.price - second.price) / ((first.price + second.price) / 2);
      if (tolerance > RELATIVE_TOLERANCE) continue;
      const peak = pivots.find((p) => p.kind === "high" && p.index > first.index && p.index < second.index);
      if (!peak) continue;

      const invalidation = Math.min(first.price, second.price) * 0.997;
      const broken = lastClose > peak.price;
      const invalid = lastClose < invalidation;
      const target = peak.price + (peak.price - Math.min(first.price, second.price));
      const item: DetectedPattern = {
        kind: "DOUBLE_BOTTOM",
        status: invalid ? "INVALIDATED" : broken ? "QUALIFIED" : "WAITING FOR BREAKOUT",
        firstPivotTime: first.time,
        secondPivotTime: second.time,
        neckline: peak.price,
        breakoutLevel: peak.price,
        invalidation,
        entry: broken ? peak.price : null,
        stopLoss: broken ? invalidation : null,
        takeProfit: broken ? target : null,
        explanation: [
          `Two confirmed swing lows differ by ${(tolerance * 100).toFixed(2)}%, within the 1.20% starter tolerance.`,
          "The neckline is the highest confirmed swing high between the two lows.",
          broken ? "The latest closed candle is above the neckline." : "A close above the neckline is required; no breakout is assumed.",
          "Pivots require three closed candles on their right, so the pattern is not backdated before confirmation.",
        ],
      };
      if (second.index > candidateIndex) {
        candidate = item;
        candidateIndex = second.index;
      }
    }
  }
  return candidate;
}
