import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const projectRoot = process.cwd();
const require = createRequire(join(projectRoot, "package.json"));
const tsxEntry = require.resolve("tsx");
const scriptPath = join(projectRoot, "scripts", "generate-historical-predictions.ts");
const intervalSeconds = { "15m": 900, "1h": 3600, "4h": 14400, "1d": 86400 } as const;
type Timeframe = keyof typeof intervalSeconds;
type SymbolPair = "BTCUSDT" | "ETHUSDT" | "SOLUSDT";

function makePacket(sampleId: string, timeframe: Timeframe, startTime: number, symbol: SymbolPair = "BTCUSDT") {
  const interval = intervalSeconds[timeframe];
  const candles = Array.from({ length: 40 }, (_, index) => {
    const price = 100 + (index % 3);
    return {
      time: startTime + index * interval,
      open: price,
      high: price + 1,
      low: price - 1,
      close: price,
      volume: 10,
    };
  });
  return {
    sample_id: sampleId,
    symbol,
    timeframe,
    start_time: candles[0].time,
    end_time: candles[candles.length - 1].time,
    candles,
  };
}

async function makeFixture(packetRows: unknown[]) {
  const directory = await mkdtemp(join(tmpdir(), "patternview-phase3-"));
  const dataDirectory = join(directory, "datasets", "historical-v1");
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(
    join(dataDirectory, "blind-packets.jsonl"),
    packetRows.map((row) => JSON.stringify(row)).join("\n") + "\n",
    "utf8",
  );
  return { directory, dataDirectory };
}

function runGenerator(directory: string) {
  return spawnSync(process.execPath, ["--import", tsxEntry, scriptPath], {
    cwd: directory,
    encoding: "utf8",
    timeout: 30_000,
  });
}

test("freezes one prediction per packet with deterministic chronological splits and digests", async () => {
  const interval = intervalSeconds["1h"];
  const packets = Array.from({ length: 5 }, (_, index) =>
    makePacket(`sample-${index}`, "1h", 1_700_000_000 + index * 40 * interval),
  );
  const fixture = await makeFixture(packets);
  try {
    const first = runGenerator(fixture.directory);
    assert.equal(first.status, 0, first.stderr || first.stdout);
    const predictionsPath = join(fixture.dataDirectory, "predictions-v1.jsonl");
    const manifestPath = join(fixture.dataDirectory, "prediction-manifest-v1.json");
    const firstPredictions = await readFile(predictionsPath, "utf8");
    const firstManifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      packet_count: number;
      input_sha256: string;
      prediction_sha256: string;
      split_counts: Record<string, number>;
      labels_included: boolean;
      performance_metrics_included: boolean;
    };
    const predictions = firstPredictions.trim().split("\n").map((line) => JSON.parse(line)) as Array<{
      sample_id: string;
      split: string;
      start_time: number;
      end_time: number;
      input_candle_count: number;
      detector_output: { first_pivot_time?: number | null; second_pivot_time?: number | null; third_pivot_time?: number | null } | null;
    }>;

    assert.equal(predictions.length, packets.length);
    assert.equal(firstManifest.packet_count, packets.length);
    assert.deepEqual(firstManifest.split_counts, { train: 3, validation: 1, test: 1 });
    assert.equal(firstManifest.labels_included, false);
    assert.equal(firstManifest.performance_metrics_included, false);
    assert.equal(predictions[0].split, "train");
    assert.equal(predictions[1].split, "train");
    assert.equal(predictions[2].split, "train");
    assert.equal(predictions[3].split, "validation");
    assert.equal(predictions[4].split, "test");
    for (let index = 0; index < predictions.length; index += 1) {
      const prediction = predictions[index];
      assert.equal(prediction.sample_id, packets[index].sample_id);
      assert.equal(prediction.input_candle_count, packets[index].candles.length);
      assert.equal(prediction.start_time, packets[index].start_time);
      assert.equal(prediction.end_time, packets[index].end_time);
      if (prediction.detector_output) {
        for (const pivotTime of [
          prediction.detector_output.first_pivot_time,
          prediction.detector_output.second_pivot_time,
          prediction.detector_output.third_pivot_time,
        ]) {
          if (pivotTime != null) assert.ok(pivotTime <= prediction.end_time);
        }
      }
    }

    const second = runGenerator(fixture.directory);
    assert.equal(second.status, 0, second.stderr || second.stdout);
    const secondPredictions = await readFile(predictionsPath, "utf8");
    const secondManifest = JSON.parse(await readFile(manifestPath, "utf8")) as typeof firstManifest;
    assert.equal(secondPredictions, firstPredictions);
    assert.equal(secondManifest.input_sha256, firstManifest.input_sha256);
    assert.equal(secondManifest.prediction_sha256, firstManifest.prediction_sha256);
  } finally {
    await rm(fixture.directory, { recursive: true, force: true });
  }
});

test("rejects duplicate packet IDs and does not emit prediction artifacts", async () => {
  const packet = makePacket("duplicate", "1h", 1_700_000_000);
  const fixture = await makeFixture([packet, { ...packet, start_time: packet.start_time + 40 * 3600, end_time: packet.end_time + 40 * 3600 }]);
  try {
    const result = runGenerator(fixture.directory);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Duplicate packet ID/);
  } finally {
    await rm(fixture.directory, { recursive: true, force: true });
  }
});

test("rejects invalid candle spacing before freezing predictions", async () => {
  const packet = makePacket("bad-spacing", "1h", 1_700_000_000);
  packet.candles[10].time += 1;
  const fixture = await makeFixture([packet]);
  try {
    const result = runGenerator(fixture.directory);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Invalid candle sequence/);
  } finally {
    await rm(fixture.directory, { recursive: true, force: true });
  }
});

test("rejects an empty blind packet file", async () => {
  const fixture = await makeFixture([]);
  try {
    await writeFile(join(fixture.dataDirectory, "blind-packets.jsonl"), "", "utf8");
    const result = runGenerator(fixture.directory);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Blind packet file is empty/);
  } finally {
    await rm(fixture.directory, { recursive: true, force: true });
  }
});
