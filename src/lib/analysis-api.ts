import type { DetectedPattern, PatternKind, PatternStatus, SymbolPair, Timeframe } from "@/lib/types";

interface ApiPattern {
  kind: PatternKind;
  status: string;
  first_pivot_time: number;
  last_pivot_time: number;
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
  patterns: ApiPattern[];
}
const allowedStatuses = new Set<PatternStatus>([
  "FORMING", "CONFIRMED", "WAITING FOR BREAKOUT", "QUALIFIED", "INVALIDATED", "NO TRADE",
]);
function parsePattern(value: ApiPattern): DetectedPattern {
  if (!value || typeof value.kind !== "string" || !Array.isArray(value.explanation) ||
      !Number.isFinite(value.first_pivot_time) || !Number.isFinite(value.last_pivot_time) ||
      !Number.isFinite(value.neckline) || !Number.isFinite(value.invalidation)) {
    throw new Error("Analysis service returned an invalid pattern result.");
  }
  const status = value.status.replaceAll("_", " ") as PatternStatus;
  if (!allowedStatuses.has(status)) throw new Error("Analysis service returned an unknown pattern status.");
  return {
    kind: value.kind, status, firstPivotTime: value.first_pivot_time,
    secondPivotTime: value.last_pivot_time, neckline: value.neckline,
    breakoutLevel: value.breakout_level, invalidation: value.invalidation,
    entry: value.entry, stopLoss: value.stop_loss, takeProfit: value.take_profit,
    explanation: value.explanation,
  };
}
export async function fetchAnalysisPattern(
  symbol: SymbolPair, timeframe: Timeframe, signal?: AbortSignal,
): Promise<DetectedPattern | null> {
  const response = await fetch("/api/analysis/scan", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ symbol, timeframe, limit: 300 }), signal, cache: "no-store",
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
  const patterns = scan.patterns.map((pattern) => parsePattern(pattern));
  return patterns[0] ?? null;
}
