"""
Phase 5 Automated Tests: FastAPI Production Endpoints.
Tests:
- Health check endpoints (/health, /ready)
- Authentication (/api/auth/login, /api/auth/me)
- Live Dashboard statistics (/api/dashboard/stats)
- Active Policies and Tools inspection (/api/policies, /api/tools)
- Approval endpoints lifecycle via API (/api/approvals)
- Audit log query and stats endpoints (/api/audit)
"""

import pytest
from httpx import ASGITransport, AsyncClient

from mcp_sentinel.api.app import app
from mcp_sentinel.security.auth.jwt_handler import create_access_token
from mcp_sentinel.security.auth.models import AuthUser, UserRoleEnum


@pytest.fixture
def test_users():
    admin = AuthUser(
        id="user-admin-01",
        email="admin@sentinel.test",
        name="Admin User",
        role=UserRoleEnum.ADMIN,
    )
    approver = AuthUser(
        id="user-approver-01",
        email="approver@sentinel.test",
        name="Approver User",
        role=UserRoleEnum.APPROVER,
    )
    operator = AuthUser(
        id="user-operator-01",
        email="operator@sentinel.test",
        name="Operator User",
        role=UserRoleEnum.OPERATOR,
    )
    viewer = AuthUser(
        id="user-viewer-01",
        email="viewer@sentinel.test",
        name="Viewer User",
        role=UserRoleEnum.VIEWER,
    )
    return {
        "admin": (admin, create_access_token(admin)),
        "approver": (approver, create_access_token(approver)),
        "operator": (operator, create_access_token(operator)),
        "viewer": (viewer, create_access_token(viewer)),
    }


@pytest.mark.asyncio
async def test_health_endpoints():
    """Verify /health and /ready respond with healthy status."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/health")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "healthy"

        ready_res = await client.get("/ready")
        assert ready_res.status_code == 200
        ready_data = ready_res.json()
        assert ready_data["status"] == "ready"


@pytest.mark.asyncio
async def test_auth_login_and_me():
    """Verify login exchanges Google token for JWT, and /api/auth/me returns identity."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Login with mock token
        login_res = await client.post(
            "/api/auth/login",
            json={"id_token": "mock-google-token:operator@sentinel.test:OPERATOR"},
        )
        assert login_res.status_code == 200
        token_data = login_res.json()
        assert "access_token" in token_data
        assert token_data["token_type"] == "Bearer"
        assert token_data["user"]["email"] == "operator@sentinel.test"

        # Verify /me with token
        token = token_data["access_token"]
        me_res = await client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert me_res.status_code == 200
        user_info = me_res.json()
        assert user_info["email"] == "operator@sentinel.test"
        assert user_info["role"] == "OPERATOR"


@pytest.mark.asyncio
async def test_unauthenticated_request_rejected():
    """Requests to protected endpoints without token must return 401 Unauthorized."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/dashboard/stats")
        assert res.status_code == 401


@pytest.mark.asyncio
async def test_dashboard_stats_endpoint(test_users):
    """Verify dashboard stats returns real PostgreSQL count metrics."""
    _, token = test_users["operator"]
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get(
            "/api/dashboard/stats",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "operational"
        metrics = data["metrics"]
        assert "customers" in metrics
        assert "orders" in metrics
        assert "audit_events" in metrics
        assert "pending_approvals" in metrics


@pytest.mark.asyncio
async def test_policies_and_tools_endpoints(test_users):
    """Verify policies and tools return authoritative security configuration."""
    _, token = test_users["operator"]
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Policies
        pol_res = await client.get(
            "/api/policies",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert pol_res.status_code == 200
        pol_data = pol_res.json()
        assert pol_data["rule_count"] >= 4
        assert pol_data["precedence"] == ["DENY", "REQUIRE_MFA", "REQUIRE_APPROVAL", "ALLOW"]

        # Tools
        tools_res = await client.get(
            "/api/tools",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert tools_res.status_code == 200
        tools_data = tools_res.json()
        assert tools_data["tool_count"] == 8
        tool_names = [t["tool_name"] for t in tools_data["tools"]]
        assert "delete_customer" in tool_names
        assert "purge_inactive_customer_data" in tool_names


@pytest.mark.asyncio
async def test_approvals_api_lifecycle(test_users):
    """Test creating an approval request, fetching pending, and approving via REST API."""
    _, op_token = test_users["operator"]
    _, app_token = test_users["approver"]
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Create approval request (as operator)
        create_res = await client.post(
            "/api/approvals",
            headers={"Authorization": f"Bearer {op_token}"},
            json={
                "request_id": "req-api-lifecycle-1",
                "requester_id": "user-operator-01",
                "tool_name": "delete_customer",
                "target_id": "cust-api-test-1",
                "action": "delete_customer",
                "reason": "Testing API approval lifecycle",
                "parameters": {"customer_id": "cust-api-test-1"},
                "risk_level": "CRITICAL",
                "risk_score": 85,
            },
        )
        assert create_res.status_code == 201
        ticket = create_res.json()
        ticket_id = ticket["ticket_id"]
        assert ticket["status"] == "PENDING"

        # 2. List pending approvals (as approver)
        pending_res = await client.get(
            "/api/approvals/pending",
            headers={"Authorization": f"Bearer {app_token}"},
        )
        assert pending_res.status_code == 200
        tickets = pending_res.json()
        assert any(t["ticket_id"] == ticket_id for t in tickets)

        # 3. Approve ticket (as approver)
        approve_res = await client.post(
            f"/api/approvals/{ticket_id}/approve",
            headers={"Authorization": f"Bearer {app_token}"},
            json={"decision": "APPROVED", "decision_notes": "Approved via API test"},
        )
        assert approve_res.status_code == 200
        decided = approve_res.json()
        assert decided["status"] == "APPROVED"


@pytest.mark.asyncio
async def test_approvals_api_self_approval_forbidden(test_users):
    """Test that an operator/approver attempting self-approval via API is rejected with 403."""
    _, app_token = test_users["approver"]
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create request as approver
        create_res = await client.post(
            "/api/approvals",
            headers={"Authorization": f"Bearer {app_token}"},
            json={
                "request_id": "req-api-self-1",
                "requester_id": "user-approver-01",
                "tool_name": "delete_customer",
                "target_id": "cust-api-self-1",
                "action": "delete_customer",
                "reason": "Testing self approval denial",
                "parameters": {"customer_id": "cust-api-self-1"},
            },
        )
        assert create_res.status_code == 201
        ticket_id = create_res.json()["ticket_id"]

        # Attempt self-approval with the SAME user token
        approve_res = await client.post(
            f"/api/approvals/{ticket_id}/approve",
            headers={"Authorization": f"Bearer {app_token}"},
            json={"decision": "APPROVED", "decision_notes": "Self approval"},
        )
        assert approve_res.status_code == 403
        assert "cannot approve their own" in approve_res.json()["message"]


@pytest.mark.asyncio
async def test_audit_endpoints(test_users):
    """Verify audit log events and statistics endpoints return real records."""
    _, token = test_users["admin"]
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        events_res = await client.get(
            "/api/audit/events?limit=10",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert events_res.status_code == 200
        events_data = events_res.json()
        assert "events" in events_data
        assert "total" in events_data

        stats_res = await client.get(
            "/api/audit/stats",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert stats_res.status_code == 200
        stats_data = stats_res.json()
        assert "by_decision" in stats_data
