"""
Phase 9 Automated Tests: Operational Resilience, Rate Limiting, and Production Fail-Fast Validation.
Tests:
- Rate limiting middleware (HTTP 429 on abuse, Retry-After header)
- Production configuration fail-fast checks (rejecting test auth, weak secrets, wildcard CORS)
- Database connection pool health reporting and failure handling
"""

import pytest
from httpx import ASGITransport, AsyncClient

from mcp_sentinel.api.app import app
from mcp_sentinel.config.settings import Settings, validate_production_startup
from mcp_sentinel.database.connection import get_pool_status
from mcp_sentinel.security.rate_limiter import RateLimiter


@pytest.mark.asyncio
async def test_rate_limiter_sliding_window_unit():
    """Verify RateLimiter sliding window enforces request count within window seconds."""
    limiter = RateLimiter(requests_per_window=3, window_seconds=10)
    key = "test-client-ip"

    # 3 allowed
    assert limiter.is_allowed(key) is True
    assert limiter.is_allowed(key) is True
    assert limiter.is_allowed(key) is True

    # 4th blocked
    assert limiter.is_allowed(key) is False
    assert limiter.get_retry_after(key) > 0


@pytest.mark.asyncio
async def test_api_rate_limiting_enforcement():
    """Verify rate-limited endpoints trigger HTTP 429 when threshold exceeded."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Rapidly attempt logins with test client
        status_codes = []
        for _ in range(12):
            resp = await client.post(
                "/api/auth/login",
                json={"email": "attacker@example.com", "password": "wrong"},
            )
            status_codes.append(resp.status_code)

        # At least one request should have hit 429 Too Many Requests
        assert 429 in status_codes

        # Non-rate-limited endpoint (/health/live) must still remain available
        live_resp = await client.get("/health/live")
        assert live_resp.status_code == 200


def test_production_startup_validation_rejects_test_auth():
    """Production mode must fail fast if ENABLE_TEST_AUTH is True."""
    insecure_settings = Settings(
        APP_ENV="production",
        ENABLE_TEST_AUTH=True,
        JWT_SECRET_KEY="a" * 64,
        SESSION_COOKIE_SECURE=True,
        ALLOWED_CORS_ORIGINS=["https://sentinel.example.com"],
    )
    with pytest.raises((RuntimeError, ValueError), match="ENABLE_TEST_AUTH"):
        validate_production_startup(insecure_settings)


def test_production_startup_validation_rejects_weak_jwt_secret():
    """Production mode must fail fast if JWT_SECRET_KEY is short or contains dev defaults."""
    insecure_settings = Settings(
        APP_ENV="production",
        ENABLE_TEST_AUTH=False,
        JWT_SECRET_KEY="short-secret",
        SESSION_COOKIE_SECURE=True,
        ALLOWED_CORS_ORIGINS=["https://sentinel.example.com"],
    )
    with pytest.raises((RuntimeError, ValueError), match="JWT_SECRET_KEY"):
        validate_production_startup(insecure_settings)


def test_production_startup_validation_rejects_wildcard_cors():
    """Production mode must fail fast if CORS allows '*' with credential support."""
    insecure_settings = Settings(
        APP_ENV="production",
        ENABLE_TEST_AUTH=False,
        JWT_SECRET_KEY="a" * 64,
        SESSION_COOKIE_SECURE=True,
        ALLOWED_CORS_ORIGINS=["*"],
    )
    with pytest.raises((RuntimeError, ValueError), match="CORS"):
        validate_production_startup(insecure_settings)


def test_production_startup_validation_rejects_insecure_cookies():
    """Production mode must fail fast if SESSION_COOKIE_SECURE is False."""
    insecure_settings = Settings(
        APP_ENV="production",
        ENABLE_TEST_AUTH=False,
        JWT_SECRET_KEY="a" * 64,
        SESSION_COOKIE_SECURE=False,
        ALLOWED_CORS_ORIGINS=["https://sentinel.example.com"],
    )
    with pytest.raises((RuntimeError, ValueError), match="SESSION_COOKIE_SECURE"):
        validate_production_startup(insecure_settings)


def test_production_startup_validation_passes_valid_config():
    """Production validation succeeds when all hardening requirements are satisfied."""
    valid_settings = Settings(
        APP_ENV="production",
        ENABLE_TEST_AUTH=False,
        JWT_SECRET_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        SESSION_COOKIE_SECURE=True,
        ALLOWED_CORS_ORIGINS=["https://sentinel.example.com"],
    )
    # Should not raise
    validate_production_startup(valid_settings)


def test_db_pool_status_reporting():
    """Verify get_pool_status() returns dictionary with connection counts."""
    status = get_pool_status()
    assert isinstance(status, dict)
    assert "total_connections" in status
    assert "used_connections" in status
    assert "free_connections" in status
    assert status["total_connections"] >= 0
