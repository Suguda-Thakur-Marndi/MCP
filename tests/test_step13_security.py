"""
STEP 13 — Comprehensive Security Tests for MCP Sentinel GitHub Integration.

Validates:
1. Unauthenticated users cannot use GitHub
2. Disconnected GitHub cannot execute tools
3. Unauthorized users cannot execute tools (VIEWER role / non-admin on repo deletion)
4. Approval-required tools cannot bypass approval
5. Rejected actions cannot execute
6. Expired approval cannot execute
7. Another user's GitHub connection / ticket cannot be used
8. Tokens are not exposed
9. Secrets are not logged
10. Frontend cannot directly call GitHub with privileged credentials
"""

import datetime
import json

import pytest
from starlette.testclient import TestClient

from mcp_sentinel.api.app import app
from mcp_sentinel.config.settings import get_settings
from mcp_sentinel.connectors.models import ConnectorCredentials, IntegrationStatus
from mcp_sentinel.connectors.registry import get_connector_registry
from mcp_sentinel.repositories.approval_repository import ApprovalRepository
from mcp_sentinel.repositories.integration_repository import IntegrationRepository
from mcp_sentinel.services.gateway_execution_service import (
    GatewayExecuteRequest,
    GatewayExecutionService,
)


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


# =============================================================================
# 1. Unauthenticated users cannot use GitHub
# =============================================================================
@pytest.mark.asyncio
async def test_unauthenticated_users_cannot_use_github():
    gw = GatewayExecutionService()
    req = GatewayExecuteRequest(
        tool_id="github.get_authenticated_user",
        parameters={},
        user_id="",  # Empty / unauthenticated identity
    )
    res = await gw.execute(req)
    assert res.success is False
    assert res.status == "BLOCKED"
    assert "identity verification failed" in res.error.lower()


# =============================================================================
# 2. Disconnected GitHub cannot execute tools
# =============================================================================
@pytest.mark.asyncio
async def test_disconnected_github_cannot_execute_tools():
    repo = IntegrationRepository()
    reg = get_connector_registry()
    gh = reg.get_connector("github")
    if gh:
        gh._credentials = None

    await repo.update_status("github", IntegrationStatus.DISCONNECTED)
    await repo.delete_credentials("github")

    gw = GatewayExecutionService()
    req = GatewayExecuteRequest(
        tool_id="github.list_repositories",
        parameters={},
        user_id="operator@sentinel.internal",
        user_role="OPERATOR",
    )
    res = await gw.execute(req)
    assert res.success is False
    assert res.status == "BLOCKED"
    assert "disconnected" in res.error.lower() or "credentials" in res.error.lower()


# =============================================================================
# 3. Unauthorized users cannot execute tools
# =============================================================================
@pytest.mark.asyncio
async def test_unauthorized_users_cannot_execute_tools():
    gw = GatewayExecutionService()
    reg = get_connector_registry()
    gh = reg.get_connector("github")
    gh._credentials = ConnectorCredentials(access_token="ghp_test_valid_token")

    repo = IntegrationRepository()
    await repo.update_status("github", IntegrationStatus.CONNECTED)

    # 3a. VIEWER role cannot execute mutating tool (create_issue)
    req_viewer = GatewayExecuteRequest(
        tool_id="github.create_issue",
        parameters={"owner": "octocat", "repo": "test-repo", "title": "Unauthorized Issue"},
        user_id="viewer@sentinel.internal",
        user_role="VIEWER",
    )
    res_viewer = await gw.execute(req_viewer)
    assert res_viewer.success is False
    assert res_viewer.status == "BLOCKED"
    assert "policy violation" in res_viewer.error.lower()

    # 3b. Non-admin (OPERATOR) cannot execute repository deletion
    req_del = GatewayExecuteRequest(
        tool_id="github.delete_repository",
        parameters={"owner": "octocat", "repo": "test-repo", "confirmation": "test-repo"},
        user_id="operator@sentinel.internal",
        user_role="OPERATOR",
    )
    res_del = await gw.execute(req_del)
    assert res_del.success is False
    assert res_del.status == "BLOCKED"
    assert "admin" in res_del.error.lower()


