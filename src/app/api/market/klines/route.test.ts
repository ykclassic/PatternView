import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { NextRequest } from "next/server";
import { GET } from "./route";

const oldUrl = process.env.PATTERNVIEW_API_URL;
const oldFetch = globalThis.fetch;
afterEach(() => {
  if (oldUrl === undefined) delete process.env.PATTERNVIEW_API_URL;
  else process.env.PATTERNVIEW_API_URL = oldUrl;
  globalThis.fetch = oldFetch;
});

const candles = Array.from({ length: 40 }, (_, index) => ({
  time: 1_800_000_000 + index * 3600,
  open: 100, high: 110, low: 90, close: 105, volume: 42,
}));

test("rejects unsupported symbols without contacting backend", async () => {
  let calls = 0;
  globalThis.fetch = (async () => { calls += 1; return Response.json({}); }) as typeof fetch;
  const response = await GET(new NextRequest("http://localhost/api/market/klines?symbol=DOGEUSDT&interval=1h"));
  assert.equal(response.status, 400);
  assert.equal(calls, 0);
});

test("proxies canonical backend candles and preserves provider provenance", async () => {
  process.env.PATTERNVIEW_API_URL = "https://analysis.example";
  let requested: URL | undefined;
  globalThis.fetch = (async (input) => {
    requested = new URL(String(input));
    return Response.json({
      symbol: "BTCUSDT", timeframe: "1h", provider: "kraken",
      candles, fetched_at: 1_800_200_000, stale: false,
    });
  }) as typeof fetch;
  const response = await GET(new NextRequest("http://localhost/api/market/klines?symbol=BTCUSDT&interval=1h"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-market-data-provider"), "kraken");
  assert.equal(requested?.pathname, "/api/v1/candles");
  assert.equal(requested?.searchParams.get("timeframe"), "1h");
  const rows = await response.json();
  assert.equal(rows.length, 40);
  assert.equal(rows[0][0], candles[0].time * 1000);
});

test("fails closed when the canonical backend is not configured", async () => {
  delete process.env.PATTERNVIEW_API_URL;
  const response = await GET(new NextRequest("http://localhost/api/market/klines?symbol=ETHUSDT&interval=15m"));
  assert.equal(response.status, 503);
});

test("returns sanitized failure when backend rejects market data", async () => {
  process.env.PATTERNVIEW_API_URL = "https://analysis.example";
  globalThis.fetch = (async () => Response.json({ detail: "provider secret" }, { status: 502 })) as typeof fetch;
  const response = await GET(new NextRequest("http://localhost/api/market/klines?symbol=SOLUSDT&interval=4h"));
  assert.equal(response.status, 502);
  assert.match((await response.json()).error, /provider chain/);
});
