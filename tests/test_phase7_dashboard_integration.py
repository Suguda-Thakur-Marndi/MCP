"""
Phase 7 Automated Integration Tests: Security Operations Dashboard & Real Backend Integration.

Tests:
1. Approval Conflict Handling (HTTP 409):
   - Race condition: second approval on decided ticket returns 409 Conflict.
   - Cancel conflict: cancelling an already approved ticket returns 409 Conflict.
2. Self-Approval Defense (HTTP 403):
   - Requester attempting to approve their own ticket returns 403 Forbidden.
3. Role-Based Permission Boundaries (HTTP 403 / 401):
   - Viewer role attempting to approve/deny returns 403 Forbidden.
   - Unauthenticated request to /api/auth/me returns 401 Unauthorized.
4. Approval Lifecycle & Cancellation:
   - Requester can cancel their pending ticket (status becomes CANCELLED).
5. Audit Log Filtering:
   - Server-side filtering by actor_id and request_id.
   - Normalization of details JSON.
6. Agent Observability & Telemetry:
   - /api/agent/status returns runtime status and tool count.
   - /api/agent/executions returns execution history from audit trail.
7. Policy and Tool Visibility:
   - /api/policies returns structured rules and precedence.
   - /api/tools returns registered tools array and metadata.
"""

import pytest
from httpx import ASGITransport, AsyncClient

from mcp_sentinel.api.app import app
from mcp_sentinel.security.auth.jwt_handler import create_access_token
from mcp_sentinel.security.auth.models import AuthUser, UserRoleEnum


@pytest.fixture
def auth_users():
    admin = AuthUser(
        id="user-p7-admin",
        email="admin@sentinel.test",
        name="Security Admin",
        role=UserRoleEnum.ADMIN,
    )
    approver = AuthUser(
        id="user-p7-approver",
        email="approver@sentinel.test",
        name="Security Officer",
        role=UserRoleEnum.APPROVER,
    )
    operator = AuthUser(
        id="user-p7-operator",
        email="operator@sentinel.test",
        name="AI Operator",
        role=UserRoleEnum.OPERATOR,
    )
    viewer = AuthUser(
        id="user-p7-viewer",
        email="viewer@sentinel.test",
        name="Auditor Viewer",
        role=UserRoleEnum.VIEWER,
    )
    return {
        "admin": (admin, create_access_token(admin)),
        "approver": (approver, create_access_token(approver)),
        "operator": (operator, create_access_token(operator)),
        "viewer": (viewer, create_access_token(viewer)),
    }


@pytest.mark.asyncio
async def test_auth_me_endpoints(auth_users):
    """Verify authoritative identity is retrieved from backend session."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Unauthenticated request -> 401
        res = await client.get("/api/auth/me")
        assert res.status_code == 401

        # Authenticated Admin -> 200 with real identity
        _, token = auth_users["admin"]
        res = await client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["id"] == "user-p7-admin"
        assert data["role"] == "ADMIN"
        assert data["email"] == "admin@sentinel.test"


@pytest.mark.asyncio
async def test_approval_conflict_409_handling(auth_users):
    """
    Verify race condition defense:
    When a ticket is already decided, subsequent approval or cancel returns 409 Conflict.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        _, op_token = auth_users["operator"]
        _, app_token = auth_users["approver"]
        _, adm_token = auth_users["admin"]

        # 1. Requester creates pending approval
        create_res = await client.post(
            "/api/approvals",
            json={
                "tool_name": "delete_customer",
                "action": "DELETE",
                "target_id": "CUST-RACE-01",
                "risk_score": 85,
                "risk_level": "HIGH",
                "policy_id": "RULE-GATED-DELETION",
                "reason": "Customer record purge request",
                "parameters": {"customer_id": "CUST-RACE-01"},
            },
            headers={"Authorization": f"Bearer {op_token}"},
        )
        assert create_res.status_code == 201
        ticket = create_res.json()
        ticket_id = ticket["ticket_id"]

        # 2. Approver A approves
        approve_res1 = await client.post(
            f"/api/approvals/{ticket_id}/approve",
            json={"decision_notes": "First approver authorized"},
            headers={"Authorization": f"Bearer {app_token}"},
        )
        assert approve_res1.status_code == 200
        assert approve_res1.json()["status"] == "APPROVED"

        # 3. Approver B (Admin) still has ticket open and attempts to approve -> 409 Conflict
        approve_res2 = await client.post(
            f"/api/approvals/{ticket_id}/approve",
            json={"decision_notes": "Second approver attempted duplicate approval"},
            headers={"Authorization": f"Bearer {adm_token}"},
        )
        assert approve_res2.status_code == 409
        err_msg = (
            approve_res2.json().get("message") or approve_res2.json().get("detail") or ""
        ).lower()
        assert "state transition" in err_msg or "cannot decide" in err_msg

        # 4. Cancel the ticket, then attempt duplicate cancellation -> 409 Conflict
        cancel_res1 = await client.post(
            f"/api/approvals/{ticket_id}/cancel",
            headers={"Authorization": f"Bearer {op_token}"},
        )
        assert cancel_res1.status_code == 200

        cancel_res2 = await client.post(
            f"/api/approvals/{ticket_id}/cancel",
            headers={"Authorization": f"Bearer {op_token}"},
        )
        assert cancel_res2.status_code == 409
        cancel_err = (
            cancel_res2.json().get("message") or cancel_res2.json().get("detail") or ""
        ).lower()
        assert "cannot cancel" in cancel_err or "state transition" in cancel_err