# =============================================================================
# 4. Approval-required tools cannot bypass approval
# =============================================================================
@pytest.mark.asyncio
async def test_approval_required_tools_cannot_bypass_approval():
    gw = GatewayExecutionService()
    reg = get_connector_registry()
    gh = reg.get_connector("github")
    gh._credentials = ConnectorCredentials(access_token="ghp_test_valid_token")

    repo = IntegrationRepository()
    await repo.update_status("github", IntegrationStatus.CONNECTED)

    req = GatewayExecuteRequest(
        tool_id="github.merge_pull_request",
        parameters={"owner": "octocat", "repo": "test-repo", "pull_number": 42},
        user_id="operator@sentinel.internal",
        user_role="OPERATOR",
        approval_ticket_id=None,  # Trying to execute without approval
    )
    res = await gw.execute(req)
    assert res.success is False
    assert res.status == "PENDING_APPROVAL"
    assert res.approval_ticket_id is not None
    assert "Human approval required" in res.error


# =============================================================================
# 5. Rejected actions cannot execute
# =============================================================================
@pytest.mark.asyncio
async def test_rejected_actions_cannot_execute():
    gw = GatewayExecutionService()
    appr_repo = ApprovalRepository()
    reg = get_connector_registry()
    gh = reg.get_connector("github")
    gh._credentials = ConnectorCredentials(access_token="ghp_test_valid_token")

    repo = IntegrationRepository()
    await repo.update_status("github", IntegrationStatus.CONNECTED)

    # Create ticket
    req = GatewayExecuteRequest(
        tool_id="github.merge_pull_request",
        parameters={"owner": "octocat", "repo": "test-repo", "pull_number": 88},
        user_id="dev@sentinel.internal",
        user_role="OPERATOR",
    )
    res = await gw.execute(req)
    ticket_id = res.approval_ticket_id
    assert ticket_id is not None

    # Reject ticket
    await appr_repo.decide_approval(
        ticket_id=ticket_id,
        approver_id="security-lead@sentinel.internal",
        decision="DENIED",
        decision_notes="Security audit failed: suspicious changes",
    )

    # Attempt to execute with rejected ticket
    req_exec = GatewayExecuteRequest(
        tool_id="github.merge_pull_request",
        parameters={"owner": "octocat", "repo": "test-repo", "pull_number": 88},
        user_id="dev@sentinel.internal",
        user_role="OPERATOR",
        approval_ticket_id=ticket_id,
    )
    exec_res = await gw.execute(req_exec)
    assert exec_res.success is False
    assert exec_res.status == "BLOCKED"
    assert "verification failed" in exec_res.error.lower()


# =============================================================================
# 6. Expired approval cannot execute
# =============================================================================
@pytest.mark.asyncio
async def test_expired_approval_cannot_execute():
    gw = GatewayExecutionService()
    appr_repo = ApprovalRepository()
    reg = get_connector_registry()
    gh = reg.get_connector("github")
    gh._credentials = ConnectorCredentials(access_token="ghp_test_valid_token")

    repo = IntegrationRepository()
    await repo.update_status("github", IntegrationStatus.CONNECTED)

    # Create ticket
    req = GatewayExecuteRequest(
        tool_id="github.merge_pull_request",
        parameters={"owner": "octocat", "repo": "test-repo", "pull_number": 99},
        user_id="dev@sentinel.internal",
        user_role="OPERATOR",
    )
    res = await gw.execute(req)
    ticket_id = res.approval_ticket_id
    assert ticket_id is not None

    # Approve ticket
    await appr_repo.decide_approval(
        ticket_id=ticket_id,
        approver_id="security-lead@sentinel.internal",
        decision="APPROVED",
    )

    # Manually backdate expires_at in database to simulate expiration
    pool = await appr_repo._get_pool()
    async with pool.acquire() as conn:
        past = datetime.datetime.now(datetime.UTC) - datetime.timedelta(hours=2)
        await conn.execute(
            "UPDATE approval_requests SET expires_at = $1 WHERE ticket_id = $2",
            past,
            ticket_id,
        )

    # Attempt execution with expired ticket
    req_exec = GatewayExecuteRequest(
        tool_id="github.merge_pull_request",
        parameters={"owner": "octocat", "repo": "test-repo", "pull_number": 99},
        user_id="dev@sentinel.internal",
        user_role="OPERATOR",
        approval_ticket_id=ticket_id,
    )
    exec_res = await gw.execute(req_exec)
    assert exec_res.success is False
    assert exec_res.status == "BLOCKED"
    assert "verification failed" in exec_res.error.lower()


