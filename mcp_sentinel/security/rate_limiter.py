"""
Production-grade Sliding Window Rate Limiter for MCP-Sentinel.
Adheres to:
- Bounded rate limiting for sensitive endpoints (auth, agent, eval, approvals).
- In-memory thread-safe sliding window (no external Redis dependency required).
- Bypass in test environment (APP_ENV=test).
- Legitimate human approval workflows are never blocked under normal operator pace.
"""

import threading
import time
from collections import defaultdict
from typing import Any, Optional

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, Response

from mcp_sentinel.config.settings import get_settings


class SlidingWindowRateLimiter:
    """
    Thread-safe sliding window rate limiter tracking request timestamps per identity key.
    """

    def __init__(self, requests_per_window: int = 100, window_seconds: int = 60):
        self._lock = threading.Lock()
        self.default_requests_per_window = requests_per_window
        self.default_window_seconds = window_seconds
        # map: key -> list of timestamp floats
        self._windows: dict[str, list[float]] = defaultdict(list)

    def is_allowed(
        self,
        key: str,
        max_requests: Optional[int] = None,
        window_seconds: Optional[int] = None,
    ) -> Any:
        """
        Checks if the request is permitted within the sliding window.
        Returns bool when using default limits, or (bool, int) when explicit limits are passed.
        """
        limit = max_requests if max_requests is not None else self.default_requests_per_window
        window = window_seconds if window_seconds is not None else self.default_window_seconds

        now = time.time()
        cutoff = now - window

        with self._lock:
            # Clean expired timestamps
            timestamps = self._windows[key]
            valid = [ts for ts in timestamps if ts > cutoff]

            if len(valid) >= limit:
                # Calculate oldest request expiration
                oldest = valid[0]
                retry_after = max(1, int(oldest + window - now))
                self._windows[key] = valid
                if max_requests is None:
                    return False
                return False, retry_after

            valid.append(now)
            self._windows[key] = valid
            if max_requests is None:
                return True
            return True, 0

    def reset_for_testing(self) -> None:
        """Clears all windows for testing."""
        with self._lock:
            self._windows.clear()

    def get_retry_after(self, key: str, window_seconds: int = 60) -> int:
        now = time.time()
        with self._lock:
            timestamps = self._windows.get(key, [])
            if not timestamps:
                return 0
            oldest = timestamps[0]
            return max(1, int(oldest + window_seconds - now))


# Alias for backward and testing compatibility
RateLimiter = SlidingWindowRateLimiter


# Default rate limits per path pattern: (max_requests, window_seconds)
ROUTE_LIMITS: dict[str, tuple[int, int]] = {
    "/api/auth/login": (5, 60),  # Brute-force protection: 5 logins/min
    "/api/agent/chat": (30, 60),  # Expensive LLM calls: 30/min
    "/api/security-tests/runs": (5, 60),  # Heavy benchmark runs: 5/min
    "/api/approvals": (30, 60),  # Human approvals: 30/min
}

# Module singleton
_rate_limiter = SlidingWindowRateLimiter()


def get_rate_limiter() -> SlidingWindowRateLimiter:
    return _rate_limiter


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Applies route-specific rate limits to protect APIs from abuse.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        settings = get_settings()

        # Completely bypass in test environment or if explicitly disabled
        if settings.APP_ENV == "test":
            return await call_next(request)

        path = request.url.path

        # Find matching route limit
        limit_spec: Optional[tuple[int, int]] = None
        for pattern, spec in ROUTE_LIMITS.items():
            if path.startswith(pattern):
                limit_spec = spec
                break

        if limit_spec is not None:
            max_reqs, window_secs = limit_spec

            # Derive client identity (authenticated token hash or client IP)
            auth_header = request.headers.get("Authorization", "")
            client_ip = request.client.host if request.client else "unknown"
            identity = f"{path}:{auth_header[:16] if auth_header else client_ip}"

            limiter = get_rate_limiter()
            allowed, retry_after = limiter.is_allowed(identity, max_reqs, window_secs)

            if not allowed:
                return JSONResponse(
                    status_code=429,
                    content={
                        "status": "error",
                        "error_type": "RateLimitExceededError",
                        "message": f"Rate limit exceeded for endpoint. Please retry after {retry_after} seconds.",
                        "retry_after": retry_after,
                    },
                    headers={"Retry-After": str(retry_after)},
                )

        return await call_next(request)
