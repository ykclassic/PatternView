import { NextRequest, NextResponse } from "next/server";

const ALLOWED_SYMBOLS = new Set(["BTCUSDT", "ETHUSDT", "SOLUSDT"]);
const ALLOWED_INTERVALS = new Set(["15m", "1h", "4h", "1d"]);

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol") ?? "";
  const interval = request.nextUrl.searchParams.get("interval") ?? "";

  if (!ALLOWED_SYMBOLS.has(symbol) || !ALLOWED_INTERVALS.has(interval)) {
    return NextResponse.json(
      { error: "Unsupported symbol or timeframe." },
      { status: 400 },
    );
  }

  const upstreamUrl = new URL("https://api.binance.com/api/v3/klines");
  upstreamUrl.searchParams.set("symbol", symbol);
  upstreamUrl.searchParams.set("interval", interval);
  upstreamUrl.searchParams.set("limit", "300");

  try {
    const upstream = await fetch(upstreamUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
      headers: { Accept: "application/json" },
    });

    if (!upstream.ok) {
      const status = upstream.status === 429 ? 429 : 502;
      return NextResponse.json(
        {
          error:
            upstream.status === 429
              ? "Market data provider rate limit reached. Retry shortly."
              : "Market data provider is temporarily unavailable.",
        },
        { status },
      );
    }

    const payload: unknown = await upstream.json();
    if (
      !Array.isArray(payload) ||
      payload.some((row) => !Array.isArray(row) || row.length < 6)
    ) {
      return NextResponse.json(
        { error: "Market data provider returned an invalid candle payload." },
        { status: 502 },
      );
    }

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to reach the market data provider. Retry shortly." },
      { status: 502 },
    );
  }
}
