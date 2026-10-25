import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const SYMBOLS = new Set(["BTCUSDT", "ETHUSDT", "SOLUSDT"]);
const TIMEFRAMES = new Set(["15m", "1h", "4h", "1d"]);
const MAX_BODY_BYTES = 16 * 1024;
function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: {
    "cache-control": "no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer",
  } });
}
export async function POST(request: NextRequest) {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) return jsonError("Scan request is too large.", 413);
  let body: unknown;
  try { body = await request.json(); } catch { return jsonError("Invalid JSON request body.", 400); }
  if (typeof body !== "object" || body === null || Array.isArray(body)) return jsonError("Invalid scan request.", 400);
  const input = body as Record<string, unknown>;
  if (typeof input.symbol !== "string" || !SYMBOLS.has(input.symbol) ||
      typeof input.timeframe !== "string" || !TIMEFRAMES.has(input.timeframe) ||
      (input.limit !== undefined && (typeof input.limit !== "number" || !Number.isInteger(input.limit) ||
        input.limit < 40 || input.limit > 720))) {
    return jsonError("Unsupported symbol, timeframe, or candle limit.", 400);
  }
  const baseUrl = process.env.PATTERNVIEW_API_URL?.trim();
  if (!baseUrl) return jsonError("Pattern analysis API is not configured for this deployment.", 503);
  let origin: URL;
  try {
    origin = new URL(baseUrl);
    const localHttp = origin.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);
    if ((!localHttp && origin.protocol !== "https:") || origin.username || origin.password ||
        origin.search || origin.hash || (origin.pathname !== "/" && origin.pathname !== "")) {
      return jsonError("Pattern analysis API configuration is invalid.", 503);
    }
  } catch { return jsonError("Pattern analysis API configuration is invalid.", 503); }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const upstream = await fetch(new URL("/api/v1/scan", origin.origin), {
      method: "POST", headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ symbol: input.symbol, timeframe: input.timeframe, limit: input.limit ?? 300 }),
      cache: "no-store", signal: controller.signal,
    });
    const payload = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      const status = upstream.status === 400 || upstream.status === 422 ? upstream.status : upstream.status === 503 ? 503 : 502;
      return jsonError(status === 503 ? "Pattern analysis persistence is unavailable." :
        status === 400 || status === 422 ? "Invalid scan request." : "Pattern analysis service is temporarily unavailable.", status);
    }
    return NextResponse.json(payload, { headers: {
      "cache-control": "no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer",
    } });
  } catch { return jsonError("Pattern analysis service is temporarily unavailable.", 502); }
  finally { clearTimeout(timeout); }
}
