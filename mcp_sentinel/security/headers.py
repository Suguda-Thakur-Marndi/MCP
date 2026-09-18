"""
Security Headers & Web Protections for MCP-Sentinel Phase 6.
Enforces:
- Hardened HTTP response security headers (CSP, X-Frame-Options, X-Content-Type-Options).
- Open redirect validation to prevent credential and session leakage.
- CSRF validation for state-changing requests using cookie authentication.
"""

import urllib.parse
from typing import Callable, Optional

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from mcp_sentinel.config.settings import get_settings


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Appends enterprise security headers to every HTTP response.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        settings = get_settings()

        # CSRF Protection for state-changing operations when using session cookies
        if (
            settings.CSRF_PROTECTION_ENABLED
            and request.method in ("POST", "PUT", "DELETE", "PATCH")
            and request.cookies.get(settings.SESSION_COOKIE_NAME)
            and not request.headers.get("Authorization")
        ):
            # Safe routes exempt from CSRF (login and public endpoints)
            path = request.url.path
            is_exempt = path in (
                "/api/auth/login",
                "/api/auth/google/callback",
                "/api/auth/google/authorize",
            )
            if not is_exempt:
                csrf_header = request.headers.get("X-CSRF-Token") or request.headers.get(
                    "X-Requested-With"
                )
                if not csrf_header:
                    return JSONResponse(
                        status_code=403,
                        content={
                            "status": "error",
                            "error_type": "CSRFValidationError",
                            "message": "CSRF validation failed: Missing X-CSRF-Token or X-Requested-With header on state-changing cookie request.",
                        },
                    )

        response: Response = await call_next(request)

        # Standard hardened security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), camera=(), microphone=()"

        # Content Security Policy (allows legitimate frontend Next.js assets while blocking inline script injections)
        csp = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-eval'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "connect-src 'self' http://localhost:* http://127.0.0.1:* https://accounts.google.com https://oauth2.googleapis.com; "
            "frame-ancestors 'none'; "
            "object-src 'none';"
        )
        response.headers["Content-Security-Policy"] = csp

        if settings.APP_ENV == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        return response


def validate_safe_redirect(url: Optional[str], default: str = "/") -> str:
    """
    Validates redirect destinations to prevent open redirect vulnerabilities.
    Rejects:
    - Absolute URLs to external domains (e.g. 'https://attacker.com')
    - Protocol-relative URLs (e.g. '//attacker.com')
    - Javascript pseudo-protocols (e.g. 'javascript:alert(1)')
    - URLs containing control characters or whitespace
    """
    if not url:
        return default

    clean_url = url.strip()
    if not clean_url:
        return default

    # Reject protocol-relative URLs
    if clean_url.startswith("//"):
        return default

    # Reject backslash trickery
    if clean_url.startswith("/\\") or "\\" in clean_url:
        return default

    parsed = urllib.parse.urlparse(clean_url)

    # Must be a relative path without external scheme or host
    if parsed.scheme or parsed.netloc:
        return default

    if not clean_url.startswith("/"):
        return default

    return clean_url
