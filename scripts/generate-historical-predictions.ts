import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { detectLatestPattern } from "../src/lib/patterns";
import type { Candle, SymbolPair, Timeframe } from "../src/lib/types";

type Packet = {
  sample_id: string;
  symbol: SymbolPair;
  timeframe: Timeframe;
  start_time: number;
  end_time: number;
  candles: Candle[];
};

const DATA_DIR = join(process.cwd(), "datasets", "historical-v1");
const PACKET_FILE = join(DATA_DIR, "blind-packets.jsonl");
const OUTPUT_FILE = join(DATA_DIR, "predictions-v1.jsonl");
const MANIFEST_FILE = join(DATA_DIR, "prediction-manifest-v1.json");
const RULE_VERSION = "pattern-detector-main-phase3-v1";
const VALID_SYMBOLS = new Set<SymbolPair>(["BTCUSDT", "ETHUSDT", "SOLUSDT"]);
const INTERVAL_SECONDS: Record<Timeframe, number> = {
  "15m": 900, "1h": 3600, "4h": 14400, "1d": 86400,
};

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function parsePacket(line: string, lineNumber: number): Packet {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    throw new Error(`Invalid JSON in blind packet line ${lineNumber}`);
  }
  if (typeof value !== "object" || value === null) {
    throw new Error(`Invalid packet on line ${lineNumber}`);
  }
  const packet = value as Partial<Packet>;
  if (typeof packet.sample_id !== "string" || !packet.sample_id ||
      typeof packet.symbol !== "string" || !VALID_SYMBOLS.has(packet.symbol as SymbolPair) ||
      !["15m", "1h", "4h", "1d"].includes(String(packet.timeframe)) ||
      !Array.isArray(packet.candles) || packet.candles.length < 40) {
    throw new Error(`Missing or invalid packet fields on line ${lineNumber}`);
  }
  const timeframe = packet.timeframe as Timeframe;
  const candles = packet.candles as Candle[];
  if (packet.start_time !== candles[0].time ||
      packet.end_time !== candles[candles.length - 1].time) {
    throw new Error(`Packet boundaries do not match candle timestamps on line ${lineNumber}`);
  }
  for (let i = 0; i < candles.length; i += 1) {
    const c = candles[i];
    if (!c || ![c.time, c.open, c.high, c.low, c.close, c.volume].every(Number.isFinite) ||
        c.time <= 0 || c.open <= 0 || c.low <= 0 || c.volume < 0 ||
        c.high < Math.max(c.open, c.close, c.low) || c.low > Math.min(c.open, c.close) ||
        (i > 0 && c.time - candles[i - 1].time !== INTERVAL_SECONDS[timeframe])) {
      throw new Error(`Invalid candle sequence in packet line ${lineNumber} at index ${i}`);
    }
  }
  return packet as Packet;
}

function assignChronologicalSplits(packets: Packet[]): Map<string, "train" | "validation" | "test"> {
  const groups = new Map<string, Packet[]>();
  for (const packet of packets) {
    const key = `${packet.symbol}:${packet.timeframe}`;
    const group = groups.get(key) ?? [];
    group.push(packet);
    groups.set(key, group);
  }
  const result = new Map<string, "train" | "validation" | "test">();
  for (const group of groups.values()) {
    group.sort((a, b) => a.end_time - b.end_time);
    const ids = new Set<string>();
    for (const packet of group) {
      if (ids.has(packet.sample_id)) throw new Error(`Duplicate packet ID: ${packet.sample_id}`);
      ids.add(packet.sample_id);
    }
    const trainEnd = Math.max(1, Math.floor(group.length * 0.6));
    const validationEnd = Math.max(trainEnd, Math.floor(group.length * 0.8));
    group.forEach((packet, index) => {
      result.set(packet.sample_id, index < trainEnd ? "train" : index < validationEnd ? "validation" : "test");
    });
  }
  return result;
}

async function main(): Promise<void> {
  const packetText = await readFile(PACKET_FILE, "utf8");
  const lines = packetText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) throw new Error("Blind packet file is empty");
  const packets = lines.map((line, index) => parsePacket(line, index + 1));
  const packetIds = new Set<string>();
  for (const packet of packets) {
    if (packetIds.has(packet.sample_id)) throw new Error(`Duplicate packet ID: ${packet.sample_id}`);
    packetIds.add(packet.sample_id);
  }

  const splits = assignChronologicalSplits(packets);
  const predictions = packets.map((packet) => {
    // Detector input is exactly this packet's closed candles; no later rows are loaded.
    const detected = detectLatestPattern(packet.candles);
    return {
      sample_id: packet.sample_id,
      symbol: packet.symbol,
      timeframe: packet.timeframe,
      start_time: packet.start_time,
      end_time: packet.end_time,
      split: splits.get(packet.sample_id),
      rule_version: RULE_VERSION,
      input_candle_count: packet.candles.length,
      detector_output: detected ? {
        pattern: detected.kind,
        status: detected.status,
        first_pivot_time: detected.firstPivotTime,
        second_pivot_time: detected.secondPivotTime,
        third_pivot_time: detected.thirdPivotTime ?? null,
      } : null,
    };
  });
  const outputText = predictions.map((prediction) => JSON.stringify(prediction)).join("\n") + "\n";
  const metadata = {
    artifact_version: "1.0.0",
    status: "FROZEN_PREDICTIONS_REFERENCE_LABELS_REQUIRED",
    generated_at_utc: new Date().toISOString(),
    rule_version: RULE_VERSION,
    input_file: "blind-packets.jsonl",
    input_sha256: sha256(packetText),
    prediction_file: "predictions-v1.jsonl",
    prediction_sha256: sha256(outputText),
    packet_count: predictions.length,
    split_counts: {
      train: predictions.filter((item) => item.split === "train").length,
      validation: predictions.filter((item) => item.split === "validation").length,
      test: predictions.filter((item) => item.split === "test").length,
    },
    split_policy: "Chronological within each symbol/timeframe: earliest 60% train, next through 80% validation, latest remainder test; floor boundaries, minimum one train packet.",
    lookahead_policy: "Each detector invocation receives only the closed candles in its packet; no future packets or candles are passed to the detector.",
    labels_included: false,
    performance_metrics_included: false,
    limitations: [
      "This artifact freezes predictions, not ground-truth labels.",
      "Detector predictions must not be used to create or adjudicate reference labels.",
      "Small packet counts per series are a pilot and do not establish representative historical performance.",
    ],
  };
  await writeFile(OUTPUT_FILE, outputText, "utf8");
  await writeFile(MANIFEST_FILE, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(metadata, null, 2));
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown prediction generation failure";
  console.error(`Prediction generation failed: ${message}`);
  process.exitCode = 1;
});