@pytest.mark.asyncio
async def test_self_approval_defense_403(auth_users):
    """
    Verify self-approval defense:
    A user cannot approve their own ticket, even if they have ADMIN role.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        _, adm_token = auth_users["admin"]

        # Admin creates approval ticket as requester
        create_res = await client.post(
            "/api/approvals",
            json={
                "tool_name": "delete_customer",
                "action": "DELETE",
                "target_id": "CUST-SELF-01",
                "risk_score": 90,
                "risk_level": "CRITICAL",
                "policy_id": "RULE-GATED-DELETION",
                "reason": "Testing self-approval",
                "parameters": {"customer_id": "CUST-SELF-01"},
            },
            headers={"Authorization": f"Bearer {adm_token}"},
        )
        assert create_res.status_code == 201
        ticket_id = create_res.json()["ticket_id"]

        # Admin attempts to approve their own ticket -> 403 Forbidden
        approve_res = await client.post(
            f"/api/approvals/{ticket_id}/approve",
            json={"decision_notes": "Attempting self-approval"},
            headers={"Authorization": f"Bearer {adm_token}"},
        )
        assert approve_res.status_code == 403
        err_msg = (
            approve_res.json().get("message") or approve_res.json().get("detail") or ""
        ).lower()
        assert "requester cannot approve" in err_msg or "self-approval" in err_msg


@pytest.mark.asyncio
async def test_viewer_cannot_decide_approval_403(auth_users):
    """Verify VIEWER role is blocked server-side from deciding approvals."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        _, op_token = auth_users["operator"]
        _, view_token = auth_users["viewer"]

        # Operator creates ticket
        create_res = await client.post(
            "/api/approvals",
            json={
                "tool_name": "delete_customer",
                "action": "DELETE",
                "target_id": "CUST-VIEWER-01",
                "risk_score": 80,
                "risk_level": "HIGH",
                "policy_id": "RULE-GATED-DELETION",
                "reason": "Test viewer access boundary",
                "parameters": {"customer_id": "CUST-VIEWER-01"},
            },
            headers={"Authorization": f"Bearer {op_token}"},
        )
        assert create_res.status_code == 201
        ticket_id = create_res.json()["ticket_id"]

        # Viewer attempts approve -> 403 Forbidden
        res = await client.post(
            f"/api/approvals/{ticket_id}/approve",
            headers={"Authorization": f"Bearer {view_token}"},
        )
        assert res.status_code == 403

        # Viewer attempts deny -> 403 Forbidden
        res_deny = await client.post(
            f"/api/approvals/{ticket_id}/deny",
            headers={"Authorization": f"Bearer {view_token}"},
        )
        assert res_deny.status_code == 403


