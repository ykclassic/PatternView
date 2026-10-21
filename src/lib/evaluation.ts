import type { PatternKind } from "@/lib/types";

export interface LabeledObservation {
  id: string;
  pair: string;
  timeframe: string;
  candleEndTime: number;
  expectedPattern: PatternKind | null;
  detectedPattern: PatternKind | null;
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
}

export interface EvaluationReport {
  ruleVersion: string;
  datasetVersion: string;
  observationCount: number;
  exactMatchCount: number;
  mismatchCount: number;
  perPattern: PatternMetrics[];
}

/**
 * Scores a frozen detector output against human labels. This function does not
 * run the detector or infer missing labels; callers must provide a complete,
 * versioned dataset and frozen predictions.
 */
export function evaluateLabeledObservations(
  observations: LabeledObservation[],
  options: { ruleVersion: string; datasetVersion: string; patterns: PatternKind[] },
): EvaluationReport {
  if (!options.ruleVersion.trim() || !options.datasetVersion.trim()) {
    throw new Error("ruleVersion and datasetVersion are required");
  }
  const seen = new Set<string>();
  for (const item of observations) {
    if (!item.id.trim() || seen.has(item.id)) throw new Error("Observation IDs must be non-empty and unique");
    seen.add(item.id);
    if (!Number.isFinite(item.candleEndTime) || item.candleEndTime <= 0) {
      throw new Error(`Invalid candleEndTime for observation ${item.id}`);
    }
    if (!item.pair.trim() || !item.timeframe.trim()) {
      throw new Error(`Pair and timeframe are required for observation ${item.id}`);
    }
  }

  const perPattern = options.patterns.map((pattern): PatternMetrics => {
    let truePositive = 0;
    let falsePositive = 0;
    let falseNegative = 0;
    let trueNegative = 0;
    for (const item of observations) {
      const expected = item.expectedPattern === pattern;
      const detected = item.detectedPattern === pattern;
      if (expected && detected) truePositive += 1;
      else if (!expected && detected) falsePositive += 1;
      else if (expected && !detected) falseNegative += 1;
      else trueNegative += 1;
    }
    const positivePredictions = truePositive + falsePositive;
    const actualPositives = truePositive + falseNegative;
    const actualNegatives = falsePositive + trueNegative;
    return {
      pattern,
      truePositive,
      falsePositive,
      falseNegative,
      trueNegative,
      precision: positivePredictions === 0 ? null : truePositive / positivePredictions,
      recall: actualPositives === 0 ? null : truePositive / actualPositives,
      falsePositiveRate: actualNegatives === 0 ? null : falsePositive / actualNegatives,
      sampleCount: observations.length,
    };
  });

  const exactMatchCount = observations.filter((item) => item.expectedPattern === item.detectedPattern).length;
  return {
    ruleVersion: options.ruleVersion,
    datasetVersion: options.datasetVersion,
    observationCount: observations.length,
    exactMatchCount,
    mismatchCount: observations.length - exactMatchCount,
    perPattern,
  };
}
