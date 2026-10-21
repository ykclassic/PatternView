import { NextRequest, NextResponse } from "next/server";

const ALLOWED_SYMBOLS = new Set(["BTCUSDT", "ETHUSDT", "SOLUSDT"]);
const ALLOWED_INTERVALS = new Set(["15m", "1h", "4h", "1d"]);
const BINANCE_API_HOSTS = [
  "https://api.binance.com",
  "https://api1.binance.com",
  "https://api2.binance.com",
  "https://api3.binance.com",
] as const;

type KlinePayload = unknown[][];

async function fetchValidKlines(
  host: string,
  symbol: string,
  interval: string,
): Promise<KlinePayload> {
  const upstreamUrl = new URL("/api/v3/klines", host);
  upstreamUrl.searchParams.set("symbol", symbol);
  upstreamUrl.searchParams.set("interval", interval);
  upstreamUrl.searchParams.set("limit", "300");

  const upstream = await fetch(upstreamUrl, {
    cache: "no-store",
    signal: AbortSignal.timeout(4_000),
    headers: { Accept: "application/json" },
  });

  if (!upstream.ok) {
    throw new Error(`upstream_http_${upstream.status}`);
  }

  const payload: unknown = await upstream.json();
  if (
    !Array.isArray(payload) ||
    payload.length === 0 ||
    payload.some(
      (row) =>
        !Array.isArray(row) ||
        row.length < 6 ||
        row.slice(0, 6).some((value) => !Number.isFinite(Number(value))),
    )
  ) {
    throw new Error("invalid_upstream_payload");
  }

  return payload as KlinePayload;
}

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol") ?? "";
  const interval = request.nextUrl.searchParams.get("interval") ?? "";

  if (!ALLOWED_SYMBOLS.has(symbol) || !ALLOWED_INTERVALS.has(interval)) {
    return NextResponse.json(
      { error: "Unsupported symbol or timeframe." },
      { status: 400 },
    );
  }

  // Binance publishes equivalent market-data API hosts. Race the read-only
  // requests so a regional or transient failure at one host does not break the UI.
  const attempts = await Promise.allSettled(
    BINANCE_API_HOSTS.map((host) => fetchValidKlines(host, symbol, interval)),
  );
  const successful = attempts.find(
    (attempt): attempt is PromiseFulfilledResult<KlinePayload> =>
      attempt.status === "fulfilled",
  );

  if (successful) {
    return NextResponse.json(successful.value, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  const allRateLimited = attempts.every(
    (attempt) =>
      attempt.status === "rejected" &&
      attempt.reason instanceof Error &&
      attempt.reason.message === "upstream_http_429",
  );

  return NextResponse.json(
    {
      error: allRateLimited
        ? "Market data provider rate limit reached. Retry shortly."
        : "Market data provider is temporarily unavailable.",
    },
    { status: allRateLimited ? 429 : 502 },
  );
}
