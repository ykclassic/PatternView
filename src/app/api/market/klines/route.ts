import { NextRequest, NextResponse } from "next/server";

const ALLOWED_SYMBOLS = new Set(["BTCUSDT", "ETHUSDT", "SOLUSDT"]);
const ALLOWED_INTERVALS = new Set(["15m", "1h", "4h", "1d"]);
const BINANCE_API_HOSTS = [
  "https://api.binance.com",
  "https://api1.binance.com",
  "https://api2.binance.com",
  "https://api3.binance.com",
] as const;
const KRAKEN_PAIRS: Record<string, string> = {
  BTCUSDT: "XBTUSDT",
  ETHUSDT: "ETHUSDT",
  SOLUSDT: "SOLUSDT",
};
const KRAKEN_INTERVALS: Record<string, number> = { "15m": 15, "1h": 60, "4h": 240, "1d": 1440 };
const REQUEST_TIMEOUT_MS = 4_000;

type BinanceKline = [number, string, string, string, string, string, ...unknown[]];

function validCandleRows(payload: unknown): payload is unknown[][] {
  return Array.isArray(payload) && payload.length > 0 && payload.every((row) => {
    if (!Array.isArray(row) || row.length < 6) return false;
    const values = row.slice(0, 6).map(Number);
    const [time, open, high, low, close, volume] = values;
    return values.every(Number.isFinite) && time > 0 && open > 0 &&
      high >= Math.max(open, close, low) && low > 0 &&
      low <= Math.min(open, close) && volume >= 0;
  });
}

function validKrakenRows(payload: unknown): payload is unknown[][] {
  return Array.isArray(payload) && payload.length > 0 && payload.every((row) => {
    if (!Array.isArray(row) || row.length < 8) return false;
    const time = Number(row[0]);
    const open = Number(row[1]);
    const high = Number(row[2]);
    const low = Number(row[3]);
    const close = Number(row[4]);
    const volume = Number(row[6]);
    return [time, open, high, low, close, volume].every(Number.isFinite) &&
      time > 0 && open > 0 && high >= Math.max(open, close, low) &&
      low > 0 && low <= Math.min(open, close) && volume >= 0;
  });
}

async function fetchJson(url: URL): Promise<unknown> {
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`http_${response.status}`);
  return response.json();
}

async function fetchBinance(host: string, symbol: string, interval: string): Promise<unknown[][]> {
  const url = new URL("/api/v3/klines", host);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", interval);
  url.searchParams.set("limit", "300");
  const payload = await fetchJson(url);
  if (!validCandleRows(payload)) throw new Error("invalid_payload");
  return payload;
}

async function fetchKraken(symbol: string, interval: string): Promise<BinanceKline[]> {
  const url = new URL("https://api.kraken.com/0/public/OHLC");
  url.searchParams.set("pair", KRAKEN_PAIRS[symbol]);
  url.searchParams.set("interval", String(KRAKEN_INTERVALS[interval]));
  const payload = await fetchJson(url);
  if (!payload || typeof payload !== "object" || !("result" in payload) || !("error" in payload)) {
    throw new Error("invalid_envelope");
  }

  const envelope = payload as { error: unknown; result: unknown };
  if (!Array.isArray(envelope.error) || envelope.error.length > 0) throw new Error("provider_error");
  if (!envelope.result || typeof envelope.result !== "object") throw new Error("invalid_result");

  const result = envelope.result as Record<string, unknown>;
  const key = Object.keys(result).find((candidate) => candidate !== "last");
  if (!key || !Array.isArray(result[key])) throw new Error("missing_pair_data");

  // Kraken's final row is the still-open candle; discard it before validation.
  const rows = (result[key] as unknown[][]).slice(0, -1);
  if (!validKrakenRows(rows)) throw new Error("invalid_payload");
  return rows.map((row) => [
    Number(row[0]) * 1000,
    String(row[1]),
    String(row[2]),
    String(row[3]),
    String(row[4]),
    String(row[6]),
  ]);
}

function safeReasonCode(cause: unknown): string {
  const message = cause instanceof Error ? cause.message : "";
  if (/^http_\d{3}$/.test(message)) return message;
  if (["invalid_payload", "invalid_envelope", "provider_error", "invalid_result", "missing_pair_data"].includes(message)) {
    return message;
  }
  return "request_failed";
}

function recordFailure(provider: string, cause: unknown) {
  // Log only a bounded provider identifier and allowlisted reason code.
  console.warn("[market-data] provider attempt failed", {
    provider,
    reason_code: safeReasonCode(cause),
  });
}

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol") ?? "";
  const interval = request.nextUrl.searchParams.get("interval") ?? "";

  if (!ALLOWED_SYMBOLS.has(symbol) || !ALLOWED_INTERVALS.has(interval)) {
    return NextResponse.json({ error: "Unsupported symbol or timeframe." }, { status: 400 });
  }

  // Race Binance's public API hosts; each attempt has its own hard timeout.
  const attempts = await Promise.allSettled(BINANCE_API_HOSTS.map((host) => fetchBinance(host, symbol, interval)));
  const successful = attempts.find(
    (attempt): attempt is PromiseFulfilledResult<unknown[][]> => attempt.status === "fulfilled",
  );
  if (successful) {
    return NextResponse.json(successful.value, {
      headers: { "Cache-Control": "no-store", "X-Market-Data-Provider": "binance" },
    });
  }
  for (const attempt of attempts) if (attempt.status === "rejected") recordFailure("binance", attempt.reason);

  try {
    const candles = await fetchKraken(symbol, interval);
    return NextResponse.json(candles, {
      headers: { "Cache-Control": "no-store", "X-Market-Data-Provider": "kraken" },
    });
  } catch (cause) {
    recordFailure("kraken", cause);
  }

  return NextResponse.json(
    { error: "Market data is temporarily unavailable from all supported providers." },
    { status: 502, headers: { "Cache-Control": "no-store" } },
  );
}