# =============================================================================
# 7. Another user's GitHub connection / ticket cannot be used
# =============================================================================
@pytest.mark.asyncio
async def test_another_user_cannot_use_ticket():
    gw = GatewayExecutionService()
    appr_repo = ApprovalRepository()
    reg = get_connector_registry()
    gh = reg.get_connector("github")
    gh._credentials = ConnectorCredentials(access_token="ghp_test_valid_token")

    repo = IntegrationRepository()
    await repo.update_status("github", IntegrationStatus.CONNECTED)

    # User A requests approval
    req_user_a = GatewayExecuteRequest(
        tool_id="github.merge_pull_request",
        parameters={"owner": "octocat", "repo": "test-repo", "pull_number": 105},
        user_id="user_alice@sentinel.internal",
        user_role="OPERATOR",
    )
    res_a = await gw.execute(req_user_a)
    ticket_id = res_a.approval_ticket_id
    assert ticket_id is not None

    # Lead approves for Alice
    await appr_repo.decide_approval(
        ticket_id=ticket_id,
        approver_id="security-lead@sentinel.internal",
        decision="APPROVED",
    )

    # User B (Bob) attempts to hijack and execute with Alice's ticket
    req_user_b = GatewayExecuteRequest(
        tool_id="github.merge_pull_request",
        parameters={"owner": "octocat", "repo": "test-repo", "pull_number": 105},
        user_id="user_bob@sentinel.internal",
        user_role="OPERATOR",
        approval_ticket_id=ticket_id,
    )
    res_b = await gw.execute(req_user_b)
    assert res_b.success is False
    assert res_b.status == "BLOCKED"
    assert "verification failed" in res_b.error.lower()


# =============================================================================
# 8. Tokens are not exposed
# =============================================================================
def test_tokens_are_not_exposed(client):
    res = client.get("/api/integrations/github/status")
    assert res.status_code == 200
    data = res.json()
    assert "access_token" not in data
    assert "encrypted_access_token" not in data
    # Masked token is safe
    if data.get("masked_token"):
        assert "..." in data["masked_token"] or "●" in data["masked_token"]


# =============================================================================
# 9. Secrets are not logged
# =============================================================================
@pytest.mark.asyncio
async def test_secrets_are_not_logged():
    settings = get_settings()
    client_secret = settings.GITHUB_OAUTH_CLIENT_SECRET
    if not client_secret:
        pytest.skip("No GITHUB_OAUTH_CLIENT_SECRET in environment")

    # Inspect audit_events database table to verify secret NEVER appears in any event
    repo = IntegrationRepository()
    pool = await repo._get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT details, tool_name FROM audit_events ORDER BY created_at DESC LIMIT 50")
        for r in rows:
            details_str = json.dumps(r["details"]) if r["details"] else ""
            assert client_secret not in details_str, f"Found client secret in audit event for tool {r['tool_name']}"


# =============================================================================
# 10. Frontend cannot directly call GitHub with privileged credentials
# =============================================================================
def test_frontend_cannot_bypass_gateway(client):
    # Calling execution endpoint without valid user authentication or authorization
    headers = {"X-Test-User-Role": "VIEWER", "X-Test-User-Email": "viewer@sentinel.internal"}
    res = client.post(
        "/api/tools/github.merge_pull_request/execute",
        json={"parameters": {"owner": "octocat", "repo": "test-repo", "pull_number": 1}},
        headers=headers,
    )
    # Must be 403 Forbidden due to security policy
    assert res.status_code == 403
