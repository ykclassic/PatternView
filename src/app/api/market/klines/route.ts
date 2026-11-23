import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYMBOLS = new Set(["BTCUSDT", "ETHUSDT", "SOLUSDT"]);
const INTERVALS = new Set(["15m", "1h", "4h", "1d"]);
const REQUEST_TIMEOUT_MS = 8_000;

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol") ?? "";
  const interval = request.nextUrl.searchParams.get("interval") ?? "";
  if (!SYMBOLS.has(symbol) || !INTERVALS.has(interval)) {
    return jsonError("Unsupported symbol or timeframe.", 400);
  }

  const configuredOrigin = process.env.PATTERNVIEW_API_URL?.trim();
  if (!configuredOrigin) {
    return jsonError("Market data API is not configured for this deployment.", 503);
  }

  let origin: URL;
  try {
    origin = new URL(configuredOrigin);
    const localHttp = origin.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);
    if ((!localHttp && origin.protocol !== "https:") || origin.username || origin.password ||
      origin.search || origin.hash || (origin.pathname !== "/" && origin.pathname !== "")) {
      return jsonError("Market data API configuration is invalid.", 503);
    }
  } catch {
    return jsonError("Market data API configuration is invalid.", 503);
  }

  try {
    const upstreamUrl = new URL("/api/v1/candles", origin.origin);
    upstreamUrl.searchParams.set("symbol", symbol);
    upstreamUrl.searchParams.set("timeframe", interval);
    upstreamUrl.searchParams.set("limit", "300");
    const upstream = await fetch(upstreamUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const payload: unknown = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      const status = upstream.status === 400 || upstream.status === 422 ? upstream.status : 502;
      return jsonError(
        status === 400 ? "Unsupported market-data request." :
          "Market data is unavailable from the configured provider chain.",
        status,
      );
    }
    if (typeof payload !== "object" || payload === null || !("candles" in payload) ||
      !Array.isArray(payload.candles) || !("provider" in payload) ||
      typeof payload.provider !== "string") {
      return jsonError("Market data API returned an invalid response.", 502);
    }

    const rows = payload.candles.map((item) => {
      if (typeof item !== "object" || item === null) throw new Error("invalid_candle");
      const candle = item as Record<string, unknown>;
      const values = [candle.time, candle.open, candle.high, candle.low, candle.close, candle.volume].map(Number);
      if (!values.every(Number.isFinite) || values[0] <= 0) throw new Error("invalid_candle");
      return [values[0] * 1000, String(values[1]), String(values[2]), String(values[3]), String(values[4]), String(values[5])];
    });
    return NextResponse.json(rows, {
      headers: {
        "Cache-Control": "no-store",
        "X-Market-Data-Provider": payload.provider,
      },
    });
  } catch {
    return jsonError("Market data API request timed out or could not be reached.", 502);
  }
}
