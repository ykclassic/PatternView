# Milestone 5 — Historical validation, QA and security hardening

## Automated checks
- Frontend tests cover backend response mapping, malformed response rejection, fail-closed behavior, proxy input allowlists, request-size checks, HTTPS-origin validation, and sanitized upstream errors.
- Backend CI covers normalized OHLCV contracts, market-provider failover, scan request bounds, persistence behavior, detector regression tests, CORS allowlisting, and rate-limit responses.
- The scan proxy rejects unsupported symbols/timeframes, non-integer or out-of-range limits, oversized declared request bodies, and non-HTTPS remote backend origins. It uses a fixed upstream path, bounded timeout, no-store semantics, and does not forward upstream exception text.
- Backend CORS is configured through `CORS_ORIGINS`; credentials are disabled and wildcard origins are not accepted.
- The API has a per-process sliding-window rate limiter configured by `RATE_LIMIT_PER_MINUTE` (default 120 requests/minute per client address). Health/readiness probes remain available during throttling. This in-process limiter is not a distributed quota; a shared gateway limit is recommended if the service scales to multiple instances.

## Historical accuracy gate — NOT YET PASSED
The frozen historical dataset and prediction artifacts are available in the repository workflow history, but the independent annotation file remains a template rather than adjudicated labels. Precision, recall, false-positive rate, and pattern-specific thresholds must not be reported as validated until independent annotators label the blind test split and the evaluation script verifies label and prediction provenance. Do not tune against the blind test split.

## Known limitations
- Pattern quality scores are heuristic rankings, not calibrated probabilities.
- Automated tests establish deterministic contracts, not market prediction accuracy.
- Live provider integration, deployment configuration, and runtime smoke tests remain separate acceptance gates.
- No trade execution or order submission is part of the application.
