import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { NextRequest } from "next/server";
import { GET } from "./route";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

const binanceRow = [1_800_000_000_000, "100", "110", "90", "105", "42"];
const krakenPayload = {
  error: [],
  result: {
    XXBTZUSDT: [
      [1_800_000_000, "100", "110", "90", "105", "103", "42", 8],
      [1_800_000_900, "105", "112", "101", "108", "106", "12", 5],
    ],
    last: 1_800_000_900,
  },
};

test("rejects unsupported symbols without contacting upstream", async () => {
  let calls = 0;
  globalThis.fetch = (async () => { calls += 1; return Response.json([]); }) as typeof fetch;
  const response = await GET(new NextRequest("http://localhost/api/market/klines?symbol=DOGEUSDT&interval=1h"));
  assert.equal(response.status, 400);
  assert.equal(calls, 0);
});

test("returns Binance candles when a Binance host succeeds", async () => {
  globalThis.fetch = (async (input) => {
    if (String(input).startsWith("https://api.binance.com/")) return new Response(null, { status: 503 });
    return Response.json([binanceRow]);
  }) as typeof fetch;
  const response = await GET(new NextRequest("http://localhost/api/market/klines?symbol=BTCUSDT&interval=1h"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-market-data-provider"), "binance");
  assert.deepEqual(await response.json(), [binanceRow]);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("falls back to Kraken and converts its candle format", async () => {
  globalThis.fetch = (async (input) => {
    if (String(input).toString().includes("api.kraken.com")) return Response.json(krakenPayload);
    return new Response(null, { status: 503 });
  }) as typeof fetch;
  const response = await GET(new NextRequest("http://localhost/api/market/klines?symbol=BTCUSDT&interval=15m"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-market-data-provider"), "kraken");
  const candles = await response.json();
  assert.equal(candles.length, 1, "the still-open Kraken candle must be discarded");
  assert.deepEqual(candles[0], [1_800_000_000_000, "100", "110", "90", "105", "42"]);
});

test("returns sanitized 502 only after all supported providers fail", async () => {
  globalThis.fetch = (async () => new Response("private upstream detail", { status: 503 })) as typeof fetch;
  const response = await GET(new NextRequest("http://localhost/api/market/klines?symbol=ETHUSDT&interval=15m"));
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), {
    error: "Market data is temporarily unavailable from all supported providers.",
  });
});

test("rejects malformed Binance data and tries Kraken", async () => {
  globalThis.fetch = (async (input) => {
    if (String(input).includes("api.kraken.com")) return Response.json(krakenPayload);
    return Response.json({ code: -1 });
  }) as typeof fetch;
  const response = await GET(new NextRequest("http://localhost/api/market/klines?symbol=SOLUSDT&interval=4h"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-market-data-provider"), "kraken");
});

test("does not return malformed Kraken candle data", async () => {
  globalThis.fetch = (async (input) => {
    if (String(input).includes("api.kraken.com")) {
      return Response.json({ error: [], result: { SOLUSDT: [["bad"], ["bad"]], last: 1 } });
    }
    return new Response(null, { status: 503 });
  }) as typeof fetch;
  const response = await GET(new NextRequest("http://localhost/api/market/klines?symbol=SOLUSDT&interval=1d"));
  assert.equal(response.status, 502);
});
