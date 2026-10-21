import type { Candle, SymbolPair, Timeframe } from "@/lib/types";

const INTERVALS: Record<Timeframe, string> = {
  "15m": "15m",
  "1h": "1h",
  "4h": "4h",
  "1d": "1d",
};

export async function fetchCandles(
  symbol: SymbolPair,
  timeframe: Timeframe,
  signal?: AbortSignal,
): Promise<Candle[]> {
  const params = new URLSearchParams({
    symbol,
    interval: INTERVALS[timeframe],
  });
  const response = await fetch(`/api/market/klines?${params.toString()}`, {
    signal,
    cache: "no-store",
  });
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : `Market data request failed (HTTP ${response.status}).`;
    throw new Error(message);
  }

  if (!Array.isArray(payload)) {
    throw new Error("Market data response was not a candle array.");
  }

  const candles = payload.map((row): Candle => {
    if (!Array.isArray(row) || row.length < 6) {
      throw new Error("Market data provider returned an invalid candle.");
    }
    return {
      time: Math.floor(Number(row[0]) / 1000),
      open: Number(row[1]),
      high: Number(row[2]),
      low: Number(row[3]),
      close: Number(row[4]),
      volume: Number(row[5]),
    };
  });

  if (
    candles.some(
      (c) =>
        !Object.values(c).every(Number.isFinite) ||
        c.high < c.low ||
        c.high < Math.max(c.open, c.close) ||
        c.low > Math.min(c.open, c.close),
    )
  ) {
    throw new Error("Market data contained invalid candle values.");
  }

  // Exclude the current, still-open candle to avoid decisions changing mid-bar.
  const intervalMs: Record<Timeframe, number> = {
    "15m": 15 * 60_000,
    "1h": 60 * 60_000,
    "4h": 4 * 60 * 60_000,
    "1d": 24 * 60 * 60_000,
  };
  const now = Date.now();
  return candles.filter((c) => c.time * 1000 + intervalMs[timeframe] <= now);
}
