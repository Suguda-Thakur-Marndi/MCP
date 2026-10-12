"""
Phase 14 Production Readiness, Security, Reliability & Operations Test Suite.
Validates:
1. Strict Production Authentication: Rejection of test bypass headers and mock tokens in production mode.
2. Comprehensive RBAC Enforcement: Strict authorization checks across all sensitive endpoints.
3. Tool Argument Schema Validation: Stage 3 validation of required fields and strict parameter types.
4. Idempotency Key Deduplication: Safe duplicate execution prevention.
5. Bounded Execution Timeouts: Guaranteed cancellation and graceful failure on tool and agent timeouts.
6. Foundation Model Observability: Latency, token count, and cost telemetry tracking.
7. Zero Secret Leakage: Sanitization and redaction of credentials in gateway outputs and audit telemetry.
"""

import asyncio
from unittest.mock import patch

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from starlette.requests import Request

from mcp_sentinel.agent.service import AgentService
from mcp_sentinel.api.app import app
from mcp_sentinel.config.settings import Settings
from mcp_sentinel.connectors.models import ToolExecutionResult
from mcp_sentinel.observability.metrics import (
    generate_prometheus_metrics,
    record_model_invocation,
    reset_metrics_for_testing,
)
from mcp_sentinel.security.audit_logger import scrub_dict_secrets
from mcp_sentinel.security.auth.dependencies import get_current_user
from mcp_sentinel.security.auth.oidc import (
    exchange_google_authorization_code,
    verify_google_id_token,
)
from mcp_sentinel.security.exceptions import AuthorizationDeniedError
from mcp_sentinel.services.gateway_execution_service import (
    GatewayExecuteRequest,
    GatewayExecutionService,
)

client = TestClient(app)


# =============================================================================
# 1. STRICT PRODUCTION AUTHENTICATION & CONFIGURATION FAIL-SAFE
# =============================================================================


@pytest.mark.asyncio
async def test_production_mode_rejects_test_bypass_headers():
    """Verify that development/test authentication bypass headers are strictly rejected in production."""
    prod_settings = Settings(APP_ENV="production")
    mock_request = Request(scope={"type": "http", "headers": [], "cookies": {}})

    with patch("mcp_sentinel.security.auth.dependencies.get_settings", return_value=prod_settings):
        # Attempt to bypass auth with test header while in production
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(
                request=mock_request,
                credentials=None,
                x_test_role="ADMIN",
                x_test_email="admin@sentinel.internal",
            )
        assert exc_info.value.status_code == 401
        assert (
            "Development test headers are strictly prohibited in production"
            in exc_info.value.detail
        )


@pytest.mark.asyncio
async def test_production_mode_rejects_mock_oidc_tokens():
    """Verify that mock/test OIDC tokens are rejected when running in production."""
    prod_settings = Settings(APP_ENV="production")

    with patch("mcp_sentinel.security.auth.oidc.get_settings", return_value=prod_settings):
        # Test token verification rejection
        with pytest.raises((HTTPException, AuthorizationDeniedError)) as exc_verify:
            await verify_google_id_token("mock_google_id_token_123")
        err_msg = str(
            getattr(exc_verify.value, "detail", "")
            or getattr(exc_verify.value, "safe_message", "")
            or str(exc_verify.value)
        )
        assert "prohibited in production" in err_msg or "validation failed" in err_msg.lower()

        # Test auth code exchange rejection
        with pytest.raises((HTTPException, AuthorizationDeniedError)) as exc_exchange:
            await exchange_google_authorization_code(
                "mock_google_auth_code_123",
                redirect_uri="https://app.sentinel.internal/callback",
            )
        err_msg_ex = str(
            getattr(exc_exchange.value, "detail", "")
            or getattr(exc_exchange.value, "safe_message", "")
            or str(exc_exchange.value)
        )
        assert "prohibited in production" in err_msg_ex or "failed" in err_msg_ex.lower()


