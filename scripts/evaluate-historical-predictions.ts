import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { evaluateLabeledObservations, type LabeledObservation } from "../src/lib/evaluation";
import type { PatternKind, SymbolPair, Timeframe } from "../src/lib/types";

type Split = "train" | "validation" | "test";
type Disposition = "LABELED" | "AMBIGUOUS" | "UNREVIEWED";
type Prediction = {
  sample_id: string;
  symbol: SymbolPair;
  timeframe: Timeframe;
  end_time: number;
  split: Split;
  detector_output: { pattern: PatternKind } | null;
};
type ReferenceLabel = {
  sample_id: string;
  symbol: SymbolPair;
  timeframe: Timeframe;
  end_time: number;
  split: Split;
  expected_pattern: PatternKind | null;
  disposition: Disposition;
  annotator_id: string;
  reviewer_id: string;
  adjudicated: boolean;
  reviewed_at_utc: string;
  notes?: string;
};
const DATA_DIR = join(process.cwd(), "datasets", "historical-v1");
const PREDICTIONS_FILE = join(DATA_DIR, "predictions-v1.jsonl");
const PREDICTION_MANIFEST_FILE = join(DATA_DIR, "prediction-manifest-v1.json");
const LABELS_FILE = join(DATA_DIR, "reference-labels-v1.jsonl");
const DATASET_MANIFEST_FILE = join(DATA_DIR, "prepared-manifest.json");
const REPORT_FILE = join(DATA_DIR, "evaluation-report-v1.json");
const SPLITS: Split[] = ["train", "validation", "test"];
const PATTERNS: PatternKind[] = [
  "DOUBLE_TOP", "DOUBLE_BOTTOM", "TRIPLE_TOP", "TRIPLE_BOTTOM",
  "HEAD_AND_SHOULDERS", "INVERSE_HEAD_AND_SHOULDERS", "DOJI", "HAMMER",
  "SHOOTING_STAR", "BULLISH_ENGULFING", "BEARISH_ENGULFING", "MORNING_STAR",
  "EVENING_STAR", "THREE_WHITE_SOLDIERS", "THREE_BLACK_CROWS",
];
const VALID_PATTERNS = new Set<PatternKind>(PATTERNS);
const VALID_PAIRS = new Set<SymbolPair>(["BTCUSDT", "ETHUSDT", "SOLUSDT"]);
const VALID_TIMEFRAMES = new Set<Timeframe>(["15m", "1h", "4h", "1d"]);
const VALID_SPLITS = new Set<Split>(SPLITS);
const VALID_DISPOSITIONS = new Set<Disposition>(["LABELED", "AMBIGUOUS", "UNREVIEWED"]);

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
function readJsonl<T>(value: string, description: string): T[] {
  const lines = value.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) throw new Error(`${description} is empty`);
  return lines.map((line, index) => {
    try { return JSON.parse(line) as T; }
    catch { throw new Error(`Invalid JSON in ${description} line ${index + 1}`); }
  });
}
function validIsoTimestamp(value: string): boolean {
  return typeof value === "string" && value.length > 0 && Number.isFinite(Date.parse(value)) && value.endsWith("Z");
}

