import type { DetectedPattern, PatternKind, PatternStatus, SymbolPair, Timeframe } from "@/lib/types";

interface ApiPattern {
  kind: PatternKind;
  status: string;
  first_pivot_time: number;
  last_pivot_time: number;
  pivot_times?: number[];
  detection_time?: number;
  rule_version?: string;
  neckline: number;
  breakout_level: number;
  invalidation: number;
  entry: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  explanation: string[];
  quality_score: number;
}
interface ScanResponse {
  scan_id: string;
  provider: string;
  rule_version: string;
  scan_status: string;
  persisted: boolean;
  patterns: ApiPattern[];
}
export interface AnalysisScan {
  scanId: string;
  provider: string;
  ruleVersion: string;
  scanStatus: string;
  persisted: boolean;
  pattern: DetectedPattern | null;
}
const allowedStatuses = new Set<PatternStatus>([
  "FORMING", "CONFIRMED", "WAITING FOR BREAKOUT", "QUALIFIED", "INVALIDATED", "NO TRADE",
]);
const allowedKinds = new Set<PatternKind>([
  "DOUBLE_TOP", "DOUBLE_BOTTOM", "TRIPLE_TOP", "TRIPLE_BOTTOM",
  "HEAD_AND_SHOULDERS", "INVERSE_HEAD_AND_SHOULDERS",
  "ASCENDING_TRIANGLE", "DESCENDING_TRIANGLE", "SYMMETRICAL_TRIANGLE",
  "BULL_FLAG", "BEAR_FLAG", "RISING_WEDGE", "FALLING_WEDGE",
  "DOJI", "HAMMER", "SHOOTING_STAR", "BULLISH_ENGULFING",
  "BEARISH_ENGULFING", "MORNING_STAR", "EVENING_STAR",
  "THREE_WHITE_SOLDIERS", "THREE_BLACK_CROWS",
]);

function parsePattern(value: ApiPattern, fallbackRuleVersion: string): DetectedPattern {
  if (!value || typeof value.kind !== "string" || !allowedKinds.has(value.kind) ||
      !Array.isArray(value.explanation) || !Number.isFinite(value.first_pivot_time) ||
      !Number.isFinite(value.last_pivot_time) || !Number.isFinite(value.neckline) ||
      !Number.isFinite(value.breakout_level) || !Number.isFinite(value.invalidation) ||
      !Number.isInteger(value.quality_score) || value.quality_score < 0 || value.quality_score > 100) {
    throw new Error("Analysis service returned an invalid pattern result.");
  }
  const status = value.status.replaceAll("_", " ") as PatternStatus;
  if (!allowedStatuses.has(status)) throw new Error("Analysis service returned an unknown pattern status.");
  const pivotTimes = Array.isArray(value.pivot_times)
    ? value.pivot_times.filter((time) => Number.isFinite(time))
    : [];
  return {
    kind: value.kind,
    status,
    firstPivotTime: value.first_pivot_time,
    secondPivotTime: pivotTimes[1] ?? value.last_pivot_time,
    thirdPivotTime: pivotTimes[2],
    neckline: value.neckline,
    breakoutLevel: value.breakout_level,
    invalidation: value.invalidation,
    entry: value.entry,
    stopLoss: value.stop_loss,
    takeProfit: value.take_profit,
    explanation: value.explanation,
    qualityScore: value.quality_score,
    ruleVersion: value.rule_version ?? fallbackRuleVersion,
    detectionTime: value.detection_time,
  };
}

export async function fetchAnalysisScan(
  symbol: SymbolPair, timeframe: Timeframe, signal?: AbortSignal,
): Promise<AnalysisScan> {
  const response = await fetch("/api/analysis/scan", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ symbol, timeframe, limit: 300 }),
    signal,
    cache: "no-store",
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof payload === "object" && payload !== null && "error" in payload &&
      typeof payload.error === "string" ? payload.error : `Analysis service unavailable (HTTP ${response.status}).`;
    throw new Error(message);
  }
  if (typeof payload !== "object" || payload === null || !("patterns" in payload) ||
      !Array.isArray((payload as ScanResponse).patterns)) {
    throw new Error("Analysis service returned an invalid scan response.");
  }
  const scan = payload as ScanResponse;
  if (typeof scan.scan_id !== "string" || typeof scan.provider !== "string" ||
      typeof scan.rule_version !== "string" || typeof scan.persisted !== "boolean" ||
      typeof scan.scan_status !== "string") {
    throw new Error("Analysis service returned incomplete scan provenance.");
  }
  const patterns = scan.patterns.map((pattern) => parsePattern(pattern, scan.rule_version));
  return {
    scanId: scan.scan_id,
    provider: scan.provider,
    ruleVersion: scan.rule_version,
    scanStatus: scan.scan_status,
    persisted: scan.persisted,
    pattern: patterns[0] ?? null,
  };
}

export async function fetchAnalysisPattern(
  symbol: SymbolPair, timeframe: Timeframe, signal?: AbortSignal,
): Promise<DetectedPattern | null> {
  return (await fetchAnalysisScan(symbol, timeframe, signal)).pattern;
}
