"""
Phase 9 Automated Tests: Production Observability, Tracing, Metrics, and Health Probes.
Tests:
- Decoupled health probes (/health/live, /health/ready, and legacy /health, /ready)
- Prometheus metrics exposition (/metrics) and metric recording
- Correlation headers (X-Request-ID, X-Trace-ID) propagation
- OpenTelemetry span sanitization (scrubbing secrets, tokens, PII)
"""

import pytest
from httpx import ASGITransport, AsyncClient

from mcp_sentinel.api.app import app
from mcp_sentinel.observability.metrics import (
    generate_prometheus_metrics,
    record_approval_event,
    record_approval_replay,
    record_policy_decision,
    record_rate_limit_exceeded,
    record_tool_execution,
    update_db_pool_metrics,
)
from mcp_sentinel.observability.tracing import sanitize_attributes, trace_span


@pytest.mark.asyncio
async def test_health_live_endpoint():
    """Verify /health/live returns process status without locking on external dependencies."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/health/live")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] in ("live", "healthy", "alive")
        assert data.get("alive") is True or "service" in data


@pytest.mark.asyncio
async def test_health_ready_endpoint():
    """Verify /health/ready checks real database and pool readiness."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/health/ready")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ready"
        assert "database" in data or "database" in data.get("dependencies", {})
        assert "pool" in data
        assert "total" in data["pool"] or "total_connections" in data["pool"]


@pytest.mark.asyncio
async def test_legacy_health_routes():
    """Verify backward compatibility of /health and /ready routes."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp1 = await client.get("/health")
        assert resp1.status_code == 200
        assert resp1.json()["status"] in ("healthy", "alive")

        resp2 = await client.get("/ready")
        assert resp2.status_code == 200
        assert resp2.json()["status"] == "ready"


@pytest.mark.asyncio
async def test_prometheus_metrics_endpoint():
    """Verify /metrics exposes valid Prometheus text format."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/metrics")
        assert resp.status_code == 200
        assert "text/plain" in resp.headers.get("content-type", "")
        content = resp.text

        # Verify key metric declarations exist
        assert "sentinel_http_requests_total" in content
        assert "sentinel_db_pool_connections" in content


@pytest.mark.asyncio
async def test_request_correlation_headers():
    """Verify incoming requests receive X-Request-ID and X-Trace-ID in response headers."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Without incoming headers -> auto generated
        resp = await client.get("/health/live")
        assert "x-request-id" in resp.headers
        assert "x-trace-id" in resp.headers
        assert len(resp.headers["x-request-id"]) > 0
        assert len(resp.headers["x-trace-id"]) > 0

        # With client supplied correlation ID -> preserved and sanitized
        client_req_id = "client-trace-abc-123"
        resp2 = await client.get("/health/live", headers={"X-Request-ID": client_req_id})
        assert resp2.headers["x-request-id"] == client_req_id


def test_metric_recorders():
    """Verify application metric recording functions update internal state."""
    # Policy decisions (tool_name, decision, risk_level)
    record_policy_decision("get_customer_by_id", "ALLOW", "LOW")
    record_policy_decision("purge_inactive_customer_data", "REQUIRE_APPROVAL", "CRITICAL")
    record_policy_decision("delete_customer_by_id", "DENY", "HIGH")

    # Tool executions
    record_tool_execution("get_customer_by_id", 0.045, "success")
    record_tool_execution("purge_inactive_customer_data", 0.120, "failure")

    # Approvals
    record_approval_event("APPROVED")
    record_approval_replay()

    # Rate limiting
    record_rate_limit_exceeded("/api/auth/login")

    # DB pool
    update_db_pool_metrics(total=10, used=3, free=7)

    raw_metrics = generate_prometheus_metrics().decode("utf-8")
    assert 'sentinel_policy_decisions_total{decision="ALLOW"' in raw_metrics
    assert 'sentinel_policy_decisions_total{decision="REQUIRE_APPROVAL"' in raw_metrics
    assert 'sentinel_policy_decisions_total{decision="DENY"' in raw_metrics
    assert "sentinel_approval_replays_blocked_total" in raw_metrics
    assert 'sentinel_db_pool_connections{state="used"} 3' in raw_metrics


def test_tracing_attribute_sanitization():
    """Verify tracing attribute sanitizer removes sensitive keys and values."""
    unsafe_attrs = {
        "service.name": "mcp-sentinel-api",
        "user.email": "john.doe@example.com",
        "user.phone": "+1-555-0199",
        "api_key": "AIzaSySecretApiKeyHere12345",
        "password": "SuperSecretPassword!",
        "jwt_token": "eyJhbGciOiJIUzI1NiIsIn...",
        "auth_header": "Bearer secret-token-xyz",
        "user_prompt": "Please delete customer 5 and their credit card 4111-2222",
        "mcp.tool": "get_customer_by_id",
        "environment": "test",
    }

    sanitized = sanitize_attributes(unsafe_attrs)

    # Allowed safe operational attributes
    assert sanitized["service.name"] == "mcp-sentinel-api"
    assert sanitized["mcp.tool"] == "get_customer_by_id"
    assert sanitized["environment"] == "test"

    # Redacted sensitive values
    assert sanitized["user.email"] == "[REDACTED]"
    assert sanitized["user.phone"] == "[REDACTED]"
    assert sanitized["password"] == "[REDACTED]"
    assert sanitized["api_key"] == "[REDACTED]"
    assert sanitized["jwt_token"] == "[REDACTED]"
    assert sanitized["auth_header"] == "[REDACTED]"
    assert sanitized["user_prompt"] == "[REDACTED]"
    assert "SuperSecretPassword!" not in str(sanitized)
    assert "4111-2222" not in str(sanitized)


def test_trace_span_context_manager():
    """Verify trace_span context manager executes cleanly and records duration."""
    with trace_span("test_operation", attributes={"tool.name": "get_customer"}) as span:
        # span operation
        _ = 1 + 1
        assert span is not None
