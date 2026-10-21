import type { Candle, SymbolPair, Timeframe } from "@/lib/types";

const API_BASE =
  process.env.NEXT_PUBLIC_MARKET_DATA_BASE_URL?.replace(/\/$/, "") ??
  "https://api.binance.com";

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
  const url = new URL("/api/v3/klines", API_BASE);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", INTERVALS[timeframe]);
  url.searchParams.set("limit", "300");

  const response = await fetch(url, { signal, cache: "no-store" });
  if (!response.ok) {
    throw new Error(
      response.status === 429
        ? "Market data rate limit reached. Wait briefly and retry."
        : `Market data provider returned HTTP ${response.status}.`,
    );
  }

  const rows: unknown = await response.json();
  if (!Array.isArray(rows)) throw new Error("Market data response was not a candle array.");

  const candles = rows.map((row): Candle => {
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

  if (candles.some((c) => !Object.values(c).every(Number.isFinite))) {
    throw new Error("Market data contained non-finite values.");
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
