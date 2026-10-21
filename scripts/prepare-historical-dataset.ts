import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

type Timeframe = "15m" | "1h" | "4h" | "1d";
type Candle = { time: number; open: number; high: number; low: number; close: number; volume: number };
const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"] as const;
const TIMEFRAMES: Timeframe[] = ["15m", "1h", "4h", "1d"];
const LIMIT = 720;
const WINDOW_SIZE = 120;
const KRAKEN_PAIRS: Record<string, string> = { BTCUSDT: "XBTUSDT", ETHUSDT: "ETHUSDT", SOLUSDT: "SOLUSDT" };
const KRAKEN_INTERVALS: Record<Timeframe, number> = { "15m": 15, "1h": 60, "4h": 240, "1d": 1440 };
const INTERVAL_SECONDS: Record<Timeframe, number> = {
  "15m": 900, "1h": 3600, "4h": 14400, "1d": 86400,
};
const OUTPUT_DIR = join(process.cwd(), "datasets", "historical-v1");

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function validateCandles(candles: Candle[], interval: number): void {
  if (candles.length < WINDOW_SIZE) throw new Error(`Only ${candles.length} candles returned`);
  for (let i = 0; i < candles.length; i += 1) {
    const c = candles[i];
    if (![c.time, c.open, c.high, c.low, c.close, c.volume].every(Number.isFinite) ||
      c.time <= 0 || c.open <= 0 || c.low <= 0 || c.volume < 0 ||
      c.high < Math.max(c.open, c.close, c.low) ||
      c.low > Math.min(c.open, c.close)) {
      throw new Error(`Invalid OHLCV at row ${i}`);
    }
    if (i > 0 && c.time - candles[i - 1].time !== interval) {
      throw new Error(`Timestamp gap/order issue at row ${i}`);
    }
  }
}

async function fetchBinanceCandles(symbol: string, timeframe: Timeframe): Promise<Candle[]> {
  const interval = INTERVAL_SECONDS[timeframe];
  const url = new URL("https://api.binance.com/api/v3/klines");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", timeframe);
  url.searchParams.set("limit", String(LIMIT));
  url.searchParams.set("endTime", String(Date.now()));
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Binance HTTP ${response.status}`);
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) throw new Error("Invalid Binance response");
  const nowSeconds = Math.floor(Date.now() / 1000);
  const candles = payload.map((row): Candle => {
    if (!Array.isArray(row) || row.length < 6) throw new Error("Malformed Binance kline row");
    return {
      time: Math.floor(Number(row[0]) / 1000),
      open: Number(row[1]), high: Number(row[2]), low: Number(row[3]),
      close: Number(row[4]), volume: Number(row[5]),
    };
  }).filter((c) => c.time + interval <= nowSeconds);
  validateCandles(candles, interval);
  return candles;
}

async function fetchKrakenCandles(symbol: string, timeframe: Timeframe): Promise<Candle[]> {
  const pair = KRAKEN_PAIRS[symbol];
  if (!pair) throw new Error(`No Kraken pair mapping for ${symbol}`);
  const interval = INTERVAL_SECONDS[timeframe];
  const url = new URL("https://api.kraken.com/0/public/OHLC");
  url.searchParams.set("pair", pair);
  url.searchParams.set("interval", String(KRAKEN_INTERVALS[timeframe]));
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Kraken HTTP ${response.status}`);
  const payload: unknown = await response.json();
  if (typeof payload !== "object" || payload === null || !("result" in payload) ||
      typeof payload.result !== "object" || payload.result === null) {
    throw new Error("Invalid Kraken OHLC response");
  }
  if ("error" in payload && Array.isArray(payload.error) && payload.error.length > 0) {
    throw new Error("Kraken OHLC API returned an error");
  }
  const result = payload.result as Record<string, unknown>;
  const key = Object.keys(result).find((candidate) => candidate !== "last");
  const rows = key ? result[key] : null;
  if (!Array.isArray(rows)) throw new Error("Kraken OHLC result rows missing");
  const nowSeconds = Math.floor(Date.now() / 1000);
  const candles = rows.map((row): Candle => {
    if (!Array.isArray(row) || row.length < 7) throw new Error("Malformed Kraken OHLC row");
    return {
      time: Math.floor(Number(row[0])),
      open: Number(row[1]), high: Number(row[2]), low: Number(row[3]),
      close: Number(row[4]), volume: Number(row[6]),
    };
  }).filter((c) => c.time + interval <= nowSeconds);
  validateCandles(candles, interval);
  return candles;
}

