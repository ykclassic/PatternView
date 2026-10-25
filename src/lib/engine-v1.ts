import type { Candle } from "@/lib/types";

export const PATTERN_ENGINE_VERSION = "pattern-engine-v1.0.0";

export type PivotKind = "HIGH" | "LOW";
export type PatternKindV1 =
  | "DOUBLE_TOP"
  | "DOUBLE_BOTTOM"
  | "ASCENDING_TRIANGLE"
  | "DESCENDING_TRIANGLE"
  | "SYMMETRICAL_TRIANGLE";
export type PatternState = "FORMING" | "WAITING_FOR_BREAKOUT" | "CONFIRMED" | "INVALIDATED" | "NO_TRADE";

export interface EngineConfig {
  version: string;
  leftBars: number;
  rightBars: number;
  atrPeriod: number;
  minPivotSeparation: number;
  maxFormationBars: number;
  levelToleranceAtr: number;
  minProminenceAtr: number;
  horizontalBoundaryAtr: number;
  minQualityScore: number;
}

export const DEFAULT_ENGINE_CONFIG: Readonly<EngineConfig> = Object.freeze({
  version: PATTERN_ENGINE_VERSION,
  leftBars: 3,
  rightBars: 3,
  atrPeriod: 14,
  minPivotSeparation: 8,
  maxFormationBars: 100,
  levelToleranceAtr: 1.25,
  minProminenceAtr: 1.5,
  horizontalBoundaryAtr: 0.75,
  minQualityScore: 55,
});

export interface Pivot {
  kind: PivotKind;
  index: number;
  time: number;
  price: number;
  atrAtPivot: number;
  confirmed: boolean;
  confirmedAtIndex: number | null;
  confirmedAtTime: number | null;
}

export interface PatternExplanation {
  code: string;
  detail: string;
  passed: boolean;
  measuredValue?: number;
  threshold?: number;
}

export interface PatternDetectionV1 {
  algorithmVersion: string;
  kind: PatternKindV1;
  state: PatternState;
  bias: "BULLISH" | "BEARISH" | "NEUTRAL";
  detectedAtTime: number;
  firstPivotTime: number;
  lastPivotTime: number;
  pivots: Pivot[];
  boundary: { upper: number; lower: number };
  breakoutLevel: number | null;
  invalidationLevel: number | null;
  qualityScore: number;
  isProbability: false;
  explanation: PatternExplanation[];
  warnings: string[];
}

function validateCandles(candles: Candle[]): void {
  let previousTime = -Infinity;
  for (const [index, candle] of candles.entries()) {
    if (![candle.time, candle.open, candle.high, candle.low, candle.close, candle.volume].every(Number.isFinite)) {
      throw new Error(`Candle ${index} contains a non-finite value`);
    }
    if (candle.time <= previousTime) throw new Error(`Candle ${index} is not in strictly increasing time order`);
    if (candle.open <= 0 || candle.low <= 0 || candle.volume < 0 ||
        candle.high < Math.max(candle.open, candle.close, candle.low) ||
        candle.low > Math.min(candle.open, candle.close)) {
      throw new Error(`Candle ${index} has invalid OHLCV values`);
    }
    previousTime = candle.time;
  }
}

function validateConfig(config: EngineConfig): void {
  const positiveIntegers: Array<keyof EngineConfig> = [
    "leftBars", "rightBars", "atrPeriod", "minPivotSeparation", "maxFormationBars",
  ];
  for (const key of positiveIntegers) {
    if (!Number.isInteger(config[key]) || Number(config[key]) < 1) {
      throw new Error(`Engine config ${key} must be a positive integer`);
    }
  }
  for (const key of ["levelToleranceAtr", "minProminenceAtr", "horizontalBoundaryAtr"] as const) {
    if (!Number.isFinite(config[key]) || config[key] <= 0) {
      throw new Error(`Engine config ${key} must be finite and positive`);
    }
  }
  if (!Number.isFinite(config.minQualityScore) || config.minQualityScore < 0 || config.minQualityScore > 100) {
    throw new Error("Engine config minQualityScore must be between 0 and 100");
  }
  if (!config.version.trim()) throw new Error("Engine config version is required");
}

function trueRanges(candles: Candle[]): number[] {
  return candles.map((candle, index) => {
    if (index === 0) return candle.high - candle.low;
    const previousClose = candles[index - 1].close;
    return Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - previousClose),
      Math.abs(candle.low - previousClose),
    );
  });
}

