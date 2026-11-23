import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { fetchAnalysisPattern, fetchAnalysisScan } from "@/lib/analysis-api";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

const candles = Array.from({ length: 40 }, (_, index) => ({
  time: 1_800_000_000 + index * 3600, open: 100, high: 110, low: 90, close: 105, volume: 42,
}));

test("maps backend scan output and returns the same candle snapshot for charting", async () => {
  globalThis.fetch = (async () => new Response(JSON.stringify({
    scan_id: "scan-1", provider: "binance", rule_version: "patternview-engine-v1.1",
    scan_status: "QUALIFIED", persisted: true, candles,
    patterns: [{
      kind: "DOUBLE_BOTTOM", status: "QUALIFIED", first_pivot_time: 100,
      last_pivot_time: 200, pivot_times: [100, 150, 200], detection_time: 300,
      rule_version: "patternview-engine-v1.1", neckline: 101, breakout_level: 101,
      invalidation: 95, entry: 101, stop_loss: 95, take_profit: 107,
      explanation: ["Confirmed swing structure."], quality_score: 72,
    }],
  }), { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch;
  const scan = await fetchAnalysisScan("BTCUSDT", "1h");
  assert.equal(scan.pattern?.kind, "DOUBLE_BOTTOM");
  assert.equal(scan.pattern?.status, "QUALIFIED");
  assert.equal(scan.pattern?.takeProfit, 107);
  assert.equal(scan.pattern?.qualityScore, 72);
  assert.equal(scan.pattern?.ruleVersion, "patternview-engine-v1.1");
  assert.equal(scan.pattern?.thirdPivotTime, 200);
  assert.equal(scan.candles.length, 40);
  assert.equal(scan.candles[0].time, candles[0].time);
});

test("returns persistence and provider provenance when no pattern is found", async () => {
  globalThis.fetch = (async () => new Response(JSON.stringify({
    scan_id: "scan-42", provider: "kraken", rule_version: "engine-v2",
    scan_status: "NO TRADE", persisted: false, candles, patterns: [],
  }), { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch;
  const scan = await fetchAnalysisScan("BTCUSDT", "4h");
  assert.equal(scan.scanId, "scan-42");
  assert.equal(scan.provider, "kraken");
  assert.equal(scan.ruleVersion, "engine-v2");
  assert.equal(scan.persisted, false);
  assert.equal(scan.pattern, null);
});

test("does not silently fall back when the backend is unavailable", async () => {
  globalThis.fetch = (async () => new Response(JSON.stringify({
    error: "Pattern analysis service is temporarily unavailable.",
  }), { status: 502, headers: { "content-type": "application/json" } })) as typeof fetch;
  await assert.rejects(fetchAnalysisPattern("ETHUSDT", "15m"), /temporarily unavailable/);
});

test("rejects malformed backend pattern output", async () => {
  globalThis.fetch = (async () => new Response(JSON.stringify({
    scan_id: "scan-bad", provider: "binance", rule_version: "v1",
    scan_status: "NO TRADE", persisted: false, candles,
    patterns: [{ kind: "DOUBLE_TOP" }],
  }), { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch;
  await assert.rejects(fetchAnalysisPattern("SOLUSDT", "4h"), /invalid pattern result/);
});

test("rejects incomplete candle payloads instead of rendering unverified chart data", async () => {
  globalThis.fetch = (async () => new Response(JSON.stringify({
    scan_id: "scan-empty", provider: "kraken", rule_version: "v1",
    scan_status: "NO TRADE", persisted: false, candles: candles.slice(0, 2), patterns: [],
  }), { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch;
  await assert.rejects(fetchAnalysisScan("BTCUSDT", "1h"), /insufficient closed candles/);
});
