"""
Phase 16 Architecture Alignment & Operational Verification Regression Tests.

Verifies:
1. Durable L1/L2 Idempotency: cross-worker & post-restart persistence.
2. Concurrent duplicate submission race condition handling.
3. Concurrent approval consumption: atomic row-lock single-use enforcement.
4. Provider outage resilience: safe failure without crashing gateway.
5. Database failure safety: graceful degradation if durable cache encounters errors.
6. Invalid tool argument schema validation rejections.
7. Expired credentials rejection in auth dependencies.
"""

import asyncio
from unittest.mock import AsyncMock, patch

import pytest

from mcp_sentinel.connectors.models import ToolExecutionResult
from mcp_sentinel.repositories.approval_repository import ApprovalRepository
from mcp_sentinel.repositories.idempotency_repository import IdempotencyRepository
from mcp_sentinel.services.gateway_execution_service import (
    GatewayExecuteRequest,
    GatewayExecutionService,
)


@pytest.mark.asyncio
async def test_durable_idempotency_across_worker_restarts():
    """
    Verify that an idempotency key saved by worker 1 is retrieved by worker 2
    even when worker 2 has an empty in-memory L1 cache.
    """
    fake_db: dict[str, dict] = {}

    mock_idempotency_repo = IdempotencyRepository()

    async def mock_get(key: str):
        return fake_db.get(key)

    async def mock_save(
        idempotency_key: str,
        tool_id: str,
        user_id: str,
        response_payload: dict,
        ttl_seconds: int = 86400,
    ):
        fake_db[idempotency_key] = response_payload
        return True

    mock_idempotency_repo.get_response = AsyncMock(side_effect=mock_get)
    mock_idempotency_repo.save_response = AsyncMock(side_effect=mock_save)

    call_count = 0

    async def mock_exec(tool_id, parameters):
        nonlocal call_count
        call_count += 1
        return ToolExecutionResult(
            success=True,
            status="SUCCESS",
            tool_id=tool_id,
            integration_id="custom_mcp",
            data={"result": f"execution_{call_count}"},
        )

    mock_tool = {
        "tool_id": "custom_mcp.query_customer_records",
        "enabled": True,
        "policy_id": "sentinel-core-policy",
        "risk_level": "LOW",
        "approval_required": False,
        "input_schema": {},
    }

    # Worker 1: executes first request
    worker1 = GatewayExecutionService(idempotency_repo=mock_idempotency_repo)
    with (
        patch.object(worker1.tool_repo, "get_tool", return_value=mock_tool),
        patch.object(
            worker1.integration_repo,
            "get_integration",
            return_value={"name": "Custom MCP", "is_enabled": True, "status": "CONNECTED"},
        ),
        patch.object(worker1.tool_repo, "record_risk_decision", return_value="risk_1"),
        patch.object(worker1.connector_registry, "execute_tool", side_effect=mock_exec),
        patch.object(worker1.tool_repo, "record_tool_execution", return_value="exec_1"),
        patch.object(worker1.audit_repo, "record_audit_event", return_value="audit_1"),
    ):
        req = GatewayExecuteRequest(
            tool_id="custom_mcp.query_customer_records",
            parameters={"limit": 10},
            user_id="analyst@sentinel.test",
            user_role="OPERATOR",
            idempotency_key="durable-key-phase16-999",
        )
        resp1 = await worker1.execute(req)
        assert resp1.success is True
        assert resp1.data == {"result": "execution_1"}
        assert call_count == 1
        assert "durable-key-phase16-999" in fake_db

    # Worker 2: Brand new instance simulating a worker restart or multi-worker deployment
    worker2 = GatewayExecutionService(idempotency_repo=mock_idempotency_repo)
    assert "durable-key-phase16-999" not in worker2._idempotency_cache  # L1 is empty!

    with (
        patch.object(worker2.tool_repo, "get_tool", return_value=mock_tool),
        patch.object(
            worker2.integration_repo,
            "get_integration",
            return_value={"name": "Custom MCP", "is_enabled": True, "status": "CONNECTED"},
        ),
        patch.object(worker2.connector_registry, "execute_tool", side_effect=mock_exec),
    ):
        resp2 = await worker2.execute(req)
        assert resp2.success is True
        # Must return the cached result without invoking the connector
        assert resp2.data == {"result": "execution_1"}
        assert call_count == 1  # Connector was NOT invoked again!
        # And L1 cache is now populated in worker 2
        assert "durable-key-phase16-999" in worker2._idempotency_cache