function atrAt(ranges: number[], index: number, period: number): number {
  const start = Math.max(0, index - period + 1);
  const sample = ranges.slice(start, index + 1);
  return sample.reduce((sum, value) => sum + value, 0) / sample.length;
}

/**
 * Causal pivot detection. A pivot at index i is only confirmed when rightBars
 * subsequent candles are present. confirmedAtTime is the time the confirmation
 * became knowable, not the earlier pivot candle time.
 */
export function detectPivots(
  candles: Candle[],
  config: EngineConfig = { ...DEFAULT_ENGINE_CONFIG },
): Pivot[] {
  validateConfig(config);
  validateCandles(candles);
  if (candles.length < config.leftBars + 1) return [];
  const ranges = trueRanges(candles);
  const pivots: Pivot[] = [];

  for (let index = config.leftBars; index < candles.length; index += 1) {
    const candle = candles[index];
    const leftStart = Math.max(0, index - config.leftBars);
    const left = candles.slice(leftStart, index);
    const rightEnd = Math.min(candles.length - 1, index + config.rightBars);
    const right = candles.slice(index + 1, rightEnd + 1);
    const hasFullRightWindow = index + config.rightBars < candles.length;
    const highIsExtreme = left.every((item) => candle.high >= item.high) &&
      right.every((item) => candle.high >= item.high) &&
      (left.some((item) => candle.high > item.high) || right.some((item) => candle.high > item.high));
    const lowIsExtreme = left.every((item) => candle.low <= item.low) &&
      right.every((item) => candle.low <= item.low) &&
      (left.some((item) => candle.low < item.low) || right.some((item) => candle.low < item.low));

    for (const [kind, isExtreme, price] of [
      ["HIGH", highIsExtreme, candle.high],
      ["LOW", lowIsExtreme, candle.low],
    ] as const) {
      if (!isExtreme) continue;
      pivots.push({
        kind,
        index,
        time: candle.time,
        price,
        atrAtPivot: atrAt(ranges, index, config.atrPeriod),
        confirmed: hasFullRightWindow,
        confirmedAtIndex: hasFullRightWindow ? index + config.rightBars : null,
        confirmedAtTime: hasFullRightWindow ? candles[index + config.rightBars].time : null,
      });
    }
  }
  return pivots.sort((a, b) => a.index - b.index || a.kind.localeCompare(b.kind));
}

function scoreSimilarity(a: Pivot, b: Pivot): number {
  const scale = Math.max((a.atrAtPivot + b.atrAtPivot) / 2, Number.EPSILON);
  return Math.max(0, 100 * (1 - Math.abs(a.price - b.price) / scale / 2));
}

function candidateExplanation(code: string, detail: string, passed: boolean, measuredValue?: number, threshold?: number): PatternExplanation {
  return { code, detail, passed, ...(measuredValue === undefined ? {} : { measuredValue }), ...(threshold === undefined ? {} : { threshold }) };
}

