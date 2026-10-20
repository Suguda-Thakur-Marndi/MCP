"""
Integration tests for SentinelCore FastAPI application and subsystems.
Verifies route registration, health probes, and security middleware responses.
"""

import pytest
from httpx import ASGITransport, AsyncClient

from mcp_sentinel.api.app import create_app


@pytest.fixture
def api_app():
    """Provides a fresh FastAPI instance for integration testing."""
    return create_app()


@pytest.mark.asyncio
async def test_health_live_endpoint(api_app):
    """Verify decoupled liveness probe returns HTTP 200 without DB dependency."""
    transport = ASGITransport(app=api_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health/live")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        assert data.get("alive") is True


@pytest.mark.asyncio
async def test_security_headers_present(api_app):
    """Verify that SecurityHeadersMiddleware attaches standard hardening headers."""
    transport = ASGITransport(app=api_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health/live")
        headers = response.headers
        assert "x-content-type-options" in headers
        assert headers["x-content-type-options"] == "nosniff"
        assert "x-frame-options" in headers
        assert headers["x-frame-options"] == "DENY"


@pytest.mark.asyncio
async def test_registered_api_routes(api_app):
    """Verify that core security and domain routes exist and respond appropriately."""
    transport = ASGITransport(app=api_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Liveness endpoint
        live_res = await client.get("/health/live")
        assert live_res.status_code == 200

        # Unauthenticated request to protected route returns 401 or 403, proving router is registered
        auth_res = await client.get("/api/auth/me")
        assert auth_res.status_code in (401, 403)

        # Unauthenticated request to approvals returns 401
        approvals_res = await client.get("/api/approvals/pending")
        assert approvals_res.status_code in (401, 403)
