import type { Candle, DetectedPattern, PatternKind, PatternStatus, SymbolPair, Timeframe } from "@/lib/types";

const INTERVALS: Record<Timeframe, string> = {
  "15m": "15m",
  "1h": "1h",
  "4h": "4h",
  "1d": "1d",
};
const INTERVAL_SECONDS: Record<Timeframe, number> = {
  "15m": 15 * 60,
  "1h": 60 * 60,
  "4h": 4 * 60 * 60,
  "1d": 24 * 60 * 60,
};

export interface MarketSnapshot {
  candles: Candle[];
  provider: string;
}

export interface PatternScanSnapshot {
  patterns: DetectedPattern[];
  scanId: string;
  ruleVersion: string;
  persisted: boolean;
  scanStatus: string;
}

interface ApiCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const apiBase = () => (process.env.NEXT_PUBLIC_API_URL ?? "").trim().replace(/\/+$/, "");

function validateCandles(candles: Candle[], timeframe: Timeframe): Candle[] {
  if (!Array.isArray(candles) || candles.length === 0) {
    throw new Error("Market data response was not a non-empty candle array.");
  }
  if (candles.some((c) =>
    !Object.values(c).every(Number.isFinite) ||
    c.time <= 0 || c.open <= 0 || c.low <= 0 || c.volume < 0 ||
    c.high < Math.max(c.open, c.close, c.low) ||
    c.low > Math.min(c.open, c.close)
  )) throw new Error("Market data contained invalid candle values.");

  for (let i = 1; i < candles.length; i += 1) {
    if (candles[i].time <= candles[i - 1].time) {
      throw new Error("Market data timestamps are duplicated or out of order.");
    }
  }

  const now = Math.floor(Date.now() / 1000);
  const closed = candles.filter((c) => c.time + INTERVAL_SECONDS[timeframe] <= now);
  if (closed.length === 0) throw new Error("No closed candles are currently available.");
  return closed;
}

function fromApiCandle(row: ApiCandle): Candle {
  return {
    time: Number(row.time),
    open: Number(row.open),
    high: Number(row.high),
    low: Number(row.low),
    close: Number(row.close),
    volume: Number(row.volume),
  };
}