# =============================================================================
# 2. RBAC & LEAST-PRIVILEGE AUTHORIZATION ENFORCEMENT
# =============================================================================


def test_unauthenticated_requests_strictly_blocked():
    """Verify that unauthenticated callers cannot access sensitive endpoints."""
    # Integrations
    assert client.get("/api/integrations").status_code == 401
    assert client.get("/api/integrations/github/connect").status_code == 401
    assert client.post("/api/integrations/github/disconnect").status_code == 401
    assert client.post("/api/integrations/canva/test").status_code == 401

    # Tools
    assert client.post("/api/tools/sync").status_code == 401
    assert client.post("/api/tools/canva.update_design/execute", json={}).status_code == 401

    # MCP Servers
    assert client.get("/api/mcp-servers").status_code == 401
    assert client.post("/api/mcp-servers/srv_canva_remote/test").status_code == 401


def test_viewer_role_cannot_perform_privileged_operations():
    """Verify that VIEWER role receives 403 Forbidden for mutating and governed actions."""
    viewer_headers = {
        "X-Test-User-Role": "VIEWER",
        "X-Test-User-Email": "viewer@sentinel.internal",
    }

    # VIEWER cannot sync tools (requires PERM_MANAGE_TOOLS)
    sync_resp = client.post("/api/tools/sync", headers=viewer_headers)
    assert sync_resp.status_code == 403
    err_body = sync_resp.json()
    msg = err_body.get("message") or err_body.get("detail", "")
    assert "lacks permission" in msg or "Permission denied" in msg or "Access Denied" in msg

    # VIEWER cannot disconnect integrations (requires PERM_MANAGE_INTEGRATIONS)
    disconnect_resp = client.post("/api/integrations/github/disconnect", headers=viewer_headers)
    assert disconnect_resp.status_code == 403

    # VIEWER cannot execute mutating/governed tools
    exec_resp = client.post(
        "/api/tools/github.merge_pull_request/execute",
        json={"parameters": {"owner": "octocat", "repo": "test", "pull_number": 1}},
        headers=viewer_headers,
    )
    assert exec_resp.status_code == 403


# =============================================================================
# 3. STAGE 3 TOOL ARGUMENT SCHEMA VALIDATION
# =============================================================================


@pytest.mark.asyncio
async def test_stage3_schema_validation_blocks_missing_required_params():
    """Verify that Gateway blocks execution when required schema fields are missing."""
    gw = GatewayExecutionService()

    mock_tool = {
        "tool_id": "test_schema_tool",
        "enabled": True,
        "policy_id": "sentinel-core-policy",
        "risk_level": "LOW",
        "approval_required": False,
        "input_schema": {
            "type": "object",
            "required": ["mandatory_param", "second_param"],
            "properties": {
                "mandatory_param": {"type": "string"},
                "second_param": {"type": "integer"},
            },
        },
    }

    with (
        patch.object(gw.tool_repo, "get_tool", return_value=mock_tool),
        patch.object(
            gw.integration_repo,
            "get_integration",
            return_value={"name": "Test", "is_enabled": True, "status": "CONNECTED"},
        ),
    ):
        req = GatewayExecuteRequest(
            tool_id="test.tool",
            parameters={"mandatory_param": "valid_value"},
            user_id="operator@sentinel.internal",
            user_role="OPERATOR",
        )
        res = await gw.execute(req)
        assert res.success is False
        assert res.status == "BLOCKED"
        assert "Schema validation error: Missing required parameter 'second_param'" in res.error


