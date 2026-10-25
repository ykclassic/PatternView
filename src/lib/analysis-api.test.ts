import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { fetchAnalysisPattern } from "@/lib/analysis-api";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test("maps backend scan output into the dashboard pattern contract", async () => {
  globalThis.fetch = (async () => new Response(JSON.stringify({
    scan_id: "scan-1", provider: "binance", rule_version: "patternview-engine-v1.1",
    scan_status: "QUALIFIED",
    patterns: [{
      kind: "DOUBLE_BOTTOM", status: "QUALIFIED", first_pivot_time: 100,
      last_pivot_time: 200, neckline: 101, breakout_level: 101, invalidation: 95,
      entry: 101, stop_loss: 95, take_profit: 107,
      explanation: ["Confirmed swing structure."], quality_score: 72,
    }],
  }), { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch;
  const pattern = await fetchAnalysisPattern("BTCUSDT", "1h");
  assert.equal(pattern?.kind, "DOUBLE_BOTTOM");
  assert.equal(pattern?.status, "QUALIFIED");
  assert.equal(pattern?.takeProfit, 107);
});

test("does not silently fall back when the backend is unavailable", async () => {
  globalThis.fetch = (async () => new Response(JSON.stringify({
    error: "Pattern analysis service is temporarily unavailable.",
  }), { status: 502, headers: { "content-type": "application/json" } })) as typeof fetch;
  await assert.rejects(fetchAnalysisPattern("ETHUSDT", "15m"), /temporarily unavailable/);
});

test("rejects malformed backend pattern output", async () => {
  globalThis.fetch = (async () => new Response(JSON.stringify({
    patterns: [{ kind: "DOUBLE_TOP" }],
  }), { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch;
  await assert.rejects(fetchAnalysisPattern("SOLUSDT", "4h"), /invalid pattern result/);
});
