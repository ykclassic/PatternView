import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const projectRoot = process.cwd();
const require = createRequire(join(projectRoot, "package.json"));
const tsxEntry = require.resolve("tsx");
const templateScript = join(projectRoot, "scripts", "create-label-template.ts");
const evaluationScript = join(projectRoot, "scripts", "evaluate-historical-predictions.ts");
const digest = (value: string) => createHash("sha256").update(value).digest("hex");

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "patternview-evaluation-"));
  const data = join(root, "datasets", "historical-v1");
  await mkdir(data, { recursive: true });
  const predictions = [
    { sample_id: "train-1", symbol: "BTCUSDT", timeframe: "1h", start_time: 1_699_996_400, end_time: 1_700_000_000, split: "train", detector_output: { pattern: "DOUBLE_TOP" } },
    { sample_id: "validation-1", symbol: "BTCUSDT", timeframe: "1h", start_time: 1_700_000_000, end_time: 1_700_003_600, split: "validation", detector_output: null },
    { sample_id: "test-1", symbol: "BTCUSDT", timeframe: "1h", start_time: 1_700_003_600, end_time: 1_700_007_200, split: "test", detector_output: { pattern: "DOUBLE_BOTTOM" } },
  ];
  const predictionText = predictions.map((row) => JSON.stringify(row)).join("\n") + "\n";
  const blindPacketsText = predictions.map(({ sample_id, symbol, timeframe, start_time, end_time }) =>
    JSON.stringify({ sample_id, symbol, timeframe, start_time, end_time, candles: [] })).join("\n") + "\n";
  await writeFile(join(data, "blind-packets.jsonl"), blindPacketsText, "utf8");
  await writeFile(join(data, "predictions-v1.jsonl"), predictionText, "utf8");
  await writeFile(join(data, "prediction-manifest-v1.json"), JSON.stringify({
    rule_version: "pattern-detector-test-v1",
    prediction_sha256: digest(predictionText),
    input_sha256: digest(blindPacketsText),
    packet_count: predictions.length,
    labels_included: false,
    performance_metrics_included: false,
  }), "utf8");
  await writeFile(join(data, "prepared-manifest.json"), JSON.stringify({ dataset_version: "test-dataset-v1" }), "utf8");
  return { root, data, predictions };
}

function run(script: string, cwd: string) {
  return spawnSync(process.execPath, ["--import", tsxEntry, script], {
    cwd, encoding: "utf8", timeout: 30_000,
  });
}

async function generateTemplate(f: Awaited<ReturnType<typeof fixture>>) {
  const result = run(templateScript, f.root);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const text = await readFile(join(f.data, "reference-labels-v1.jsonl"), "utf8");
  return text.trim().split("\n").map((line) => JSON.parse(line)) as Array<Record<string, unknown>>;
}

test("creates a blinded label template without detector outputs and refuses to overwrite it", async () => {
  const f = await fixture();
  try {
    const labels = await generateTemplate(f);
    assert.equal(labels.length, 3);
    assert.ok(labels.every((label) => label.disposition === "UNREVIEWED"));
    assert.ok(labels.every((label) => !("detector_output" in label)));
    const secondRun = run(templateScript, f.root);
    assert.notEqual(secondRun.status, 0);
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test("scores only reviewed labels and requires independent adjudication for test rows", async () => {
  const f = await fixture();
  try {
    const labels = await generateTemplate(f);
    const reviewed = labels.map((label) => ({
      ...label,
      expected_pattern: label.sample_id === "test-1" ? "DOUBLE_BOTTOM" : null,
      disposition: "LABELED",
      annotator_id: "annotator-a",
      reviewer_id: label.split === "test" ? "reviewer-b" : "",
      adjudicated: label.split === "test",
      reviewed_at_utc: "2026-10-24T20:00:00.000Z",
    }));
    await writeFile(join(f.data, "reference-labels-v1.jsonl"), reviewed.map((row) => JSON.stringify(row)).join("\n") + "\n", "utf8");
    const result = run(evaluationScript, f.root);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const report = JSON.parse(await readFile(join(f.data, "evaluation-report-v1.json"), "utf8"));
    assert.equal(report.observation_count, 3);
    assert.equal(report.test_rows_independently_reviewed, true);
    assert.equal(report.split_reports.length, 3);
    const testReport = report.split_reports.find((row: { split: string }) => row.split === "test");
    assert.equal(testReport.metrics.observationCount, 1);
    const doubleBottom = testReport.metrics.perPattern.find((row: { pattern: string }) => row.pattern === "DOUBLE_BOTTOM");
    assert.equal(doubleBottom.truePositive, 1);
    assert.equal(doubleBottom.precision, 1);
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});


test("rejects blind packet bytes that do not match the frozen input digest", async () => {
  const f = await fixture();
  try {
    await generateTemplate(f);
    const packetText = await readFile(join(f.data, "blind-packets.jsonl"), "utf8");
    await writeFile(join(f.data, "blind-packets.jsonl"), packetText.replace('"candles":[]', '"candles": []'), "utf8");
    const result = run(evaluationScript, f.root);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Blind packet SHA-256 does not match/);
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test("refuses unreviewed labels and test rows without independent adjudication", async () => {
  const f = await fixture();
  try {
    const labels = await generateTemplate(f);
    const unreviewed = run(evaluationScript, f.root);
    assert.notEqual(unreviewed.status, 0);
    assert.match(unreviewed.stderr, /Unreviewed sample cannot be evaluated/);

    const reviewed = labels.map((label) => ({
      ...label,
      expected_pattern: null,
      disposition: "LABELED",
      annotator_id: "annotator-a",
      reviewer_id: "",
      adjudicated: false,
      reviewed_at_utc: "2026-10-24T20:00:00.000Z",
    }));
    await writeFile(join(f.data, "reference-labels-v1.jsonl"), reviewed.map((row) => JSON.stringify(row)).join("\n") + "\n", "utf8");
    const missingReview = run(evaluationScript, f.root);
    assert.notEqual(missingReview.status, 0);
    assert.match(missingReview.stderr, /independently reviewed and adjudicated/);
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});
