import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { NextRequest } from "next/server";
import { POST } from "./route";

const oldUrl = process.env.PATTERNVIEW_API_URL;
const oldFetch = globalThis.fetch;
afterEach(() => {
  if (oldUrl === undefined) delete process.env.PATTERNVIEW_API_URL;
  else process.env.PATTERNVIEW_API_URL = oldUrl;
  globalThis.fetch = oldFetch;
});

function request(body: string, contentLength?: string) {
  return new NextRequest("http://localhost/api/analysis/scan", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(contentLength ? { "content-length": contentLength } : {}),
    },
    body,
  });
}

test("rejects unsupported symbols before contacting the backend", async () => {
  delete process.env.PATTERNVIEW_API_URL;
  const response = await POST(request(JSON.stringify({ symbol: "DOGEUSDT", timeframe: "1h" })));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Unsupported symbol, timeframe, or candle limit." });
});

test("rejects oversized declared request bodies", async () => {
  const response = await POST(request("{}", "20000"));
  assert.equal(response.status, 413);
});

test("fails closed with a sanitized error when the API origin is not configured", async () => {
  delete process.env.PATTERNVIEW_API_URL;
  const response = await POST(request(JSON.stringify({ symbol: "BTCUSDT", timeframe: "1h" })));
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /not configured/);
});

test("rejects non-HTTPS non-local API origins", async () => {
  process.env.PATTERNVIEW_API_URL = "http://example.com";
  const response = await POST(request(JSON.stringify({ symbol: "BTCUSDT", timeframe: "1h" })));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "Pattern analysis API configuration is invalid." });
});

test("sanitizes upstream failures instead of forwarding exception text", async () => {
  process.env.PATTERNVIEW_API_URL = "https://analysis.example";
  globalThis.fetch = (async () => { throw new Error("secret token db password"); }) as typeof fetch;
  const response = await POST(request(JSON.stringify({ symbol: "BTCUSDT", timeframe: "1h" })));
  assert.equal(response.status, 502);
  const payload = await response.json();
  assert.equal(payload.error, "Pattern analysis service is temporarily unavailable.");
  assert.equal(JSON.stringify(payload).includes("secret token"), false);
});
