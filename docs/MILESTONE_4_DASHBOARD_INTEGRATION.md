# Milestone 4 — Dashboard and backend integration

The dashboard now calls the versioned FastAPI scan endpoint through a same-origin Next.js route. The browser never receives the backend origin, and the proxy applies a bounded timeout, no-store semantics, and sanitized upstream errors. The existing chart candle view remains read-only; scan interpretation comes from the backend engine and no client-side fallback is used when the backend is unavailable.

Configure `PATTERNVIEW_API_URL` in the Next.js/Vercel runtime with the HTTPS origin of the separately deployed backend (origin only, no path). The backend API must be deployed and reachable before integrated scanning works. Public market candles are still fetched through the existing same-origin market-data route.

The UI continues to present conditional levels as analysis only. Quality scores are not represented as probabilities. Automated execution, exchange credentials, and order endpoints are intentionally out of scope.
