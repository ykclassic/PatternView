import test from "node:test";
import assert from "node:assert/strict";
import { evaluateLabeledObservations } from "./evaluation";

const observations = [
  { id: "1", pair: "BTCUSDT", timeframe: "1h", candleEndTime: 1_700_000_000, expectedPattern: "DOJI" as const, detectedPattern: "DOJI" as const },
  { id: "2", pair: "BTCUSDT", timeframe: "1h", candleEndTime: 1_700_003_600, expectedPattern: "DOJI" as const, detectedPattern: null },
  { id: "3", pair: "ETHUSDT", timeframe: "4h", candleEndTime: 1_700_014_400, expectedPattern: null, detectedPattern: "DOJI" as const },
  { id: "4", pair: "SOLUSDT", timeframe: "1d", candleEndTime: 1_700_100_000, expectedPattern: null, detectedPattern: null },
];

test("computes per-pattern confusion counts and metrics from frozen labels", () => {
  const report = evaluateLabeledObservations(observations, {
    ruleVersion: "candles-v2",
    datasetVersion: "review-set-001",
    patterns: ["DOJI"],
  });
  assert.equal(report.observationCount, 4);
  assert.equal(report.exactMatchCount, 2);
  assert.equal(report.mismatchCount, 2);
  assert.deepEqual(report.perPattern[0], {
    pattern: "DOJI",
    truePositive: 1,
    falsePositive: 1,
    falseNegative: 1,
    trueNegative: 1,
    precision: 0.5,
    recall: 0.5,
    falsePositiveRate: 0.5,
    sampleCount: 4,
  });
});

test("returns null rather than misleading metrics when a denominator is zero", () => {
  const report = evaluateLabeledObservations([], {
    ruleVersion: "candles-v2",
    datasetVersion: "empty-set",
    patterns: ["DOJI"],
  });
  assert.equal(report.perPattern[0].precision, null);
  assert.equal(report.perPattern[0].recall, null);
  assert.equal(report.perPattern[0].falsePositiveRate, null);
});

test("rejects duplicate observation IDs and missing provenance versions", () => {
  assert.throws(() => evaluateLabeledObservations([observations[0], observations[0]], {
    ruleVersion: "v1", datasetVersion: "d1", patterns: ["DOJI"],
  }), /unique/);
  assert.throws(() => evaluateLabeledObservations([], {
    ruleVersion: "", datasetVersion: "d1", patterns: ["DOJI"],
  }), /required/);
});