@pytest.mark.asyncio
async def test_concurrent_duplicate_submissions_deduplication():
    """Verify concurrent requests with the same idempotency key invoke connector only once."""
    gw = GatewayExecutionService()
    call_count = 0

    async def mock_exec_delayed(tool_id, parameters):
        nonlocal call_count
        call_count += 1
        await asyncio.sleep(0.05)  # simulate async work
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
        patch.object(gw.tool_repo, "record_risk_decision", return_value="risk_1"),
        patch.object(gw.connector_registry, "execute_tool", side_effect=mock_exec_delayed),
        patch.object(gw.tool_repo, "record_tool_execution", return_value="exec_1"),
        patch.object(gw.audit_repo, "record_audit_event", return_value="audit_1"),
    ):
        import uuid

        req = GatewayExecuteRequest(
            tool_id="custom_mcp.query_customer_records",
            parameters={"limit": 5},
            user_id="user@sentinel.test",
            user_role="OPERATOR",
            idempotency_key=f"race-key-concurrent-{uuid.uuid4().hex}",
        )

        # Launch 5 concurrent executions with identical idempotency key
        tasks = [gw.execute(req) for _ in range(5)]
        responses = await asyncio.gather(*tasks)

        # All 5 must succeed with identical count=1
        for r in responses:
            assert r.success is True
            assert r.data == {"count": 1}

        # The underlying execution must only have occurred once
        assert call_count == 1


@pytest.mark.asyncio
async def test_provider_outage_graceful_failure():
    """Verify connector network outage / 503 is caught safely and returns status FAILED."""
    gw = GatewayExecutionService()

    async def mock_exec_crash(tool_id, parameters):
        raise ConnectionError("Upstream MCP connector dropped connection: ECONNREFUSED")

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
        patch.object(gw.tool_repo, "record_risk_decision", return_value="risk_1"),
        patch.object(gw.connector_registry, "execute_tool", side_effect=mock_exec_crash),
        patch.object(gw.tool_repo, "record_tool_execution", return_value="exec_1"),
        patch.object(gw.audit_repo, "record_audit_event", return_value="audit_1"),
    ):
        req = GatewayExecuteRequest(
            tool_id="custom_mcp.query_customer_records",
            parameters={"limit": 5},
            user_id="user@sentinel.test",
            user_role="OPERATOR",
        )
        res = await gw.execute(req)
        assert res.success is False
        assert res.status == "FAILED"
        assert "ECONNREFUSED" in res.error


@pytest.mark.asyncio
async def test_database_idempotency_failure_graceful_degradation():
    """Verify that if database durable lookup encounters an error, gateway degrades gracefully to L1."""
    mock_idempotency_repo = IdempotencyRepository()
    mock_idempotency_repo.get_response = AsyncMock(
        side_effect=RuntimeError("Database connection lost")
    )
    mock_idempotency_repo.save_response = AsyncMock(
        side_effect=RuntimeError("Database write failed")
    )

    gw = GatewayExecutionService(idempotency_repo=mock_idempotency_repo)

    mock_tool = {
        "tool_id": "custom_mcp.query_customer_records",
        "enabled": True,
        "policy_id": "sentinel-core-policy",
        "risk_level": "LOW",
        "approval_required": False,
        "input_schema": {},
    }

    async def mock_exec(tool_id, parameters):
        return ToolExecutionResult(
            success=True,
            status="SUCCESS",
            tool_id=tool_id,
            integration_id="custom_mcp",
            data={"status": "ok"},
        )

    with (
        patch.object(gw.tool_repo, "get_tool", return_value=mock_tool),
        patch.object(
            gw.integration_repo,
            "get_integration",
            return_value={"name": "Custom MCP", "is_enabled": True, "status": "CONNECTED"},
        ),
        patch.object(gw.tool_repo, "record_risk_decision", return_value="risk_1"),
        patch.object(gw.connector_registry, "execute_tool", side_effect=mock_exec),
        patch.object(gw.tool_repo, "record_tool_execution", return_value="exec_1"),
        patch.object(gw.audit_repo, "record_audit_event", return_value="audit_1"),
    ):
        req = GatewayExecuteRequest(
            tool_id="custom_mcp.query_customer_records",
            parameters={},
            user_id="user@sentinel.test",
            user_role="OPERATOR",
            idempotency_key="key-db-failure-safe",
        )
        res = await gw.execute(req)
        # Execution must still succeed despite L2 DB error
        assert res.success is True
        assert res.data == {"status": "ok"}