export async function fetchMarketSnapshot(
  symbol: SymbolPair,
  timeframe: Timeframe,
  signal?: AbortSignal,
): Promise<MarketSnapshot> {
  const base = apiBase();
  if (base) {
    const params = new URLSearchParams({ symbol, timeframe, limit: "300" });
    const response = await fetch(`${base}/api/v1/candles?${params.toString()}`, {
      signal,
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Market data service is temporarily unavailable.");
    const payload: unknown = await response.json().catch(() => null);
    if (typeof payload !== "object" || payload === null || !("candles" in payload) ||
      !Array.isArray(payload.candles) || !("provider" in payload) || typeof payload.provider !== "string") {
      throw new Error("Market data service returned an invalid response.");
    }
    const candles = validateCandles(payload.candles.map((row) => fromApiCandle(row as ApiCandle)), timeframe);
    return { candles, provider: payload.provider };
  }

  const params = new URLSearchParams({ symbol, interval: INTERVALS[timeframe] });
  const response = await fetch(`/api/market/klines?${params.toString()}`, {
    signal,
    cache: "no-store",
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      typeof payload === "object" && payload !== null && "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : `Market data request failed (HTTP ${response.status}).`;
    throw new Error(message);
  }
  if (!Array.isArray(payload)) throw new Error("Market data response was not a candle array.");
  const candles = payload.map((row): Candle => {
    if (!Array.isArray(row) || row.length < 6) throw new Error("Market data provider returned an invalid candle.");
    return {
      time: Math.floor(Number(row[0]) / 1000),
      open: Number(row[1]),
      high: Number(row[2]),
      low: Number(row[3]),
      close: Number(row[4]),
      volume: Number(row[5]),
    };
  });
  return {
    candles: validateCandles(candles, timeframe),
    provider: response.headers.get("x-market-data-provider") ?? "provider-unspecified",
  };
}

const PATTERN_KINDS = new Set<PatternKind>([
  "DOUBLE_TOP", "DOUBLE_BOTTOM", "TRIPLE_TOP", "TRIPLE_BOTTOM",
  "HEAD_AND_SHOULDERS", "INVERSE_HEAD_AND_SHOULDERS",
  "ASCENDING_TRIANGLE", "DESCENDING_TRIANGLE", "SYMMETRICAL_TRIANGLE",
  "BULL_FLAG", "BEAR_FLAG", "RISING_WEDGE", "FALLING_WEDGE",
  "DOJI", "HAMMER", "SHOOTING_STAR", "BULLISH_ENGULFING",
  "BEARISH_ENGULFING", "MORNING_STAR", "EVENING_STAR",
  "THREE_WHITE_SOLDIERS", "THREE_BLACK_CROWS",
]);
const PATTERN_STATUSES = new Set<PatternStatus>([
  "FORMING", "CONFIRMED", "WAITING FOR BREAKOUT", "QUALIFIED", "INVALIDATED", "NO TRADE",
]);

export async function fetchPatternScan(
  symbol: SymbolPair,
  timeframe: Timeframe,
  signal?: AbortSignal,
): Promise<PatternScanSnapshot | null> {
  const base = apiBase();
  if (!base) return null;
  const response = await fetch(`${base}/api/v1/scan`, {
    method: "POST",
    signal,
    cache: "no-store",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ symbol, timeframe, limit: 300 }),
  });
  if (!response.ok) throw new Error("Pattern analysis service is temporarily unavailable.");
  const payload: unknown = await response.json().catch(() => null);
  if (typeof payload !== "object" || payload === null || !("patterns" in payload) ||
    !Array.isArray(payload.patterns) || !("scan_id" in payload) || typeof payload.scan_id !== "string" ||
    !("rule_version" in payload) || typeof payload.rule_version !== "string" ||
    !("persisted" in payload) || typeof payload.persisted !== "boolean" ||
    !("scan_status" in payload) || typeof payload.scan_status !== "string") {
    throw new Error("Pattern analysis service returned an invalid response.");
  }

  const patterns = payload.patterns.flatMap((item): DetectedPattern[] => {
    if (typeof item !== "object" || item === null) return [];
    const row = item as Record<string, unknown>;
    if (typeof row.kind !== "string" || !PATTERN_KINDS.has(row.kind as PatternKind) ||
      typeof row.status !== "string" || !PATTERN_STATUSES.has(row.status as PatternStatus)) return [];
    const pivotTimes = Array.isArray(row.pivot_times)
      ? row.pivot_times.map(Number).filter(Number.isFinite)
      : [];
    const firstPivotTime = Number(row.first_pivot_time);
    const lastPivotTime = Number(row.last_pivot_time);
    const pattern: DetectedPattern = {
      kind: row.kind as PatternKind,
      status: row.status as PatternStatus,
      firstPivotTime: Number.isFinite(firstPivotTime) ? firstPivotTime : pivotTimes[0] ?? 0,
      secondPivotTime: pivotTimes[1] ?? lastPivotTime,
      thirdPivotTime: pivotTimes[2],
      neckline: Number(row.neckline),
      breakoutLevel: Number(row.breakout_level),
      invalidation: Number(row.invalidation),
      entry: typeof row.entry === "number" ? row.entry : null,
      stopLoss: typeof row.stop_loss === "number" ? row.stop_loss : null,
      takeProfit: typeof row.take_profit === "number" ? row.take_profit : null,
      explanation: Array.isArray(row.explanation) ? row.explanation.filter((line): line is string => typeof line === "string") : [],
      qualityScore: typeof row.quality_score === "number" ? row.quality_score : undefined,
      ruleVersion: typeof row.rule_version === "string" ? row.rule_version : payload.rule_version,
      detectionTime: typeof row.detection_time === "number" ? row.detection_time : undefined,
    };
    if (![pattern.neckline, pattern.breakoutLevel, pattern.invalidation].every(Number.isFinite)) return [];
    return [pattern];
  });
  return {
    patterns,
    scanId: payload.scan_id,
    ruleVersion: payload.rule_version,
    persisted: payload.persisted,
    scanStatus: payload.scan_status,
  };
}

export async function fetchCandles(
  symbol: SymbolPair,
  timeframe: Timeframe,
  signal?: AbortSignal,
): Promise<Candle[]> {
  return (await fetchMarketSnapshot(symbol, timeframe, signal)).candles;
}