function makeDoublePattern(
  kind: "DOUBLE_TOP" | "DOUBLE_BOTTOM",
  first: Pivot,
  second: Pivot,
  reaction: Pivot,
  candles: Candle[],
  config: EngineConfig,
): PatternDetectionV1 | null {
  const separation = second.index - first.index;
  if (separation < config.minPivotSeparation || separation > config.maxFormationBars) return null;
  const atr = Math.max((first.atrAtPivot + second.atrAtPivot) / 2, Number.EPSILON);
  const prominence = kind === "DOUBLE_TOP"
    ? Math.min(first.price, second.price) - reaction.price
    : reaction.price - Math.max(first.price, second.price);
  const prominenceAtr = prominence / atr;
  const levelDifferenceAtr = Math.abs(first.price - second.price) / atr;
  const passesProminence = prominenceAtr >= config.minProminenceAtr;
  const passesLevel = levelDifferenceAtr <= config.levelToleranceAtr;
  const neckline = reaction.price;
  const lastClose = candles[candles.length - 1].close;
  const bearish = kind === "DOUBLE_TOP";
  const confirmedBreakout = bearish ? lastClose < neckline : lastClose > neckline;
  const invalidation = bearish
    ? Math.max(first.price, second.price) + atr * 0.25
    : Math.min(first.price, second.price) - atr * 0.25;
  const invalidated = bearish ? lastClose > invalidation : lastClose < invalidation;
  const qualityScore = Math.round(Math.max(0, Math.min(100,
    scoreSimilarity(first, second) * 0.4 +
    Math.min(100, prominenceAtr / (config.minProminenceAtr * 2) * 100) * 0.35 +
    Math.min(100, separation / config.maxFormationBars * 100) * 0.1 +
    (confirmedBreakout ? 100 : 45) * 0.15,
  )));
  const explanations = [
    candidateExplanation("PIVOT_LEVEL_SIMILARITY", "The two outer pivots must be within the configured ATR-normalized price tolerance.", passesLevel, levelDifferenceAtr, config.levelToleranceAtr),
    candidateExplanation("STRUCTURAL_PROMINENCE", "The intervening reaction must separate the two outer pivots by sufficient ATR-normalized distance.", passesProminence, prominenceAtr, config.minProminenceAtr),
    candidateExplanation("PIVOT_SEPARATION", "The two outer pivots must be sufficiently separated in candle count.", true, separation, config.minPivotSeparation),
    candidateExplanation("BREAKOUT", confirmedBreakout ? "The latest supplied close crossed the neckline." : "The latest supplied close has not crossed the neckline.", confirmedBreakout),
  ];
  if (!passesLevel || !passesProminence || qualityScore < config.minQualityScore) return null;
  return {
    algorithmVersion: config.version,
    kind,
    state: invalidated ? "INVALIDATED" : confirmedBreakout ? "CONFIRMED" : "WAITING_FOR_BREAKOUT",
    bias: bearish ? "BEARISH" : "BULLISH",
    detectedAtTime: candles[candles.length - 1].time,
    firstPivotTime: first.time,
    lastPivotTime: second.time,
    pivots: [first, reaction, second],
    boundary: { upper: Math.max(first.price, second.price), lower: Math.min(first.price, second.price) },
    breakoutLevel: neckline,
    invalidationLevel: invalidation,
    qualityScore,
    isProbability: false,
    explanation: explanations,
    warnings: ["Quality score is a heuristic ranking, not a calibrated probability or profitability estimate."],
  };
}

function slope(points: Pivot[]): number {
  if (points.length < 2) return 0;
  const first = points[0];
  const last = points[points.length - 1];
  return (last.price - first.price) / Math.max(1, last.index - first.index);
}

function makeTriangle(
  highs: Pivot[],
  lows: Pivot[],
  candles: Candle[],
  config: EngineConfig,
): PatternDetectionV1 | null {
  if (highs.length < 2 || lows.length < 2) return null;
  const upperSlope = slope(highs);
  const lowerSlope = slope(lows);
  const formationPivots = [highs[0], highs[highs.length - 1], lows[0], lows[lows.length - 1]];
  const span = Math.max(...formationPivots.map((pivot) => pivot.index)) - Math.min(...formationPivots.map((pivot) => pivot.index));
  if (span > config.maxFormationBars || span < config.minPivotSeparation) return null;
  const atr = Math.max(...formationPivots.map((pivot) => pivot.atrAtPivot), Number.EPSILON);
  const upperChangeAtr = upperSlope * span / atr;
  const lowerChangeAtr = lowerSlope * span / atr;
  const upperHorizontal = Math.abs(upperChangeAtr) <= config.horizontalBoundaryAtr;
  const lowerHorizontal = Math.abs(lowerChangeAtr) <= config.horizontalBoundaryAtr;
  const upperFalling = upperChangeAtr < -config.horizontalBoundaryAtr;
  const lowerRising = lowerChangeAtr > config.horizontalBoundaryAtr;
  let kind: PatternKindV1 | null = null;
  let bias: PatternDetectionV1["bias"] = "NEUTRAL";
  if (upperHorizontal && lowerRising) { kind = "ASCENDING_TRIANGLE"; bias = "BULLISH"; }
  else if (lowerHorizontal && upperFalling) { kind = "DESCENDING_TRIANGLE"; bias = "BEARISH"; }
  else if (upperFalling && lowerRising) { kind = "SYMMETRICAL_TRIANGLE"; bias = "NEUTRAL"; }
  if (!kind) return null;

  const upper = (highs[0].price + highs[highs.length - 1].price) / 2;
  const lower = (lows[0].price + lows[lows.length - 1].price) / 2;
  if (upper <= lower) return null;
  const lastClose = candles[candles.length - 1].close;
  const breakout = lastClose > upper ? "UP" : lastClose < lower ? "DOWN" : null;
  const state: PatternState = breakout ? "CONFIRMED" : "WAITING_FOR_BREAKOUT";
  const score = Math.round(Math.max(0, Math.min(100,
    35 + Math.min(25, Math.abs(upperChangeAtr - lowerChangeAtr) * 5) +
    Math.min(20, formationPivots.length * 5) +
    Math.min(20, span / config.maxFormationBars * 20),
  )));
  const allPivots = [...highs, ...lows].sort((a, b) => a.index - b.index);
  return {
    algorithmVersion: config.version,
    kind,
    state,
    bias: kind === "SYMMETRICAL_TRIANGLE" && !breakout ? "NEUTRAL" : breakout === "UP" ? "BULLISH" : breakout === "DOWN" ? "BEARISH" : bias,
    detectedAtTime: candles[candles.length - 1].time,
    firstPivotTime: allPivots[0].time,
    lastPivotTime: allPivots[allPivots.length - 1].time,
    pivots: allPivots,
    boundary: { upper, lower },
    breakoutLevel: breakout === "UP" ? upper : breakout === "DOWN" ? lower : null,
    invalidationLevel: null,
    qualityScore: score,
    isProbability: false,
    explanation: [
      candidateExplanation("UPPER_BOUNDARY", "Upper boundary trend and slope measured from confirmed swing highs.", upperHorizontal ? "Boundary is horizontal." : "Boundary is converging.", upperChangeAtr, config.horizontalBoundaryAtr),
      candidateExplanation("LOWER_BOUNDARY", "Lower boundary trend and slope measured from confirmed swing lows.", lowerHorizontal ? "Boundary is horizontal." : "Boundary is converging.", lowerChangeAtr, config.horizontalBoundaryAtr),
      candidateExplanation("BREAKOUT", breakout ? `Last close is outside the ${breakout === "UP" ? "upper" : "lower"} boundary.` : "No close outside the boundaries; direction remains unconfirmed.", Boolean(breakout)),
    ],
    warnings: ["Triangle boundaries are a first-pass linear approximation; validate against independent historical labels before production use.", "Quality score is not a probability."],
  };
}

