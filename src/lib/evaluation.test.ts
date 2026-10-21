import test from "node:test";
import assert from "node:assert/strict";
import { evaluateLabeledObservations, type LabeledObservation } from "./evaluation";

const digest = "a".repeat(64);
const observations: LabeledObservation[] = [
  { id: "1", pair: "BTCUSDT", timeframe: "1h", candleEndTime: 1_700_000_000, split: "test" as const, expectedPattern: "DOJI" as const, detectedPattern: "DOJI" as const },
  { id: "2", pair: "BTCUSDT", timeframe: "1h", candleEndTime: 1_700_003_600, split: "test" as const, expectedPattern: "DOJI" as const, detectedPattern: null },
  { id: "3", pair: "ETHUSDT", timeframe: "4h", candleEndTime: 1_700_014_400, split: "test" as const, expectedPattern: null, detectedPattern: "DOJI" as const },
  { id: "4", pair: "SOLUSDT", timeframe: "1d", candleEndTime: 1_700_100_000, split: "test" as const, expectedPattern: null, detectedPattern: null },
];
const options = {
  ruleVersion: "candles-v2",
  datasetVersion: "review-set-001",
  predictionArtifactSha256: digest,
  split: "test" as const,
  patterns: ["DOJI"] as const,
};

test("computes per-pattern confusion counts, support and metrics", () => {
  const report = evaluateLabeledObservations(observations, { ...options, patterns: ["DOJI"] });
  assert.equal(report.observationCount, 4);
  assert.equal(report.exactMatchCount, 2);
  assert.equal(report.mismatchCount, 2);
  assert.equal(report.predictionArtifactSha256, digest);
  assert.equal(report.split, "test");
  assert.deepEqual(report.perPattern[0], {
    pattern: "DOJI", truePositive: 1, falsePositive: 1, falseNegative: 1, trueNegative: 1,
    precision: 0.5, recall: 0.5, falsePositiveRate: 0.5, sampleCount: 4,
    actualPositiveCount: 2, predictedPositiveCount: 2,
  });
});

test("rejects empty evaluation datasets", () => {
  assert.throws(() => evaluateLabeledObservations([], { ...options, patterns: ["DOJI"] }), /at least one observation/);
});

test("returns null when metric denominators are zero", () => {
  const noPositive = [
    { id: "only", pair: "BTCUSDT" as const, timeframe: "1h" as const, candleEndTime: 1_700_000_000, split: "test" as const, expectedPattern: null, detectedPattern: null },
  ];
  const report = evaluateLabeledObservations(noPositive, { ...options, patterns: ["DOJI"] });
  assert.equal(report.perPattern[0].precision, null);
  assert.equal(report.perPattern[0].recall, null);
  assert.equal(report.perPattern[0].falsePositiveRate, 0);
});

test("rejects duplicate observation IDs, duplicate pattern definitions and missing provenance", () => {
  assert.throws(() => evaluateLabeledObservations([observations[0], observations[0]], { ...options, patterns: ["DOJI"] }), /unique/);
  assert.throws(() => evaluateLabeledObservations(observations, { ...options, patterns: ["DOJI", "DOJI"] }), /Duplicate pattern/);
  assert.throws(() => evaluateLabeledObservations(observations, { ...options, ruleVersion: "", patterns: ["DOJI"] }), /required/);
  assert.throws(() => evaluateLabeledObservations(observations, { ...options, predictionArtifactSha256: "not-a-digest", patterns: ["DOJI"] }), /SHA-256/);
});

test("validates runtime labels, pair/timeframe and explicit split membership", () => {
  const invalidLabel = [{ ...observations[0], expectedPattern: "MADE_UP" }] as unknown as typeof observations;
  assert.throws(() => evaluateLabeledObservations(invalidLabel, { ...options, patterns: ["DOJI"] }), /Invalid expected or detected/);
  const wrongSplit = observations.map((item, index) => index === 0 ? { ...item, split: "train" as const } : item);
  assert.throws(() => evaluateLabeledObservations(wrongSplit, { ...options, patterns: ["DOJI"] }), /does not belong/);
  const badPair = observations.map((item, index) => index === 0 ? { ...item, pair: "DOGEUSDT" as "BTCUSDT" } : item);
  assert.throws(() => evaluateLabeledObservations(badPair, { ...options, patterns: ["DOJI"] }), /Invalid pair or timeframe/);
});
