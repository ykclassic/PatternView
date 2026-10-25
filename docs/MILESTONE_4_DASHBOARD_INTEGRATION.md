# Milestone 4 — Dashboard and backend integration

The dashboard calls the versioned FastAPI scan endpoint through a same-origin Next.js route. The browser never receives the backend origin, and the proxy applies a bounded timeout, no-store semantics, and sanitized upstream errors. The existing chart candle view remains read-only; scan interpretation comes from the backend engine and no client-side fallback is used when the backend is unavailable.

Configure `PATTERNVIEW_API_URL` in the Next.js/Vercel runtime with the HTTPS origin of the separately deployed backend (origin only, no path). The backend API must be deployed and reachable before integrated scanning works. Public market candles are still fetched through the existing same-origin market-data route.

The dashboard displays deterministic quality scoring as a heuristic, uses the API's rule version and provider provenance in scan history, and distinguishes actual backend persistence from browser-local history. Automated execution, exchange credentials, and order endpoints are intentionally out of scope.

See [the UI design system and responsive specification](DESIGN_SYSTEM.md). Desktop/mobile screenshot and interaction checks remain production acceptance items until evidence is recorded.