async function fetchCandles(symbol: string, timeframe: Timeframe): Promise<{ candles: Candle[]; source: string }> {
  try {
    return { candles: await fetchBinanceCandles(symbol, timeframe), source: "Binance Spot public klines API" };
  } catch (binanceError) {
    try {
      return { candles: await fetchKrakenCandles(symbol, timeframe), source: "Kraken public OHLC API" };
    } catch (krakenError) {
      const binanceMessage = binanceError instanceof Error ? binanceError.message : "unknown error";
      const krakenMessage = krakenError instanceof Error ? krakenError.message : "unknown error";
      throw new Error(`No source available for ${symbol} ${timeframe}; Binance: ${binanceMessage}; Kraken: ${krakenMessage}`);
    }
  }
}

async function main(): Promise<void> {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const packets: Array<{
    sample_id: string;
    symbol: string;
    timeframe: Timeframe;
    start_time_utc: string;
    end_time_utc: string;
    start_time: number;
    end_time: number;
    candles: Candle[];
  }> = [];
  const snapshotDigests: Record<string, string> = {};

  for (const symbol of SYMBOLS) {
    for (const timeframe of TIMEFRAMES) {
      const fetched = await fetchCandles(symbol, timeframe);
      const candles = fetched.candles;
      const serialized = JSON.stringify(candles);
      const file = `${symbol}-${timeframe}.json`;
      await writeFile(join(OUTPUT_DIR, file), `${JSON.stringify({
        symbol, timeframe, source: fetched.source,
        interval_seconds: INTERVAL_SECONDS[timeframe],
        retrieved_at_utc: new Date().toISOString(),
        candle_count: candles.length,
        sha256: sha256(serialized),
        candles,
      }, null, 2)}\n`, "utf8");
      snapshotDigests[file] = sha256(serialized);

      for (let start = 0; start + WINDOW_SIZE <= candles.length; start += WINDOW_SIZE) {
        const window = candles.slice(start, start + WINDOW_SIZE);
        const end = window[window.length - 1].time;
        packets.push({
          sample_id: `${symbol}-${timeframe}-${end}`,
          symbol, timeframe,
          start_time_utc: new Date(window[0].time * 1000).toISOString(),
          end_time_utc: new Date(end * 1000).toISOString(),
          start_time: window[0].time,
          end_time: end,
          candles: window,
        });
      }
      // Keep a small delay between public requests to avoid needless request bursts.
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }

  // Packets contain OHLCV only: detector outputs and labels are deliberately absent.
  const packetText = packets.map((packet) => JSON.stringify(packet)).join("\n") + "\n";
  await writeFile(join(OUTPUT_DIR, "blind-packets.jsonl"), packetText, "utf8");
  const metadata = {
    dataset_id: "patternview-crypto-spot-v1",
    dataset_version: "1.0.0",
    prepared_at_utc: new Date().toISOString(),
    source_policy: "Binance Spot public klines API with Kraken public OHLC fallback",
    symbol_count: SYMBOLS.length,
    timeframe_count: TIMEFRAMES.length,
    candle_count_per_series: LIMIT,
    window_size: WINDOW_SIZE,
    packet_count: packets.length,
    snapshot_sha256: snapshotDigests,
    blind_packets_sha256: sha256(packetText),
    labels_included: false,
    detector_predictions_included: false,
    status: "RAW_DATA_PREPARED_LABELING_REQUIRED",
  };
  await writeFile(join(OUTPUT_DIR, "prepared-manifest.json"), `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(metadata, null, 2));
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown dataset preparation failure";
  console.error(`Historical dataset preparation failed: ${message}`);
  process.exitCode = 1;
});
