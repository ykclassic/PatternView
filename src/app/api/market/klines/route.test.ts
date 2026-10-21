import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { NextRequest } from "next/server";
import { GET } from "./route";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test("rejects unsupported symbols without contacting upstream", async () => {
  let calls = 0;
  globalThis.fetch = (async () => { calls += 1; return Response.json([]); }) as typeof fetch;
  const response = await GET(new NextRequest("http://localhost/api/market/klines?symbol=DOGEUSDT&interval=1h"));
  assert.equal(response.status, 400);
  assert.equal(calls, 0);
});

test("returns candles when at least one Binance API host succeeds", async () => {
  globalThis.fetch = (async (input) => {
    if (String(input).startsWith("https://api.binance.com/")) return new Response(null, { status: 503 });
    return Response.json([[1, "100", "110", "90", "105", "42"]]);
  }) as typeof fetch;
  const response = await GET(new NextRequest("http://localhost/api/market/klines?symbol=BTCUSDT&interval=1h"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), [[1, "100", "110", "90", "105", "42"]]);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("returns sanitized 502 when all Binance API hosts fail", async () => {
  globalThis.fetch = (async () => new Response(null, { status: 503 })) as typeof fetch;
  const response = await GET(new NextRequest("http://localhost/api/market/klines?symbol=ETHUSDT&interval=15m"));
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { error: "Market data provider is temporarily unavailable." });
});

test("rejects malformed upstream payloads", async () => {
  globalThis.fetch = (async () => Response.json({ code: -1 })) as typeof fetch;
  const response = await GET(new NextRequest("http://localhost/api/market/klines?symbol=SOLUSDT&interval=4h"));
  assert.equal(response.status, 502);
});
