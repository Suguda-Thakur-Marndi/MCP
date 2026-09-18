"""
Phase 2 MCP Server Integration Tests:
Exercises the real end-to-end integration path:
MCP Client / Server Invocation
    ↓
FastMCP Tool Dispatch
    ↓
Service Layer
    ↓
Repository Layer
    ↓
PostgreSQL Database
"""

import pytest

from mcp_sentinel.repositories.approval_repository import ApprovalRepository
from mcp_sentinel.repositories.audit_repository import AuditRepository
from mcp_sentinel.repositories.customer_repository import CustomerRepository
from mcp_sentinel.repositories.order_repository import OrderRepository
from mcp_sentinel.server.app import create_app
from mcp_sentinel.services.audit_service import AuditService
from mcp_sentinel.services.customer_service import CustomerService
from mcp_sentinel.services.order_service import OrderService


@pytest.fixture
def integrated_server(db_pool):
    """Initializes FastMCP server connected to the real PostgreSQL database pool."""
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


@pytest.mark.asyncio
async def test_mcp_integration_list_tools(integrated_server):
    """Verifies that all 8 tools are properly registered and discoverable on the FastMCP server."""
    tools = await integrated_server.list_tools()
    tool_names = {t.name for t in tools}

    expected_tools = {
        "query_customer_records",
        "get_customer",
        "get_customer_orders",
        "get_order",
        "append_customer_audit_note",
        "update_customer",
        "delete_customer",
        "purge_inactive_customer_data",
    }
    assert expected_tools.issubset(tool_names)

    # Confirm raw SQL tool is ABSOLUTELY NOT registered
    forbidden_tools = {"execute_sql", "run_sql", "raw_sql", "execute_query", "raw_database_query"}
    for f in forbidden_tools:
        assert f not in tool_names


@pytest.mark.asyncio
async def test_mcp_integration_query_customer_records(integrated_server):
    """Verifies calling query_customer_records through the FastMCP server layer."""
    res = await integrated_server.call_tool(
        name="query_customer_records",
        arguments={"limit": 3, "sort_by": "created_at", "sort_order": "DESC"},
    )
    assert res is not None
    # Depending on FastMCP version, call_tool returns content or raw result
    # Let's inspect result structure
    if hasattr(res, "structured_content") and res.structured_content:
        data = res.structured_content
    elif hasattr(res, "content") and res.content and hasattr(res.content[0], "text"):
        import json

        data = json.loads(res.content[0].text)
    elif isinstance(res, dict):
        data = res
    else:
        data = res

    assert data is not None
    assert data["status"] == "success"


@pytest.mark.asyncio
async def test_mcp_integration_destructive_tool_gating(integrated_server):
    """Verifies calling delete_customer without approval through FastMCP server fails closed."""
    res = await integrated_server.call_tool(
        name="delete_customer",
        arguments={
            "customer_id": "CUST-000001",
            "approval_ticket": "TICKET-UNAUTHORIZED",
            "reason": "Unauthorized integration test call",
        },
    )
    assert res is not None
    if hasattr(res, "structured_content") and res.structured_content:
        data = res.structured_content
    elif hasattr(res, "content") and res.content and hasattr(res.content[0], "text"):
        import json

        data = json.loads(res.content[0].text)
    elif isinstance(res, dict):
        data = res
    else:
        data = res

    assert data["status"] in ("error", "rejected")
