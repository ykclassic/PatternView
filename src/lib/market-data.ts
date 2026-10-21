import type { Candle, SymbolPair, Timeframe } from "@/lib/types";

const INTERVALS: Record<Timeframe, string> = {
  "15m": "15m",
  "1h": "1h",
  "4h": "4h",
  "1d": "1d",
};

export interface MarketSnapshot {
  candles: Candle[];
  provider: string;
}

export async function fetchMarketSnapshot(
  symbol: SymbolPair,
  timeframe: Timeframe,
  signal?: AbortSignal,
): Promise<MarketSnapshot> {
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
  if (!Array.isArray(payload) || payload.length === 0) {
    throw new Error("Market data response was not a non-empty candle array.");
  }

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

  const intervalSeconds: Record<Timeframe, number> = {
    "15m": 15 * 60,
    "1h": 60 * 60,
    "4h": 4 * 60 * 60,
    "1d": 24 * 60 * 60,
  };
  const interval = intervalSeconds[timeframe];
  const now = Math.floor(Date.now() / 1000);
  const closed = candles.filter((c) => c.time + interval <= now);
  if (closed.length === 0) throw new Error("No closed candles are currently available.");

  return {
    candles: closed,
    provider: response.headers.get("x-market-data-provider") ?? "provider-unspecified",
  };
}

export async function fetchCandles(
  symbol: SymbolPair,
  timeframe: Timeframe,
  signal?: AbortSignal,
): Promise<Candle[]> {
  return (await fetchMarketSnapshot(symbol, timeframe, signal)).candles;
}
