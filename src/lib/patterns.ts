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
function detectDoublePattern(candles: Candle[]): DetectedPattern | null {
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


function detectAdvancedPattern(candles: Candle[]): DetectedPattern | null {
  if (candles.length < 40 || candles.some((c) =>
    ![c.time, c.open, c.high, c.low, c.close, c.volume].every(Number.isFinite) ||
    c.open <= 0 || c.low <= 0 || c.volume < 0 ||
    c.high < Math.max(c.open, c.close, c.low) ||
    c.low > Math.min(c.open, c.close)
  )) return null;

  const pivots = findPivots(candles);
  const lastClose = candles[candles.length - 1].close;
  const candidates: Array<{ index: number; pattern: DetectedPattern }> = [];

  const build = (
    kind: DetectedPattern["kind"],
    points: Pivot[],
    neckline: number,
    peakOrTrough: number,
    isBearish: boolean,
    explanation: string[],
  ) => {
    const breakout = isBearish ? lastClose < neckline : lastClose > neckline;
    const invalidation = isBearish
      ? peakOrTrough * (1 + INVALIDATION_BUFFER)
      : peakOrTrough * (1 - INVALIDATION_BUFFER);
    const invalid = isBearish ? lastClose > invalidation : lastClose < invalidation;
    const target = isBearish
      ? neckline - (peakOrTrough - neckline)
      : neckline + (neckline - peakOrTrough);
    const pattern: DetectedPattern = {
      kind,
      status: invalid ? "INVALIDATED" : breakout ? "QUALIFIED" : "WAITING FOR BREAKOUT",
      firstPivotTime: points[0].time,
      secondPivotTime: points[1].time,
      thirdPivotTime: points[2]?.time,
      neckline,
      invalidation,
      breakoutLevel: neckline,
      entry: breakout ? neckline : null,
      stopLoss: breakout ? invalidation : null,
      takeProfit: breakout && target > 0 ? target : null,
      explanation: [
        ...explanation,
        breakout
          ? (isBearish ? "The latest closed candle is below the neckline." : "The latest closed candle is above the neckline.")
          : (isBearish ? "A closed candle below the neckline is required." : "A closed candle above the neckline is required."),
        "Only confirmed pivots are used; each pivot requires three closed candles on its right.",
        "Levels are conditional references, not trade instructions or a profitability estimate.",
      ],
    };
    candidates.push({ index: points[points.length - 1].index, pattern });
  };

  // Triple tops/bottoms: three similarly priced pivots with intervening structure.
  for (let i = 0; i < pivots.length; i += 1) {
    const first = pivots[i];
    for (let j = i + 1; j < pivots.length; j += 1) {
      const second = pivots[j];
      if (second.index - first.index > MAX_PIVOT_SEPARATION) break;
      if (second.kind !== first.kind || second.index - first.index < MIN_PIVOT_SEPARATION) continue;
      for (let k = j + 1; k < pivots.length; k += 1) {
        const third = pivots[k];
        if (third.index - first.index > MAX_PIVOT_SEPARATION) break;
        if (third.kind !== first.kind || third.index - second.index < MIN_PIVOT_SEPARATION) continue;
        const levelDiff = Math.max(
          relativeDifference(first.price, second.price),
          relativeDifference(second.price, third.price),
          relativeDifference(first.price, third.price),
        );
        if (levelDiff > RELATIVE_TOLERANCE) continue;
        const between = pivots.filter((p) => p.kind !== first.kind && p.index > first.index && p.index < third.index);
        if (between.length < 2) continue;
        if (first.kind === "high") {
          const neckline = Math.min(...between.map((p) => p.price));
          build("TRIPLE_TOP", [first, second, third], neckline, Math.max(first.price, second.price, third.price), true, [
            `Three confirmed swing highs are within ${(levelDiff * 100).toFixed(2)}% of one another.`,
            "The neckline is the lowest confirmed intervening swing low.",
          ]);
        } else {
          const neckline = Math.max(...between.map((p) => p.price));
          build("TRIPLE_BOTTOM", [first, second, third], neckline, Math.min(first.price, second.price, third.price), false, [
            `Three confirmed swing lows are within ${(levelDiff * 100).toFixed(2)}% of one another.`,
            "The neckline is the highest confirmed intervening swing high.",
          ]);
        }
      }
    }
  }

  // Head-and-shoulders: alternating high/low/high/low/high pivots.
  for (let i = 0; i + 4 < pivots.length; i += 1) {
    const p = pivots.slice(i, i + 5);
    if (p.map((x) => x.kind).join(",") === "high,low,high,low,high") {
      const shouldersDiff = relativeDifference(p[0].price, p[4].price);
      const headAbove = p[2].price > Math.max(p[0].price, p[4].price) * 1.02;
      if (shouldersDiff <= 0.03 && headAbove && p[4].index - p[0].index <= MAX_PIVOT_SEPARATION) {
        const neckline = (p[1].price + p[3].price) / 2;
        build("HEAD_AND_SHOULDERS", [p[0], p[2], p[4]], neckline, p[2].price, true, [
          "The middle swing high exceeds both shoulders by at least 2%.",
          `Shoulder heights differ by ${(shouldersDiff * 100).toFixed(2)}%, within the 3.00% rule.`,
          "The neckline is the average of the two confirmed intervening swing lows.",
        ]);
      }
    }
    if (p.map((x) => x.kind).join(",") === "low,high,low,high,low") {
      const shouldersDiff = relativeDifference(p[0].price, p[4].price);
      const headBelow = p[2].price < Math.min(p[0].price, p[4].price) * 0.98;
      if (shouldersDiff <= 0.03 && headBelow && p[4].index - p[0].index <= MAX_PIVOT_SEPARATION) {
        const neckline = (p[1].price + p[3].price) / 2;
        build("INVERSE_HEAD_AND_SHOULDERS", [p[0], p[2], p[4]], neckline, p[2].price, false, [
          "The middle swing low is at least 2% below both shoulders.",
          `Shoulder depths differ by ${(shouldersDiff * 100).toFixed(2)}%, within the 3.00% rule.`,
          "The neckline is the average of the two confirmed intervening swing highs.",
        ]);
      }
    }
  }

  candidates.sort((a, b) => b.index - a.index);
  return candidates[0]?.pattern ?? null;
}


function detectCandlestickPattern(candles: Candle[]): DetectedPattern | null {
  if (candles.length < 3) return null;
  const recent = candles.slice(-3);
  if (recent.some((c) =>
    ![c.time, c.open, c.high, c.low, c.close, c.volume].every(Number.isFinite) ||
    c.open <= 0 || c.low <= 0 || c.volume < 0 ||
    c.high < Math.max(c.open, c.close, c.low) ||
    c.low > Math.min(c.open, c.close)
  )) return null;

  const candle = recent[2];
  const body = Math.abs(candle.close - candle.open);
  const range = candle.high - candle.low;
  if (range <= 0) return null;
  const upper = candle.high - Math.max(candle.open, candle.close);
  const lower = Math.min(candle.open, candle.close) - candle.low;
  const bullish = (c: Candle) => c.close > c.open;
  const bearish = (c: Candle) => c.close < c.open;
  const prior = recent[1];
  const first = recent[0];
  let kind: DetectedPattern["kind"] | null = null;
  let explanation = "";

  if (lower >= body * 2 && upper <= body * 0.5 && body / range <= 0.4) {
    kind = "HAMMER";
    explanation = "The latest candle has a long lower shadow and a small body. Context and subsequent confirmation are required; location alone does not prove a reversal.";
  } else if (upper >= body * 2 && lower <= body * 0.5 && body / range <= 0.4) {
    kind = "SHOOTING_STAR";
    explanation = "The latest candle has a long upper shadow and a small body. Context and subsequent confirmation are required; location alone does not prove a reversal.";
  } else if (body / range <= 0.1 &&
    recent.slice(0, 2).some((c) => Math.abs(c.close - c.open) / Math.max(c.high - c.low, Number.EPSILON) > 0.1)) {
    kind = "DOJI";
    explanation = "The latest candle has a small real body relative to its full range after candles with directional bodies; a doji indicates indecision, not a direction by itself.";
  } else if (bullish(candle) && bearish(prior) &&
    candle.open <= prior.close && candle.close >= prior.open &&
    candle.close - candle.open > 0) {
    kind = "BULLISH_ENGULFING";
    explanation = "The latest bullish real body engulfs the prior bearish real body.";
  } else if (bearish(candle) && bullish(prior) &&
    candle.open >= prior.close && candle.close <= prior.open) {
    kind = "BEARISH_ENGULFING";
    explanation = "The latest bearish real body engulfs the prior bullish real body.";
  } else {
    const firstBody = Math.abs(first.close - first.open);
    const priorBody = Math.abs(prior.close - prior.open);
    const midpoint = (first.open + first.close) / 2;
    if (bearish(first) && firstBody / Math.max(first.high - first.low, Number.EPSILON) >= 0.5 &&
      priorBody / Math.max(prior.high - prior.low, Number.EPSILON) <= 0.3 &&
      bullish(candle) && candle.close > midpoint) {
      kind = "MORNING_STAR";
      explanation = "Three-candle heuristic: strong bearish candle, small middle body, then a bullish close above the first candle's midpoint.";
    } else if (bullish(first) && firstBody / Math.max(first.high - first.low, Number.EPSILON) >= 0.5 &&
      priorBody / Math.max(prior.high - prior.low, Number.EPSILON) <= 0.3 &&
      bearish(candle) && candle.close < midpoint) {
      kind = "EVENING_STAR";
      explanation = "Three-candle heuristic: strong bullish candle, small middle body, then a bearish close below the first candle's midpoint.";
    } else if (recent.every(bullish) &&
      recent[1].close > recent[0].close && recent[2].close > recent[1].close &&
      recent.every((c) => Math.abs(c.close - c.open) / Math.max(c.high - c.low, Number.EPSILON) >= 0.5)) {
      kind = "THREE_WHITE_SOLDIERS";
      explanation = "Three consecutive bullish candles with substantial bodies and rising closes.";
    } else if (recent.every(bearish) &&
      recent[1].close < recent[0].close && recent[2].close < recent[1].close &&
      recent.every((c) => Math.abs(c.close - c.open) / Math.max(c.high - c.low, Number.EPSILON) >= 0.5)) {
      kind = "THREE_BLACK_CROWS";
      explanation = "Three consecutive bearish candles with substantial bodies and falling closes.";
    }
  }

  if (!kind) return null;
  const bearishKind = ["SHOOTING_STAR", "BEARISH_ENGULFING", "EVENING_STAR", "THREE_BLACK_CROWS"].includes(kind);
  return {
    kind,
    status: "CONFIRMED",
    firstPivotTime: recent[kind === "MORNING_STAR" || kind === "EVENING_STAR" || kind === "THREE_WHITE_SOLDIERS" || kind === "THREE_BLACK_CROWS" ? 0 : 2].time,
    secondPivotTime: candle.time,
    neckline: candle.close,
    invalidation: bearishKind ? candle.high : candle.low,
    breakoutLevel: candle.close,
    entry: null,
    stopLoss: null,
    takeProfit: null,
    explanation: [explanation, "Candlestick formations are descriptive heuristics; trend context and later candles may confirm or negate them.", "No trade entry, stop or target is inferred from a candlestick label."],
  };
}

export function detectLatestPattern(candles: Candle[]): DetectedPattern | null {
  // Reject the whole series if any OHLC row is malformed. Validating only the
  // latest candles could otherwise let a malformed historical row pass through.
  if (candles.some((c) =>
    ![c.time, c.open, c.high, c.low, c.close, c.volume].every(Number.isFinite) ||
    c.open <= 0 || c.low <= 0 || c.volume < 0 ||
    c.high < Math.max(c.open, c.close, c.low) ||
    c.low > Math.min(c.open, c.close)
  )) return null;

  // Prefer multi-swing chart structures when one is present. Otherwise the
  // latest small-body candle in many synthetic fixtures and real markets can
  // mask a higher-level formation as a doji.
  const double = detectDoublePattern(candles);
  const advanced = detectAdvancedPattern(candles);
  const chartPattern = !double ? advanced
    : !advanced ? double
    : (advanced.thirdPivotTime ?? advanced.secondPivotTime) >= double.secondPivotTime ? advanced : double;
  if (chartPattern) return chartPattern;
  return detectCandlestickPattern(candles);
}