@pytest.mark.asyncio
async def test_stage3_schema_validation_blocks_wrong_parameter_types():
    """Verify that Gateway blocks execution when parameter types do not match the schema."""
    gw = GatewayExecutionService()

    mock_tool = {
        "tool_id": "test.typed_tool",
        "enabled": True,
        "policy_id": "sentinel-core-policy",
        "risk_level": "LOW",
        "approval_required": False,
        "input_schema": {
            "type": "object",
            "required": ["count"],
            "properties": {
                "count": {"type": "integer"},
            },
        },
    }

    with (
        patch.object(gw.tool_repo, "get_tool", return_value=mock_tool),
        patch.object(
            gw.integration_repo,
            "get_integration",
            return_value={"name": "Test", "is_enabled": True, "status": "CONNECTED"},
        ),
    ):
        req = GatewayExecuteRequest(
            tool_id="test.typed_tool",
            parameters={"count": "not_an_int"},
            user_id="operator@sentinel.internal",
            user_role="OPERATOR",
        )
        res = await gw.execute(req)
        assert res.success is False
        assert res.status == "BLOCKED"
        assert "Schema validation error: Parameter 'count' must be of type integer" in res.error


# =============================================================================
# 4. IDEMPOTENCY KEY DEDUPLICATION
# =============================================================================


@pytest.mark.asyncio
async def test_idempotency_key_prevents_duplicate_execution():
    """Verify that submitting identical idempotency keys returns cached result without re-executing."""
    gw = GatewayExecutionService()

    call_count = 0

    async def mock_execute(tool_id, parameters):
        nonlocal call_count
        call_count += 1
        return ToolExecutionResult(
            success=True,
            status="SUCCESS",
            tool_id=tool_id,
            integration_id="custom_mcp",
            data={"count": call_count},
        )

    mock_tool = {
        "tool_id": "custom_mcp.query_customer_records",
        "enabled": True,
        "policy_id": "sentinel-core-policy",
        "risk_level": "LOW",
        "approval_required": False,
        "input_schema": {},
    }

    with (
        patch.object(gw.tool_repo, "get_tool", return_value=mock_tool),
        patch.object(
            gw.integration_repo,
            "get_integration",
            return_value={"name": "Custom MCP", "is_enabled": True, "status": "CONNECTED"},
        ),
        patch.object(gw.tool_repo, "record_risk_decision", return_value="risk_123"),
        patch.object(gw.connector_registry, "execute_tool", side_effect=mock_execute),
        patch.object(gw.tool_repo, "record_tool_execution", return_value="exec_123"),
        patch.object(gw.audit_repo, "record_audit_event", return_value="audit_123"),
    ):
        import uuid

        key = f"idem-key-unique-{uuid.uuid4().hex}"

        req1 = GatewayExecuteRequest(
            tool_id="custom_mcp.query_customer_records",
            parameters={"limit": 5},
            user_id="operator@sentinel.internal",
            user_role="OPERATOR",
            idempotency_key=key,
        )
        resp1 = await gw.execute(req1)
        assert resp1.success is True
        assert resp1.data == {"count": 1}
        assert call_count == 1

        # Second request with the same idempotency key must return cached response without calling connector
        req2 = GatewayExecuteRequest(
            tool_id="custom_mcp.query_customer_records",
            parameters={"limit": 5},
            user_id="operator@sentinel.internal",
            user_role="OPERATOR",
            idempotency_key=key,
        )
        resp2 = await gw.execute(req2)
        assert resp2.success is True
        assert resp2.data == {"count": 1}
        assert call_count == 1  # Verify connector was NOT invoked a second time


# =============================================================================
# 5. BOUNDED EXECUTION TIMEOUTS & RESILIENCE
# =============================================================================