/**
 * Returns candidates using only candles supplied by the caller. For historical
 * replay, call once per as-of candle (or supply a truncated candle prefix);
 * never pass later candles when evaluating an earlier decision.
 */
export function detectPatternsV1(
  candles: Candle[],
  overrides: Partial<EngineConfig> = {},
): PatternDetectionV1[] {
  const config = { ...DEFAULT_ENGINE_CONFIG, ...overrides };
  validateConfig(config);
  validateCandles(candles);
  if (candles.length < config.leftBars + config.rightBars + 2) return [];
  const pivots = detectPivots(candles, config).filter((pivot) => pivot.confirmed);
  const results: PatternDetectionV1[] = [];
  for (let i = 0; i < pivots.length; i += 1) {
    for (let j = i + 2; j < pivots.length; j += 1) {
      const first = pivots[i];
      const second = pivots[j];
      if (second.index - first.index > config.maxFormationBars) break;
      if (first.kind !== second.kind || second.index - first.index < config.minPivotSeparation) continue;
      const intervening = pivots.filter((pivot) => pivot.index > first.index && pivot.index < second.index && pivot.kind !== first.kind);
      if (!intervening.length) continue;
      const reaction = first.kind === "HIGH"
        ? intervening.reduce((best, item) => item.price < best.price ? item : best)
        : intervening.reduce((best, item) => item.price > best.price ? item : best);
      const pattern = makeDoublePattern(first.kind === "HIGH" ? "DOUBLE_TOP" : "DOUBLE_BOTTOM", first, second, reaction, candles, config);
      if (pattern) results.push(pattern);
    }
  }

  const highs = pivots.filter((pivot) => pivot.kind === "HIGH").slice(-4);
  const lows = pivots.filter((pivot) => pivot.kind === "LOW").slice(-4);
  const triangle = makeTriangle(highs, lows, candles, config);
  if (triangle) results.push(triangle);

  const unique = new Map<string, PatternDetectionV1>();
  for (const pattern of results) {
    const key = `${pattern.kind}:${pattern.firstPivotTime}:${pattern.lastPivotTime}`;
    const existing = unique.get(key);
    if (!existing || pattern.qualityScore > existing.qualityScore) unique.set(key, pattern);
  }
  return [...unique.values()].sort((a, b) =>
    b.qualityScore - a.qualityScore || b.lastPivotTime - a.lastPivotTime || a.kind.localeCompare(b.kind),
  );
}
