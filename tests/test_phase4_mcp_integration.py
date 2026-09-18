"""
Phase 4 MCP Server Integration Tests.
Verifies end-to-end tool execution flow through FastMCP server and SecurityGate:
MCP Client / FastMCP call_tool
      ↓
SecurityGate Middleware
      ↓
Policy Engine (Authoritative Decision)
      ↓
Service / Repository Layer
      ↓
PostgreSQL Database
"""

import json

import pytest

from mcp_sentinel.agent.mcp_client import SentinelMCPClient
from mcp_sentinel.repositories.approval_repository import ApprovalRepository
from mcp_sentinel.repositories.audit_repository import AuditRepository
from mcp_sentinel.repositories.customer_repository import CustomerRepository
from mcp_sentinel.repositories.order_repository import OrderRepository
from mcp_sentinel.server.app import create_app
from mcp_sentinel.services.audit_service import AuditService
from mcp_sentinel.services.customer_service import CustomerService
from mcp_sentinel.services.order_service import OrderService


@pytest.fixture
def integrated_mcp_server(db_pool):
    cust_repo = CustomerRepository(pool=db_pool)
    appr_repo = ApprovalRepository(pool=db_pool)
    ord_repo = OrderRepository(pool=db_pool)
    aud_repo = AuditRepository(pool=db_pool)

    cust_svc = CustomerService(
        customer_repo=cust_repo, approval_repo=appr_repo, audit_repo=aud_repo
    )
    ord_svc = OrderService(order_repo=ord_repo, audit_repo=aud_repo)
    aud_svc = AuditService(audit_repo=aud_repo)

    return create_app(
        customer_service=cust_svc,
        order_service=ord_svc,
        audit_service=aud_svc,
    )


def extract_data(res) -> dict:
    if hasattr(res, "structured_content") and res.structured_content:
        return res.structured_content
    elif hasattr(res, "content") and res.content and hasattr(res.content[0], "text"):
        return json.loads(res.content[0].text)
    elif isinstance(res, dict):
        return res
    return res


# =============================================================================
# 1. MCP READ TOOLS: ALLOWED PATHWAY
# =============================================================================


@pytest.mark.asyncio
async def test_mcp_integration_read_allowed(integrated_mcp_server):
    """Verifies that safe read tool passes through policy engine and executes successfully."""
    res = await integrated_mcp_server.call_tool(
        name="get_customer",
        arguments={"customer_id": "CUST-000001"},
    )
    data = extract_data(res)
    assert data["status"] == "success"
    assert data["customer"]["customer_code"] == "CUST-000001"


# =============================================================================
# 2. MCP DESTRUCTIVE TOOLS: BLOCKED PATHWAY
# =============================================================================


@pytest.mark.asyncio
async def test_mcp_integration_delete_without_approval_blocked(integrated_mcp_server, db_pool):
    """Verifies that delete_customer without approved ticket is halted by policy engine before DB."""
    res = await integrated_mcp_server.call_tool(
        name="delete_customer",
        arguments={
            "customer_id": "CUST-000001",
            "approval_ticket": "NO-TICKET",
            "reason": "Unauthorized deletion attempt via MCP",
        },
    )
    data = extract_data(res)
    assert data["status"] in ("rejected", "approval_required")
    assert data.get("decision") == "REQUIRE_APPROVAL" or "Access Denied" in str(
        data.get("message", "")
    )

    # Verify customer was NOT deleted
    async with db_pool.acquire() as conn:
        exists = await conn.fetchval("SELECT 1 FROM customers WHERE id = 1")
        assert exists is not None


# =============================================================================
# 3. MCP DESTRUCTIVE TOOLS: AUTHORIZED PATHWAY
# =============================================================================


@pytest.mark.asyncio
async def test_mcp_integration_delete_with_verified_approval_succeeds(
    integrated_mcp_server, db_pool
):
    """Verifies that delete_customer with pre-staged valid ticket is ALLOWED and succeeds."""
    async with db_pool.acquire() as conn:
        cid = await conn.fetchval(
            """
            INSERT INTO customers (name, email, tier, status, country)
            VALUES ('Target MCP Test', 'target_mcp@example.test', 'standard', 'inactive', 'US')
            RETURNING id
            """
        )
        ticket = f"TICKET-MCP-DEL-{cid}"
        await conn.execute(
            """
            INSERT INTO gating_approval_tickets (ticket_id, target_id, action, approved, consumed, expires_at)
            VALUES ($1, $2, 'DELETE_CUSTOMER', TRUE, FALSE, NOW() + INTERVAL '1 hour')
            """,
            ticket,
            str(cid),
        )

    res = await integrated_mcp_server.call_tool(
        name="delete_customer",
        arguments={
            "customer_id": cid,
            "approval_ticket": ticket,
            "reason": "Authorized deletion via MCP",
        },
    )
    data = extract_data(res)
    assert data["status"] == "success"
    assert data["deleted_records"] == 1

    # Verify customer is actually deleted
    async with db_pool.acquire() as conn:
        exists = await conn.fetchval("SELECT 1 FROM customers WHERE id = $1", cid)
        assert exists is None


# =============================================================================
# 4. MCP CLIENT INTEGRATION
# =============================================================================


@pytest.mark.asyncio
async def test_mcp_client_e2e_policy_flow(integrated_mcp_server):
    """Verifies SentinelMCPClient calling server passes through Policy Engine."""
    client = SentinelMCPClient(server_instance=integrated_mcp_server)

    # 1. Read succeeds
    read_res = await client.call_tool("get_customer", {"customer_id": "CUST-000002"})
    assert read_res["status"] == "success"

    # 2. Unapproved delete blocked
    del_res = await client.call_tool(
        "delete_customer",
        {
            "customer_id": "CUST-000002",
            "approval_ticket": "NONE",
            "reason": "Testing client policy gate",
        },
    )
    assert del_res["status"] in ("approval_required", "rejected")
