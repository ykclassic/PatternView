import type { PatternKind, SymbolPair, Timeframe } from "@/lib/types";

export type EvaluationSplit = "train" | "validation" | "test";
export type EvaluationLabel = PatternKind | null;

export interface LabeledObservation {
  id: string;
  pair: SymbolPair;
  timeframe: Timeframe;
  candleEndTime: number;
  split: EvaluationSplit;
  expectedPattern: EvaluationLabel;
  detectedPattern: EvaluationLabel;
}

export interface PatternMetrics {
  pattern: PatternKind;
  truePositive: number;
  falsePositive: number;
  falseNegative: number;
  trueNegative: number;
  precision: number | null;
  recall: number | null;
  falsePositiveRate: number | null;
  sampleCount: number;
  actualPositiveCount: number;
  predictedPositiveCount: number;
}

export interface EvaluationReport {
  ruleVersion: string;
  datasetVersion: string;
  predictionArtifactSha256: string;
  split: EvaluationSplit;
  observationCount: number;
  exactMatchCount: number;
  mismatchCount: number;
  perPattern: PatternMetrics[];
}

const VALID_PATTERNS = new Set<PatternKind>(["DOUBLE_TOP","DOUBLE_BOTTOM","TRIPLE_TOP","TRIPLE_BOTTOM","HEAD_AND_SHOULDERS","INVERSE_HEAD_AND_SHOULDERS","DOJI","HAMMER","SHOOTING_STAR","BULLISH_ENGULFING","BEARISH_ENGULFING","MORNING_STAR","EVENING_STAR","THREE_WHITE_SOLDIERS","THREE_BLACK_CROWS"]);
const VALID_PAIRS = new Set<SymbolPair>(["BTCUSDT", "ETHUSDT", "SOLUSDT"]);
const VALID_TIMEFRAMES = new Set<Timeframe>(["15m", "1h", "4h", "1d"]);
const VALID_SPLITS = new Set<EvaluationSplit>(["train", "validation", "test"]);

function isPattern(value: unknown): value is PatternKind {
  return typeof value === "string" && VALID_PATTERNS.has(value as PatternKind);
}
function isNullablePattern(value: unknown): value is EvaluationLabel {
  return value === null || isPattern(value);
}

/**
 * Scores already-frozen detector outputs against independently reviewed labels.
 * This function intentionally does not run the detector or infer labels.
 */
export function evaluateLabeledObservations(
  observations: LabeledObservation[],
  options: {
    ruleVersion: string;
    datasetVersion: string;
    predictionArtifactSha256: string;
    split: EvaluationSplit;
    patterns: PatternKind[];
  },
): EvaluationReport {
  if (!options.ruleVersion.trim() || !options.datasetVersion.trim()) {
    throw new Error("ruleVersion and datasetVersion are required");
  }
  if (!/^[a-f0-9]{64}$/i.test(options.predictionArtifactSha256)) {
    throw new Error("predictionArtifactSha256 must be a 64-character SHA-256 digest");
  }
  if (!VALID_SPLITS.has(options.split)) throw new Error("Invalid evaluation split");
  if (!Array.isArray(observations) || observations.length === 0) {
    throw new Error("Evaluation dataset must contain at least one observation");
  }
  if (!Array.isArray(options.patterns) || options.patterns.length === 0) {
    throw new Error("At least one pattern definition is required");
  }
  const patternSet = new Set<PatternKind>();
  for (const pattern of options.patterns as unknown[]) {
    if (!isPattern(pattern)) throw new Error(`Invalid pattern definition: ${String(pattern)}`);
    if (patternSet.has(pattern)) throw new Error(`Duplicate pattern definition: ${pattern}`);
    patternSet.add(pattern);
  }

  const seen = new Set<string>();
  const seenTimeBySeries = new Map<string, number>();
  for (const raw of observations as unknown[]) {
    if (typeof raw !== "object" || raw === null) throw new Error("Invalid observation");
    const item = raw as Partial<LabeledObservation>;
    if (typeof item.id !== "string" || !item.id.trim() || seen.has(item.id)) {
      throw new Error("Observation IDs must be non-empty and unique");
    }
    seen.add(item.id);
    if (typeof item.pair !== "string" || !VALID_PAIRS.has(item.pair as SymbolPair) ||
        typeof item.timeframe !== "string" || !VALID_TIMEFRAMES.has(item.timeframe as Timeframe)) {
      throw new Error(`Invalid pair or timeframe for observation ${item.id}`);
    }
    if (!Number.isSafeInteger(item.candleEndTime) || (item.candleEndTime ?? 0) <= 0) {
      throw new Error(`Invalid candleEndTime for observation ${item.id}`);
    }
    if (item.split !== options.split || !VALID_SPLITS.has(item.split as EvaluationSplit)) {
      throw new Error(`Observation ${item.id} does not belong to requested split ${options.split}`);
    }
    if (!isNullablePattern(item.expectedPattern) || !isNullablePattern(item.detectedPattern)) {
      throw new Error(`Invalid expected or detected pattern for observation ${item.id}`);
    }
    const seriesKey = `${item.pair}:${item.timeframe}`;
    const previousTime = seenTimeBySeries.get(seriesKey);
    if (previousTime !== undefined && item.candleEndTime <= previousTime) {
      throw new Error(`Observation timestamps must be strictly increasing within ${seriesKey}`);
    }
    seenTimeBySeries.set(seriesKey, item.candleEndTime);
  }

  const perPattern = options.patterns.map((pattern): PatternMetrics => {
    let truePositive = 0, falsePositive = 0, falseNegative = 0, trueNegative = 0;
    for (const item of observations) {
      const expected = item.expectedPattern === pattern;
      const detected = item.detectedPattern === pattern;
      if (expected && detected) truePositive += 1;
      else if (!expected && detected) falsePositive += 1;
      else if (expected && !detected) falseNegative += 1;
      else trueNegative += 1;
    }
    const predictedPositiveCount = truePositive + falsePositive;
    const actualPositiveCount = truePositive + falseNegative;
    const actualNegativeCount = falsePositive + trueNegative;
    return {
      pattern, truePositive, falsePositive, falseNegative, trueNegative,
      precision: predictedPositiveCount === 0 ? null : truePositive / predictedPositiveCount,
      recall: actualPositiveCount === 0 ? null : truePositive / actualPositiveCount,
      falsePositiveRate: actualNegativeCount === 0 ? null : falsePositive / actualNegativeCount,
      sampleCount: observations.length, actualPositiveCount, predictedPositiveCount,
    };
  });
  const exactMatchCount = observations.filter((item) => item.expectedPattern === item.detectedPattern).length;
  return {
    ruleVersion: options.ruleVersion,
    datasetVersion: options.datasetVersion,
    predictionArtifactSha256: options.predictionArtifactSha256,
    split: options.split,
    observationCount: observations.length,
    exactMatchCount,
    mismatchCount: observations.length - exactMatchCount,
    perPattern,
  };
}
