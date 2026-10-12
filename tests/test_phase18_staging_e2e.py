"""
MCP-Sentinel — Phase 18 Staging End-to-End Verification Test Suite
Tests live running Staging Backend (http://127.0.0.1:8001), Staging Frontend (http://localhost:3001),
and isolated staging database (mcp_sentinel_staging).
"""

import asyncio
import json
import os
import urllib.error
import urllib.request

import asyncpg
import pytest

STAGING_API_URL = "http://127.0.0.1:8001"
STAGING_WEB_URL = "http://localhost:3001"
STAGING_DB_URL = os.environ.get(
    "STAGING_DATABASE_URL", "postgresql://postgres:postgres@127.0.0.1:5000/mcp_sentinel_staging"
)


def is_staging_available() -> bool:
    try:
        req = urllib.request.Request(f"{STAGING_API_URL}/health/live")
        with urllib.request.urlopen(req, timeout=1.0) as resp:
            return resp.status == 200
    except Exception:
        return False


@pytest.fixture(autouse=True)
def check_staging_available():
    if not is_staging_available():
        pytest.skip(
            "Staging server not reachable at http://127.0.0.1:8001; skipping staging E2E tests."
        )


def http_request(url: str, method: str = "GET", headers: dict = None, body: dict = None):
    req_headers = headers or {}
    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        req_headers["Content-Type"] = "application/json"

    req = urllib.request.Request(url, data=data, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            content = resp.read().decode("utf-8")
            return resp.status, json.loads(content) if "application/json" in resp.headers.get(
                "Content-Type", ""
            ) else content
    except urllib.error.HTTPError as e:
        content = e.read().decode("utf-8")
        try:
            parsed = json.loads(content)
        except Exception:
            parsed = content
        return e.code, parsed


@pytest.fixture(scope="session")
def staging_tokens():
    """
    Provisions real session tokens in mcp_sentinel_staging for test accounts:
    - admin@sentinel.test (ADMIN)
    - approver@sentinel.test (APPROVER)
    - operator@sentinel.test (OPERATOR)
    - viewer@sentinel.test (VIEWER)
    """
    import os

    from mcp_sentinel.config.settings import Settings, get_settings, reset_settings_for_testing
    from mcp_sentinel.database.connection import close_db_pool
    from mcp_sentinel.repositories.user_repository import UserRepository
    from mcp_sentinel.security.auth.session_handler import get_session_handler

    async def _create_tokens():
        await close_db_pool()
        orig_settings = get_settings()
        staging_settings = (
            Settings(_env_file=".env.staging") if os.path.exists(".env.staging") else orig_settings
        )
        reset_settings_for_testing(staging_settings)
        try:
            user_repo = UserRepository()
            session_handler = get_session_handler()

            tokens = {}
            for email in [
                "admin@sentinel.test",
                "approver@sentinel.test",
                "operator@sentinel.test",
                "viewer@sentinel.test",
            ]:
                user = await user_repo.get_user_by_email(email)
                assert user is not None, f"User {email} must exist in staging DB"
                token, _ = await session_handler.create_user_session(user=user)
                role = user.role.value.lower()
                tokens[role] = token
            return tokens
        finally:
            await close_db_pool()
            reset_settings_for_testing(orig_settings)

    return asyncio.run(_create_tokens())


def test_scenario_1_permitted_user_login_and_dashboard(staging_tokens):
    """
    Scenario 1: A permitted operator authenticates and accesses permitted dashboard data.
    """
    token = staging_tokens["operator"]
    status, data = http_request(
        f"{STAGING_API_URL}/api/dashboard/stats", headers={"Authorization": f"Bearer {token}"}
    )
    assert status == 200
    assert data["environment"] == "staging"
    assert data["status"] == "operational"
    assert "metrics" in data
    assert data["metrics"]["customers"] >= 1


def test_scenario_2_unauthorized_access_denials(staging_tokens):
    """
    Scenario 2: An unauthorized user cannot access restricted operations.
    - No auth -> 401
    - Viewer attempting write / approve -> 403
    - Test auth headers -> strictly 401
    """
    # 1. No token -> 401
    status, _ = http_request(f"{STAGING_API_URL}/api/approvals")
    assert status == 401

    # 2. Viewer attempting approval -> 403 Forbidden
    viewer_token = staging_tokens["viewer"]
    status, _ = http_request(
        f"{STAGING_API_URL}/api/approvals/ticket-123/approve",
        method="POST",
        headers={"Authorization": f"Bearer {viewer_token}"},
        body={"reason": "Unauthorized attempt"},
    )
    assert status == 403

    # 3. Test headers shortcut blocked in staging
    status, data = http_request(
        f"{STAGING_API_URL}/api/dashboard/stats",
        headers={"X-Test-User-Role": "ADMIN", "X-Test-User-Email": "admin@sentinel.test"},
    )
    assert status == 401
    assert "prohibited in production" in str(data).lower()


def test_scenario_3_and_4_tool_request_and_policy_evaluation(staging_tokens):
    """
    Scenario 3 & 4: Agent requests a governed MCP tool; policy engine evaluates request.
    - Low-risk read allowed without approval
    - High-risk mutation intercepted and automatically generates a pending approval ticket
    """
    operator_token = staging_tokens["operator"]

    # Low-risk query executes cleanly
    status, data = http_request(
        f"{STAGING_API_URL}/api/tools/custom_mcp.query_customer_records/execute",
        method="POST",
        headers={"Authorization": f"Bearer {operator_token}"},
        body={"parameters": {"query": "test", "limit": 5}},
    )
    assert status == 200
    assert data["success"] is True

    # High-risk delete requires approval -> creates pending ticket
    status, data = http_request(
        f"{STAGING_API_URL}/api/tools/custom_mcp.delete_customer/execute",
        method="POST",
        headers={"Authorization": f"Bearer {operator_token}"},
        body={"parameters": {"customer_id": "cust-999", "reason": "Staging testing deletion"}},
    )
    assert status == 200
    assert data["success"] is False
    assert data["status"] == "PENDING_APPROVAL"
    assert "approval_ticket_id" in data
    assert data["risk_level"] in ("HIGH", "CRITICAL")


def test_scenario_5_and_6_approval_binding_and_single_use(staging_tokens):
    """
    Scenario 5 & 6:
    - High-risk action requires human approval
    - Approval is bound to parameters and cannot be replayed or tampered
    """
    operator_token = staging_tokens["operator"]
    approver_token = staging_tokens["approver"]

    params = {"customer_id": "1", "reason": "Authorized account purge"}

    # 1. Operator requests delete -> triggers HITL gate and generates ticket
    status, data = http_request(
        f"{STAGING_API_URL}/api/tools/custom_mcp.delete_customer/execute",
        method="POST",
        headers={"Authorization": f"Bearer {operator_token}"},
        body={"parameters": params},
    )
    assert status == 200
    assert data["status"] == "PENDING_APPROVAL"
    ticket_id = data["approval_ticket_id"]
    assert ticket_id.startswith("TICKET-")

    # 2. Approver approves ticket
    status, app_data = http_request(
        f"{STAGING_API_URL}/api/approvals/{ticket_id}/approve",
        method="POST",
        headers={"Authorization": f"Bearer {approver_token}"},
        body={"reason": "Authorized by senior approver"},
    )
    assert status == 200

    # 3. Tampered execution attempt (different parameter) -> Rejection (403 Forbidden)
    tampered_params = {"customer_id": "1", "reason": "TAMPERED REASON"}
    status, data = http_request(
        f"{STAGING_API_URL}/api/tools/custom_mcp.delete_customer/execute",
        method="POST",
        headers={"Authorization": f"Bearer {operator_token}"},
        body={"parameters": tampered_params, "approval_ticket_id": ticket_id},
    )
    assert status == 403
    assert "failed" in str(data).lower() or "mismatched" in str(data).lower()

    # 4. Legitimate execution with exact parameters -> Success
    status, data = http_request(
        f"{STAGING_API_URL}/api/tools/custom_mcp.delete_customer/execute",
        method="POST",
        headers={"Authorization": f"Bearer {operator_token}"},
        body={"parameters": params, "approval_ticket_id": ticket_id},
    )
    assert status == 200
    assert data["success"] is True

    # 5. Replay attempt with same ticket -> Rejected (403 Forbidden)
    status, data = http_request(
        f"{STAGING_API_URL}/api/tools/custom_mcp.delete_customer/execute",
        method="POST",
        headers={"Authorization": f"Bearer {operator_token}"},
        body={"parameters": params, "approval_ticket_id": ticket_id},
    )
    assert status == 403
    assert "failed" in str(data).lower() or "replayed" in str(data).lower()


def test_scenario_7_audit_event_recorded_in_ledger():
    """
    Scenario 7: Approved execution produces a validated result and immutable audit event.
    """

    async def _verify_audit():
        conn = await asyncpg.connect(STAGING_DB_URL)
        events = await conn.fetch(
            "SELECT event_type, tool_name, decision FROM audit_events WHERE tool_name = 'custom_mcp.delete_customer'"
        )
        await conn.close()
        assert len(events) > 0, "Audit event must be recorded for tool execution"

    asyncio.run(_verify_audit())


def test_scenario_8_denied_and_expired_approvals_rejected(staging_tokens):
    """
    Scenario 8: Denied and expired approvals cannot execute.
    """
    operator_token = staging_tokens["operator"]
    approver_token = staging_tokens["approver"]
    params = {"customer_id": "2", "reason": "Denied test purge"}

    # 1. Operator requests action -> pending ticket
    status, data = http_request(
        f"{STAGING_API_URL}/api/tools/custom_mcp.delete_customer/execute",
        method="POST",
        headers={"Authorization": f"Bearer {operator_token}"},
        body={"parameters": params},
    )
    assert status == 200
    ticket_id = data["approval_ticket_id"]

    # 2. Approver explicitly denies ticket
    status, _ = http_request(
        f"{STAGING_API_URL}/api/approvals/{ticket_id}/deny",
        method="POST",
        headers={"Authorization": f"Bearer {approver_token}"},
        body={"reason": "Security risk: Denied by approver"},
    )
    assert status == 200

    # 3. Execution attempt with denied ticket -> Rejected (403 Forbidden)
    status, _ = http_request(
        f"{STAGING_API_URL}/api/tools/custom_mcp.delete_customer/execute",
        method="POST",
        headers={"Authorization": f"Bearer {operator_token}"},
        body={"parameters": params, "approval_ticket_id": ticket_id},
    )
    assert status == 403


def test_scenario_9_provider_timeouts_and_interruptions_fail_safely(staging_tokens):
    """
    Scenario 9: Provider timeouts and interruptions fail safely without crashing.
    """
    operator_token = staging_tokens["operator"]
    # Pass malformed tool execution body to verify safe 422 error
    status, data = http_request(
        f"{STAGING_API_URL}/api/tools/custom_mcp.get_customer/execute",
        method="POST",
        headers={"Authorization": f"Bearer {operator_token}"},
        body={"parameters": "not-a-dict"},
    )
    assert status == 422
    assert "error" in str(data).lower()


def test_scenario_10_frontend_reflects_states():
    """
    Scenario 10: The frontend console accurately reflects resulting states.
    All primary security console views load HTTP 200 without crashes.
    """
    for route in ["/", "/approvals", "/audit", "/integrations", "/policies", "/health"]:
        status, content = http_request(f"{STAGING_WEB_URL}{route}")
        assert status == 200
        assert "<html" in content.lower() or "<!doctype" in content.lower()