@pytest.mark.asyncio
async def test_tool_execution_timeout_bounded_cancellation():
    """Verify that hanging tool execution times out safely within configured threshold."""
    gw = GatewayExecutionService()
    gw._settings = Settings(TOOL_TIMEOUT_SECONDS=0.1)

    async def hanging_tool(tool_id, parameters):
        await asyncio.sleep(1.0)
        return ToolExecutionResult(success=True, status="SUCCESS")

    mock_tool = {
        "tool_id": "custom_mcp.query_customer_records",
        "enabled": True,
        "policy_id": "sentinel-core-policy",
        "risk_level": "LOW",
        "approval_required": False,
        "input_schema": {},
    }

    with (
        patch.object(gw.tool_repo, "get_tool", return_value=mock_tool),
        patch.object(
            gw.integration_repo,
            "get_integration",
            return_value={"name": "Custom MCP", "is_enabled": True, "status": "CONNECTED"},
        ),
        patch.object(gw.tool_repo, "record_risk_decision", return_value="risk_123"),
        patch.object(gw.connector_registry, "execute_tool", side_effect=hanging_tool),
        patch.object(gw.tool_repo, "record_tool_execution", return_value="exec_123"),
        patch.object(gw.audit_repo, "record_audit_event", return_value="audit_123"),
    ):
        req = GatewayExecuteRequest(
            tool_id="custom_mcp.query_customer_records",
            parameters={},
            user_id="operator@sentinel.internal",
            user_role="OPERATOR",
        )
        res = await gw.execute(req)
        assert res.success is False
        assert res.status == "FAILED"
        assert "timed out" in res.error.lower()
        assert "7. Connector Execution Timed Out" in res.stages_completed


@pytest.mark.asyncio
async def test_agent_execution_timeout_bounded_cancellation():
    """Verify that hanging Agent graph reasoning times out safely."""
    custom_settings = Settings(AGENT_EXECUTION_TIMEOUT_SECONDS=0.1)
    agent_svc = AgentService(settings=custom_settings)

    async def hanging_invoke(state):
        await asyncio.sleep(1.0)
        return {"status": "completed", "final_response": "done"}

    with patch.object(agent_svc._graph, "ainvoke", side_effect=hanging_invoke):
        resp = await agent_svc.run_chat("Analyze this slow workflow")
        assert resp.status == "timeout"
        assert "Execution timed out" in resp.response


# =============================================================================
# 6. OBSERVABILITY: FOUNDATION MODEL METRICS & COST TRACKING
# =============================================================================


def test_model_observability_metrics_recorded_and_exposed():
    """Verify foundation model latency, token counts, and operational costs are tracked."""
    reset_metrics_for_testing()

    record_model_invocation(
        model="gemini-2.5-flash",
        duration_seconds=0.45,
        prompt_tokens=1500,
        completion_tokens=250,
        estimated_cost_usd=0.0001875,
    )

    metrics_bytes = generate_prometheus_metrics()
    metrics_text = metrics_bytes.decode("utf-8")

    assert "sentinel_model_requests_total" in metrics_text
    assert 'model="gemini-2.5-flash"' in metrics_text
    assert "sentinel_model_tokens_total" in metrics_text
    assert 'type="prompt"' in metrics_text
    assert 'type="completion"' in metrics_text
    assert "sentinel_model_estimated_cost_usd" in metrics_text
    assert "sentinel_model_latency_seconds" in metrics_text


# =============================================================================
# 7. ZERO SECRET LEAKAGE: DATA SANITIZATION
# =============================================================================


def test_zero_secret_leakage_in_sanitization():
    """Verify that credentials, tokens, AWS keys, and connection strings are scrubbed."""
    raw_payload = {
        "user": "admin",
        "api_key": "AIzaSyD-fake-gemini-api-key-12345",
        "access_token": "ghp_1234567890abcdefghijklmnopqrstuvwxyz",
        "aws_secret": "AKIAIOSFODNN7EXAMPLE",
        "database_url": "postgresql://postgres:SuperSecretP@ssword@localhost:5432/mcp",
        "safe_data": {
            "tool_output": "Normal repository listing",
            "count": 42,
        },
    }

    sanitized = scrub_dict_secrets(raw_payload)

    assert sanitized["user"] == "admin"
    assert sanitized["api_key"] == "[REDACTED]"
    assert sanitized["access_token"] == "[REDACTED]"
    assert sanitized["aws_secret"] == "[REDACTED_AWS_KEY]"
    assert "SuperSecret" not in sanitized["database_url"]
    assert "***" in sanitized["database_url"]
    assert sanitized["safe_data"]["tool_output"] == "Normal repository listing"
    assert sanitized["safe_data"]["count"] == 42
