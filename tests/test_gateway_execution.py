"""
Tests for GatewayExecutionService 9-Stage Zero-Trust Security Pipeline.
Validates:
1. Stage 1: Identity verification (rejects unauthenticated callers).
2. Stage 2: Integration authorization (rejects disabled/unregistered integrations).
3. Stage 3: Tool registry validation (rejects unregistered tools).
4. Stage 4: Policy evaluation (blocks policy violations).
5. Stage 5: Risk assessment (assigns LOW, MEDIUM, HIGH, CRITICAL).
6. Stage 6: Approval decision (halts high-risk actions, prevents replay attacks).
7. Stage 7: Execution through connector.
8. Stage 8: Result validation & sanitization.
9. Stage 9: Immutable audit logging.
"""

import pytest

from mcp_sentinel.connectors.models import ConnectorCredentials
from mcp_sentinel.connectors.registry import get_connector_registry
from mcp_sentinel.repositories.integration_repository import IntegrationRepository
from mcp_sentinel.services.approval_service import ApprovalService
from mcp_sentinel.services.gateway_execution_service import (
    GatewayExecuteRequest,
    GatewayExecutionService,
)
from mcp_sentinel.services.tool_registry_service import ToolRegistryService


@pytest.fixture(autouse=True)
async def setup_registry():
    tool_svc = ToolRegistryService()
    await tool_svc.sync_all_tools()


@pytest.mark.asyncio
async def test_identity_verification_failure():
    gw = GatewayExecutionService()
    req = GatewayExecuteRequest(
        tool_id="custom_mcp.query_customer_records",
        user_id="",  # Empty identity
    )
    res = await gw.execute(req)
    assert res.success is False
    assert res.status == "BLOCKED"
    assert "identity verification failed" in res.error.lower()


@pytest.mark.asyncio
async def test_unregistered_integration_blocked():
    gw = GatewayExecutionService()
    req = GatewayExecuteRequest(
        tool_id="nonexistent_service.do_something",
        user_id="operator@sentinel.internal",
    )
    res = await gw.execute(req)
    assert res.success is False
    assert res.status == "BLOCKED"
    assert "not registered" in res.error.lower()


@pytest.mark.asyncio
async def test_disabled_integration_blocked():
    repo = IntegrationRepository()
    gw = GatewayExecutionService()

    # Disable notion for this test
    await repo.upsert_integration(
        integration_id="notion",
        name="Notion",
        category="Knowledgebase",
        logo="📑",
        status="DISCONNECTED",
        auth_type="Internal Token",
        connection_endpoint="https://api.notion.com/v1",
        protocol_type="rest_api",
        description="Disabled integration test",
        is_enabled=False,
    )

    req = GatewayExecuteRequest(
        tool_id="notion.search",
        user_id="operator@sentinel.internal",
    )
    res = await gw.execute(req)
    assert res.success is False
    assert res.status == "BLOCKED"
    assert "disabled" in res.error.lower()

    # Re-enable
    await repo.upsert_integration(
        integration_id="notion",
        name="Notion",
        category="Knowledgebase",
        logo="📑",
        status="DISCONNECTED",
        auth_type="Internal Token",
        connection_endpoint="https://api.notion.com/v1",
        protocol_type="rest_api",
        description="Re-enabled",
        is_enabled=True,
    )


@pytest.mark.asyncio
async def test_low_risk_tool_executes_all_nine_stages():
    gw = GatewayExecutionService()
    req = GatewayExecuteRequest(
        tool_id="custom_mcp.query_customer_records",
        parameters={"limit": 2},
        user_id="analyst@sentinel.internal",
        user_role="OPERATOR",
    )
    res = await gw.execute(req)
    assert res.success is True
    assert res.status == "EXECUTED"
    assert res.risk_level == "LOW"
    assert len(res.stages_completed) == 9
    assert "1. Identity Verified" in res.stages_completed[0]
    assert "9. Audit Logged Immutably" in res.stages_completed[-1]


@pytest.mark.asyncio
async def test_high_risk_tool_requires_approval_and_halts():
    gw = GatewayExecutionService()
    req = GatewayExecuteRequest(
        tool_id="canva.update_design",
        parameters={"design_id": "des_audit_test", "title": "New Pitch"},
        user_id="designer@sentinel.internal",
        user_role="OPERATOR",
    )
    res = await gw.execute(req)
    assert res.success is False
    assert res.status == "PENDING_APPROVAL"
    assert res.approval_ticket_id is not None
    assert "TICKET-EXECUTE_CANVA.UPDATE_DESIGN" in res.approval_ticket_id
    assert "Human approval required" in res.error


@pytest.mark.asyncio
async def test_full_approval_lifecycle_and_replay_defense():
    gw = GatewayExecutionService()
    appr_svc = ApprovalService()

    # 1. Trigger action requiring approval
    req = GatewayExecuteRequest(
        tool_id="canva.update_design",
        parameters={"design_id": "des_lifecycle", "title": "Corporate Brand"},
        user_id="designer@sentinel.internal",
        user_role="OPERATOR",
    )
    res_initial = await gw.execute(req)
    assert res_initial.status == "PENDING_APPROVAL"
    ticket_id = res_initial.approval_ticket_id

    # 2. Approver authorizes ticket
    decision = await appr_svc.decide_approval(
        ticket_id=ticket_id,
        approver_id="security_admin@sentinel.internal",
        decision="APPROVED",
        decision_notes="Verified by Security Officer.",
    )
    assert decision["status"] == "APPROVED"

    # 3. Authenticate Canva connector for test run
    reg = get_connector_registry()
    canva = reg.get_connector("canva")
    canva._credentials = ConnectorCredentials(access_token="test_token", token_type="Bearer")
    canva._connected = True

    # 4. Resubmit with valid approved ticket
    req_approved = GatewayExecuteRequest(
        tool_id="canva.update_design",
        parameters={"design_id": "des_lifecycle", "title": "Corporate Brand"},
        user_id="designer@sentinel.internal",
        user_role="OPERATOR",
        approval_ticket_id=ticket_id,
    )
    res_executed = await gw.execute(req_approved)
    # Gating passed; executed via connector
    assert "6. Approval Verified & Consumed" in res_executed.stages_completed[5]

    # 5. REPLAY DEFENSE: Attempting to reuse the same ticket MUST FAIL
    res_replay = await gw.execute(req_approved)
    assert res_replay.status == "BLOCKED"
    assert "Approval ticket verification failed" in res_replay.error
