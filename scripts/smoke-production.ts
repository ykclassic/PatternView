import assert from "node:assert/strict";

interface CandleTime { time: number }
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isCandleTime(value: unknown): value is CandleTime {
  return isRecord(value) && typeof value.time === "number" && Number.isFinite(value.time) && value.time > 0;
}
const frontend = process.env.FRONTEND_URL;
const api = process.env.PATTERNVIEW_API_URL;
if (!frontend || !api) throw new Error("Set FRONTEND_URL and PATTERNVIEW_API_URL to deployed HTTPS origins.");
function origin(value: string, name: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.pathname !== "/" || url.search || url.hash || url.username || url.password) {
    throw new Error(`${name} must be an HTTPS origin without path, query, or credentials.`);
  }
  return url.origin;
}
const frontendOrigin = origin(frontend, "FRONTEND_URL");
const apiOrigin = origin(api, "PATTERNVIEW_API_URL");
async function getJson(url: string, init?: RequestInit): Promise<{ response: Response; body: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
    const body: unknown = await response.json().catch(() => null);
    return { response, body };
  } finally { clearTimeout(timer); }
}
async function main() {
  const home = await fetch(frontendOrigin, { cache: "no-store" });
  assert.equal(home.status, 200, `Frontend home expected 200, got ${home.status}`);
  const health = await getJson(`${apiOrigin}/health`);
  assert.equal(health.response.status, 200);
  assert(isRecord(health.body) && health.body.status === "ok");
  const ready = await getJson(`${apiOrigin}/ready`);
  assert.equal(ready.response.status, 200, `API readiness returned HTTP ${ready.response.status}`);
  const markets = await getJson(`${apiOrigin}/api/v1/markets`);
  assert.equal(markets.response.status, 200);
  assert(isRecord(markets.body));
  assert(Array.isArray(markets.body.symbols) && markets.body.symbols.includes("BTCUSDT"));
  assert(Array.isArray(markets.body.timeframes) && markets.body.timeframes.includes("1h"));
  const candles = await getJson(`${apiOrigin}/api/v1/candles?symbol=BTCUSDT&timeframe=1h&limit=60`);
  assert.equal(candles.response.status, 200, "Normalized closed-candle endpoint failed");
  assert(isRecord(candles.body) && Array.isArray(candles.body.candles));
  const candleRows: unknown[] = candles.body.candles;
  assert(candleRows.length >= 40, "Expected at least 40 closed candles");
  assert(candleRows.every((candle, index, all) => isCandleTime(candle) &&
    (index === 0 || (isCandleTime(all[index - 1]) && candle.time > all[index - 1].time))),
  "Candle timestamps are not strictly increasing");
  const scanBody = JSON.stringify({ symbol: "BTCUSDT", timeframe: "1h", limit: 60 });
  const scan = await getJson(`${apiOrigin}/api/v1/scan`, {
    method: "POST", headers: { "content-type": "application/json" }, body: scanBody,
  });
  assert.equal(scan.response.status, 200, "Backend scan endpoint failed");
  assert(isRecord(scan.body) && Array.isArray(scan.body.patterns));
  assert.equal(typeof scan.body.persisted, "boolean");
  const proxied = await getJson(`${frontendOrigin}/api/analysis/scan`, {
    method: "POST", headers: { "content-type": "application/json" }, body: scanBody,
  });
  assert.equal(proxied.response.status, 200, "Frontend-to-backend scan proxy failed");
  assert(isRecord(proxied.body) && Array.isArray(proxied.body.patterns));
  console.log(JSON.stringify({
    status: "passed", frontend: frontendOrigin, backend: apiOrigin,
    closedCandles: candleRows.length, patterns: scan.body.patterns.length,
    persistenceEnabledForScan: scan.body.persisted,
  }, null, 2));
}
main().catch((error) => {
  console.error(`Production smoke failed: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exitCode = 1;
});