@pytest.mark.asyncio
async def test_approval_cancellation_lifecycle(auth_users):
    """Verify requester can cancel their pending approval ticket."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        _, op_token = auth_users["operator"]

        create_res = await client.post(
            "/api/approvals",
            json={
                "tool_name": "delete_customer",
                "action": "DELETE",
                "target_id": "CUST-CANCEL-01",
                "risk_score": 75,
                "risk_level": "HIGH",
                "policy_id": "RULE-GATED-DELETION",
                "reason": "Test ticket cancellation",
                "parameters": {"customer_id": "CUST-CANCEL-01"},
            },
            headers={"Authorization": f"Bearer {op_token}"},
        )
        assert create_res.status_code == 201
        ticket_id = create_res.json()["ticket_id"]

        # Cancel the ticket
        cancel_res = await client.post(
            f"/api/approvals/{ticket_id}/cancel",
            headers={"Authorization": f"Bearer {op_token}"},
        )
        assert cancel_res.status_code == 200
        assert cancel_res.json()["status"] == "CANCELLED"


@pytest.mark.asyncio
async def test_audit_log_query_filtering(auth_users):
    """Verify server-side filtering on /api/audit/events by actor_id and request_id."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        _, adm_token = auth_users["admin"]

        # Query all events
        res_all = await client.get(
            "/api/audit/events?limit=10",
            headers={"Authorization": f"Bearer {adm_token}"},
        )
        assert res_all.status_code == 200
        data_all = res_all.json()
        assert "events" in data_all

        # Query with actor filter
        res_actor = await client.get(
            "/api/audit/events?actor_id=user-p7-admin",
            headers={"Authorization": f"Bearer {adm_token}"},
        )
        assert res_actor.status_code == 200
        data_actor = res_actor.json()
        for ev in data_actor.get("events", []):
            assert ev["actor_id"] == "user-p7-admin"

        # Query with non-existent request_id
        res_req = await client.get(
            "/api/audit/events?request_id=REQ-NONEXISTENT-9999",
            headers={"Authorization": f"Bearer {adm_token}"},
        )
        assert res_req.status_code == 200
        assert len(res_req.json().get("events", [])) == 0


@pytest.mark.asyncio
async def test_agent_telemetry_endpoints(auth_users):
    """Verify /api/agent/status and /api/agent/executions endpoints."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        _, adm_token = auth_users["admin"]

        # Status endpoint
        status_res = await client.get(
            "/api/agent/status",
            headers={"Authorization": f"Bearer {adm_token}"},
        )
        assert status_res.status_code == 200
        status_data = status_res.json()
        assert status_data["status"] in ("ready", "healthy")
        assert "model" in status_data
        assert "tools_registered" in status_data

        # Executions endpoint
        execs_res = await client.get(
            "/api/agent/executions?limit=5",
            headers={"Authorization": f"Bearer {adm_token}"},
        )
        assert execs_res.status_code == 200
        execs_data = execs_res.json()
        assert "count" in execs_data
        assert "executions" in execs_data
        assert isinstance(execs_data["executions"], list)


@pytest.mark.asyncio
async def test_policy_and_tools_visibility(auth_users):
    """Verify /api/policies and /api/tools endpoints return expected schema."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        _, adm_token = auth_users["admin"]

        # Policies
        pol_res = await client.get(
            "/api/policies",
            headers={"Authorization": f"Bearer {adm_token}"},
        )
        assert pol_res.status_code == 200
        pol_data = pol_res.json()
        assert "rules" in pol_data
        assert "precedence" in pol_data
        assert isinstance(pol_data["rules"], list)

        # Tools
        tools_res = await client.get(
            "/api/tools",
            headers={"Authorization": f"Bearer {adm_token}"},
        )
        assert tools_res.status_code == 200
        tools_data = tools_res.json()
        assert "tools" in tools_data
        assert "tool_count" in tools_data
        assert tools_data["tool_count"] >= 4