async function main(): Promise<void> {
  const predictionText = await readFile(PREDICTIONS_FILE, "utf8");
  const predictionManifest = JSON.parse(await readFile(PREDICTION_MANIFEST_FILE, "utf8")) as {
    rule_version: string;
    prediction_sha256: string;
    input_sha256: string;
    packet_count: number;
    labels_included: boolean;
    performance_metrics_included: boolean;
  };
  if (sha256(predictionText) !== predictionManifest.prediction_sha256) {
    throw new Error("Frozen prediction SHA-256 does not match its manifest");
  }
  if (predictionManifest.labels_included !== false || predictionManifest.performance_metrics_included !== false) {
    throw new Error("Prediction manifest must not contain labels or performance metrics");
  }
  const datasetManifest = JSON.parse(await readFile(DATASET_MANIFEST_FILE, "utf8")) as { dataset_version: string };
  const predictions = readJsonl<Prediction>(predictionText, "frozen predictions");
  if (predictions.length !== predictionManifest.packet_count) throw new Error("Prediction count does not match manifest");
  const predictionById = new Map<string, Prediction>();
  for (const prediction of predictions) {
    if (!prediction.sample_id || predictionById.has(prediction.sample_id) ||
        !VALID_PAIRS.has(prediction.symbol) || !VALID_TIMEFRAMES.has(prediction.timeframe) ||
        !VALID_SPLITS.has(prediction.split) || !Number.isSafeInteger(prediction.end_time) ||
        (prediction.detector_output !== null && !VALID_PATTERNS.has(prediction.detector_output.pattern))) {
      throw new Error("Frozen predictions contain invalid or duplicate sample metadata");
    }
    predictionById.set(prediction.sample_id, prediction);
  }

  const labelText = await readFile(LABELS_FILE, "utf8");
  const labels = readJsonl<ReferenceLabel>(labelText, "reference labels");
  const labelById = new Map<string, ReferenceLabel>();
  for (const label of labels) {
    if (!label.sample_id || labelById.has(label.sample_id) ||
        !VALID_PAIRS.has(label.symbol) || !VALID_TIMEFRAMES.has(label.timeframe) ||
        !VALID_SPLITS.has(label.split) || !Number.isSafeInteger(label.end_time) ||
        !VALID_DISPOSITIONS.has(label.disposition) ||
        (label.expected_pattern !== null && !VALID_PATTERNS.has(label.expected_pattern))) {
      throw new Error("Reference labels contain invalid or duplicate sample metadata");
    }
    const prediction = predictionById.get(label.sample_id);
    if (!prediction || prediction.symbol !== label.symbol || prediction.timeframe !== label.timeframe ||
        prediction.end_time !== label.end_time || prediction.split !== label.split) {
      throw new Error(`Reference label does not match frozen packet metadata: ${label.sample_id}`);
    }
    if (label.disposition === "UNREVIEWED") throw new Error(`Unreviewed sample cannot be evaluated: ${label.sample_id}`);
    if (!label.annotator_id.trim() || !validIsoTimestamp(label.reviewed_at_utc)) {
      throw new Error(`Missing annotator or UTC review timestamp: ${label.sample_id}`);
    }
    if (label.disposition === "AMBIGUOUS" && label.expected_pattern !== null) {
      throw new Error(`Ambiguous labels must not specify a pattern: ${label.sample_id}`);
    }
    if (label.split === "test" && (!label.reviewer_id.trim() || label.adjudicated !== true)) {
      throw new Error(`Test sample must be independently reviewed and adjudicated: ${label.sample_id}`);
    }
    labelById.set(label.sample_id, label);
  }
  if (labelById.size !== predictionById.size) {
    throw new Error(`Reference-label count (${labelById.size}) must match prediction count (${predictionById.size})`);
  }
  for (const id of predictionById.keys()) if (!labelById.has(id)) throw new Error(`Missing reference label: ${id}`);

  const reports = SPLITS.map((split) => {
    const splitLabels = labels.filter((label) => label.split === split);
    const ambiguousCount = splitLabels.filter((label) => label.disposition === "AMBIGUOUS").length;
    const scorable = splitLabels.filter((label) => label.disposition === "LABELED");
    if (scorable.length === 0) return { split, totalLabeled: splitLabels.length, scorableCount: 0, ambiguousCount, metrics: null };
    const observations: LabeledObservation[] = scorable.map((label) => {
      const prediction = predictionById.get(label.sample_id)!;
      return {
        id: label.sample_id,
        pair: label.symbol,
        timeframe: label.timeframe,
        candleEndTime: label.end_time,
        split,
        expectedPattern: label.expected_pattern,
        detectedPattern: prediction.detector_output?.pattern ?? null,
      };
    }).sort((a, b) => a.pair.localeCompare(b.pair) || a.timeframe.localeCompare(b.timeframe) || a.candleEndTime - b.candleEndTime);
    return {
      split,
      totalLabeled: splitLabels.length,
      scorableCount: scorable.length,
      ambiguousCount,
      metrics: evaluateLabeledObservations(observations, {
        ruleVersion: predictionManifest.rule_version,
        datasetVersion: datasetManifest.dataset_version,
        predictionArtifactSha256: predictionManifest.prediction_sha256,
        split,
        patterns: PATTERNS,
      }),
    };
  });
  const report = {
    report_version: "1.0.0",
    status: "DESCRIPTIVE_METRICS_NOT_AUTOMATIC_RELEASE_APPROVAL",
    generated_at_utc: new Date().toISOString(),
    dataset_version: datasetManifest.dataset_version,
    rule_version: predictionManifest.rule_version,
    prediction_artifact_sha256: predictionManifest.prediction_sha256,
    reference_label_sha256: sha256(labelText),
    observation_count: predictions.length,
    unique_annotators: [...new Set(labels.map((label) => label.annotator_id))].sort(),
    test_rows_independently_reviewed: labels.filter((label) => label.split === "test").every((label) => Boolean(label.reviewer_id.trim()) && label.adjudicated === true),
    split_reports: reports,
    limitations: [
      "Metrics are valid only to the extent that reference labels are independent and follow the versioned annotation protocol.",
      "Ambiguous observations are excluded from confusion-matrix denominators and reported separately.",
      "The 72-packet pilot is too small for broad performance claims without additional historical coverage and per-pattern support.",
      "Classification metrics do not establish profitability or live-trading suitability.",
    ],
  };
  await writeFile(REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ report_file: "evaluation-report-v1.json", status: report.status, observation_count: report.observation_count, split_reports: report.split_reports.map(({ split, scorableCount, ambiguousCount }) => ({ split, scorableCount, ambiguousCount })), reference_label_sha256: report.reference_label_sha256 }, null, 2));
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown historical evaluation failure";
  console.error(`Historical evaluation failed: ${message}`);
  process.exitCode = 1;
});
