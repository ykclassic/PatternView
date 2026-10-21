import type { Candle, DetectedPattern } from "@/lib/types";

type Pivot = { index: number; price: number; time: number; kind: "high" | "low" };

const RELATIVE_TOLERANCE = 0.012;
const MIN_PIVOT_SEPARATION = 8;
const MAX_PIVOT_SEPARATION = 100;
const PIVOT_RADIUS = 3;
const INVALIDATION_BUFFER = 0.003;

function findPivots(candles: Candle[]): Pivot[] {
  const pivots: Pivot[] = [];
  for (let i = PIVOT_RADIUS; i < candles.length - PIVOT_RADIUS; i += 1) {
    const current = candles[i];
    const window = candles.slice(i - PIVOT_RADIUS, i + PIVOT_RADIUS + 1);
    if (
      window.every((c) => current.high >= c.high) &&
      window.some((c, offset) => offset !== PIVOT_RADIUS && current.high > c.high)
    ) {
      pivots.push({ index: i, price: current.high, time: current.time, kind: "high" });
    }
    if (
      window.every((c) => current.low <= c.low) &&
      window.some((c, offset) => offset !== PIVOT_RADIUS && current.low < c.low)
    ) {
      pivots.push({ index: i, price: current.low, time: current.time, kind: "low" });
    }
  }
  return pivots.sort((a, b) => a.index - b.index || a.kind.localeCompare(b.kind));
}

function relativeDifference(a: number, b: number): number {
  const midpoint = (a + b) / 2;
  return midpoint === 0 ? Number.POSITIVE_INFINITY : Math.abs(a - b) / Math.abs(midpoint);
}

/**
 * Deterministic starter detector. A pivot is only considered after three bars
 * have closed on its right. It uses only the supplied closed-candle sequence.
 * This is a heuristic, not a profitability claim or a probability estimate.
 */
export function detectLatestPattern(candles: Candle[]): DetectedPattern | null {
  if (candles.length < 40) return null;
  if (
    candles.some((c) =>
      ![c.time, c.open, c.high, c.low, c.close, c.volume].every(Number.isFinite) ||
      c.high < Math.max(c.open, c.close, c.low) ||
      c.low > Math.min(c.open, c.close, c.high)
    )
  ) return null;

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
      if (separation < MIN_PIVOT_SEPARATION) continue;
      if (separation > MAX_PIVOT_SEPARATION) break;

      const tolerance = relativeDifference(first.price, second.price);
      if (tolerance > RELATIVE_TOLERANCE) continue;
      const valleys = pivots.filter(
        (p) => p.kind === "low" && p.index > first.index && p.index < second.index,
      );
      if (valleys.length === 0) continue;
      const valley = valleys.reduce((lowest, p) => p.price < lowest.price ? p : lowest);
      const peak = Math.max(first.price, second.price);
      const invalidation = peak * (1 + INVALIDATION_BUFFER);
      const broken = lastClose < valley.price;
      const invalid = lastClose > invalidation;
      const target = valley.price - (peak - valley.price);

      const item: DetectedPattern = {
        kind: "DOUBLE_TOP",
        status: invalid ? "INVALIDATED" : broken ? "QUALIFIED" : "WAITING FOR BREAKOUT",
        firstPivotTime: first.time,
        secondPivotTime: second.time,
        neckline: valley.price,
        invalidation,
        breakoutLevel: valley.price,
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
      if (separation < MIN_PIVOT_SEPARATION) continue;
      if (separation > MAX_PIVOT_SEPARATION) break;

      const tolerance = relativeDifference(first.price, second.price);
      if (tolerance > RELATIVE_TOLERANCE) continue;
      const peaks = pivots.filter(
        (p) => p.kind === "high" && p.index > first.index && p.index < second.index,
      );
      if (peaks.length === 0) continue;
      const peak = peaks.reduce((highest, p) => p.price > highest.price ? p : highest);
      const trough = Math.min(first.price, second.price);
      const invalidation = trough * (1 - INVALIDATION_BUFFER);
      const broken = lastClose > peak.price;
      const invalid = lastClose < invalidation;
      const target = peak.price + (peak.price - trough);

      const item: DetectedPattern = {
        kind: "DOUBLE_BOTTOM",
        status: invalid ? "INVALIDATED" : broken ? "QUALIFIED" : "WAITING FOR BREAKOUT",
        firstPivotTime: first.time,
        secondPivotTime: second.time,
        neckline: peak.price,
        invalidation,
        breakoutLevel: peak.price,
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