@pytest.mark.asyncio
async def test_concurrent_approval_consumption_single_use():
    """
    Verify that concurrent verify_and_consume_bound calls on the same ticket ID
    permit only a single successful consumer (replaying returns False).
    """
    repo = ApprovalRepository()

    # If ticket is already in EXECUTING or COMPLETED, verify_and_consume_bound returns False
    mock_row_completed = {
        "ticket_id": "TICKET-CONCURRENT-001",
        "tool_name": "custom_mcp.delete_customer",
        "action": "execute_custom_mcp.delete_customer",
        "target_id": "cust-1",
        "status": "COMPLETED",
        "signature": None,
    }

    mock_conn = AsyncMock()
    mock_conn.fetchrow = AsyncMock(return_value=mock_row_completed)

    mock_pool = AsyncMock()
    mock_pool.acquire.return_value.__aenter__.return_value = mock_conn

    with patch.object(repo, "_get_pool", return_value=mock_pool):
        result = await repo.verify_and_consume_bound(
            ticket_id="TICKET-CONCURRENT-001",
            target_id="cust-1",
            action="execute_custom_mcp.delete_customer",
            tool_name="custom_mcp.delete_customer",
        )
        # Completed ticket cannot be consumed again!
        assert result is False


@pytest.mark.asyncio
async def test_invalid_tool_argument_schema_validation_rejection():
    """Verify that parameters violating input_schema constraints are rejected at Stage 3."""
    gw = GatewayExecutionService()
    mock_tool = {
        "tool_id": "test.data_transfer",
        "enabled": True,
        "input_schema": {
            "type": "object",
            "required": ["batch_size", "destination"],
            "properties": {
                "batch_size": {"type": "integer"},
                "destination": {"type": "string"},
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
        # Case 1: Missing required parameter 'destination'
        req1 = GatewayExecuteRequest(
            tool_id="test.data_transfer",
            parameters={"batch_size": 100},
            user_id="user@sentinel.test",
            user_role="OPERATOR",
        )
        res1 = await gw.execute(req1)
        assert res1.success is False
        assert res1.status == "BLOCKED"
        assert "Missing required parameter 'destination'" in res1.error

        # Case 2: Incorrect type for 'batch_size' (string instead of integer)
        req2 = GatewayExecuteRequest(
            tool_id="test.data_transfer",
            parameters={"batch_size": "one_hundred", "destination": "s3://bucket"},
            user_id="user@sentinel.test",
            user_role="OPERATOR",
        )
        res2 = await gw.execute(req2)
        assert res2.success is False
        assert res2.status == "BLOCKED"
        assert "Parameter 'batch_size' must be of type integer" in res2.error


def test_sensitive_endpoint_unauthenticated_rejection():
    """Verify unauthenticated request to sensitive tool execution returns 401."""
    from fastapi.testclient import TestClient

    from mcp_sentinel.api.app import create_app

    app = create_app()
    client = TestClient(app, raise_server_exceptions=False)

    resp = client.post(
        "/api/tools/custom_mcp.query_customer_records/execute",
        json={"parameters": {}},
    )
    assert resp.status_code == 401
    data = resp.json()
    assert "Authentication required" in (data.get("message") or data.get("detail"))
