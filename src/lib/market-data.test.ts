import assert from "node:assert/strict";
import test from "node:test";

import { fetchMarketSnapshot, fetchPatternScan } from "./market-data";

const apiUrl = "https://patternview-api.example.test";
const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;
const originalFetch = globalThis.fetch;

test("backend candle client maps the normalized candle contract", async () => {
  process.env.NEXT_PUBLIC_API_URL = apiUrl;
  globalThis.fetch = async () => new Response(JSON.stringify({
    symbol: "BTCUSDT",
    timeframe: "1h",
    provider: "kraken",
    fetched_at: 1_700_000_100,
    stale: false,
    candles: [{
      time: 1_700_000_000,
      open: 100,
      high: 105,
      low: 98,
      close: 102,
      volume: 50,
    }],
  }), { status: 200, headers: { "Content-Type": "application/json" } });

  try {
    const snapshot = await fetchMarketSnapshot("BTCUSDT", "1h");
    assert.equal(snapshot.provider, "kraken");
    assert.equal(snapshot.candles.length, 1);
    assert.equal(snapshot.candles[0].time, 1_700_000_000);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiUrl === undefined) delete process.env.NEXT_PUBLIC_API_URL;
    else process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
  }
});

test("backend scan client maps explainable pattern metadata", async () => {
  process.env.NEXT_PUBLIC_API_URL = apiUrl;
  globalThis.fetch = async (_input, init) => {
    assert.equal(init?.method, "POST");
    return new Response(JSON.stringify({
      scan_id: "scan-123",
      symbol: "BTCUSDT",
      timeframe: "1h",
      provider: "binance",
      scanned_at: 1_700_000_100,
      candle_count: 300,
      first_candle_time: 1_700_000_000,
      last_candle_time: 1_700_100_000,
      rule_version: "patternview-engine-v1.1",
      scan_status: "WAITING FOR BREAKOUT",
      explanation: ["waiting"],
      persisted: true,
      patterns: [{
        kind: "DOUBLE_TOP",
        status: "WAITING FOR BREAKOUT",
        quality_score: 72,
        first_pivot_time: 1_700_010_000,
        last_pivot_time: 1_700_020_000,
        pivot_times: [1_700_010_000, 1_700_020_000],
        detection_time: 1_700_100_000,
        neckline: 99,
        breakout_level: 99,
        invalidation: 111,
        entry: 99,
        stop_loss: 111,
        take_profit: 87,
        explanation: ["two confirmed highs"],
        rule_version: "patternview-engine-v1.1",
      }],
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const result = await fetchPatternScan("BTCUSDT", "1h");
    assert.ok(result);
    assert.equal(result.scanId, "scan-123");
    assert.equal(result.persisted, true);
    assert.equal(result.patterns[0].kind, "DOUBLE_TOP");
    assert.equal(result.patterns[0].qualityScore, 72);
    assert.equal(result.patterns[0].secondPivotTime, 1_700_020_000);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiUrl === undefined) delete process.env.NEXT_PUBLIC_API_URL;
    else process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
  }
});
