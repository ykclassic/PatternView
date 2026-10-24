import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { PatternKind, SymbolPair, Timeframe } from "../src/lib/types";

type Split = "train" | "validation" | "test";
type FrozenPrediction = {
  sample_id: string;
  symbol: SymbolPair;
  timeframe: Timeframe;
  end_time: number;
  split: Split;
};

const DATA_DIR = join(process.cwd(), "datasets", "historical-v1");
const PREDICTIONS_FILE = join(DATA_DIR, "predictions-v1.jsonl");
const LABELS_FILE = join(DATA_DIR, "reference-labels-v1.jsonl");
const VALID_SPLITS = new Set<Split>(["train", "validation", "test"]);
const VALID_PAIRS = new Set<SymbolPair>(["BTCUSDT", "ETHUSDT", "SOLUSDT"]);
const VALID_TIMEFRAMES = new Set<Timeframe>(["15m", "1h", "4h", "1d"]);
const VALID_PATTERNS = new Set<PatternKind>([
  "DOUBLE_TOP", "DOUBLE_BOTTOM", "TRIPLE_TOP", "TRIPLE_BOTTOM",
  "HEAD_AND_SHOULDERS", "INVERSE_HEAD_AND_SHOULDERS", "DOJI", "HAMMER",
  "SHOOTING_STAR", "BULLISH_ENGULFING", "BEARISH_ENGULFING", "MORNING_STAR",
  "EVENING_STAR", "THREE_WHITE_SOLDIERS", "THREE_BLACK_CROWS",
]);

async function main(): Promise<void> {
  const source = await readFile(PREDICTIONS_FILE, "utf8");
  const rows = source.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (rows.length === 0) throw new Error("Frozen prediction file is empty");
  const seen = new Set<string>();
  const template = rows.map((line, index) => {
    const value = JSON.parse(line) as Partial<FrozenPrediction>;
    if (typeof value.sample_id !== "string" || !value.sample_id || seen.has(value.sample_id) ||
        typeof value.symbol !== "string" || !VALID_PAIRS.has(value.symbol as SymbolPair) ||
        typeof value.timeframe !== "string" || !VALID_TIMEFRAMES.has(value.timeframe as Timeframe) ||
        typeof value.end_time !== "number" || !Number.isSafeInteger(value.end_time) ||
        typeof value.split !== "string" || !VALID_SPLITS.has(value.split as Split)) {
      throw new Error(`Invalid or duplicate frozen prediction metadata on line ${index + 1}`);
    }
    seen.add(value.sample_id);
    return {
      sample_id: value.sample_id,
      symbol: value.symbol,
      timeframe: value.timeframe,
      end_time: value.end_time,
      split: value.split,
      expected_pattern: null as PatternKind | null,
      disposition: "UNREVIEWED" as const,
      annotator_id: "",
      reviewer_id: "",
      adjudicated: false,
      reviewed_at_utc: "",
      notes: "",
    };
  });
  // wx deliberately refuses to overwrite an existing label file.
  await writeFile(LABELS_FILE, template.map((row) => JSON.stringify(row)).join("\n") + "\n", { encoding: "utf8", flag: "wx" });
  console.log(JSON.stringify({
    template_file: "reference-labels-v1.jsonl",
    sample_count: template.length,
    status: "UNREVIEWED_DO_NOT_SCORE",
    blinded: true,
    pattern_labels: [...VALID_PATTERNS],
  }, null, 2));
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown label-template failure";
  console.error(`Label template generation failed: ${message}`);
  process.exitCode = 1;
});
