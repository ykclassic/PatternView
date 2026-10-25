import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const baseUrl = process.env.PATTERNVIEW_API_URL?.trim();
  if (!baseUrl) {
    return NextResponse.json(
      { error: "Pattern analysis API is not configured. Set PATTERNVIEW_API_URL for this deployment." },
      { status: 503 },
    );
  }
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const upstream = await fetch(new URL("/api/v1/scan", baseUrl), {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal,
    });
    const payload = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      const status = upstream.status === 400 || upstream.status === 422 ? upstream.status :
        upstream.status === 503 ? 503 : 502;
      return NextResponse.json(
        { error: status === 503 ? "Pattern analysis persistence is unavailable." :
          status === 400 || status === 422 ? "Invalid scan request." : "Pattern analysis service is temporarily unavailable." },
        { status },
      );
    }
    return NextResponse.json(payload, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json(
      { error: "Pattern analysis service is temporarily unavailable." },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}
