"""Small per-process API rate limiter; production gateways may add distributed limits."""
from __future__ import annotations

import time
from collections import deque
from typing import Deque

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

RATE_WINDOW_SECONDS = 60.0
EXEMPT_PATHS = {"/health", "/ready", "/openapi.json", "/docs", "/docs/oauth2-redirect"}
_REQUESTS: dict[str, Deque[float]] = {}


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        if request.url.path in EXEMPT_PATHS:
            return await call_next(request)

        client = request.client.host if request.client else "unknown"
        now = time.monotonic()
        bucket = _REQUESTS.setdefault(client, deque())
        while bucket and now - bucket[0] >= RATE_WINDOW_SECONDS:
            bucket.popleft()

        # Keep memory bounded if many distinct client addresses appear.
        if len(_REQUESTS) > 5_000:
            expired_before = now - RATE_WINDOW_SECONDS
            for address in list(_REQUESTS):
                times = _REQUESTS[address]
                while times and times[0] < expired_before:
                    times.popleft()
                if not times:
                    _REQUESTS.pop(address, None)

        limit = max(1, int(getattr(request.app.state, "rate_limit_requests_per_minute", 120)))
        if len(bucket) >= limit:
            retry_after = max(1, int(RATE_WINDOW_SECONDS - (now - bucket[0])))
            return JSONResponse(
                status_code=429,
                headers={"Retry-After": str(retry_after), "Cache-Control": "no-store"},
                content={
                    "detail": {
                        "code": "rate_limited",
                        "message": "Too many requests. Try again shortly.",
                    }
                },
            )
        bucket.append(now)
        return await call_next(request)
