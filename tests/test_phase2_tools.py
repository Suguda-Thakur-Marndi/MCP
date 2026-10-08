"""
Phase 2 MCP Tool Handlers Tests:
Tests each of the 8 controlled enterprise tools:
1. query_customer_records
2. get_customer
3. get_customer_orders
4. get_order
5. append_customer_audit_note
6. update_customer
7. delete_customer
8. purge_inactive_customer_data
"""

import pytest

from mcp_sentinel.repositories.approval_repository import ApprovalRepository
from mcp_sentinel.repositories.audit_repository import AuditRepository
from mcp_sentinel.repositories.customer_repository import CustomerRepository
from mcp_sentinel.repositories.order_repository import OrderRepository
from mcp_sentinel.services.audit_service import AuditService
from mcp_sentinel.services.customer_service import CustomerService
from mcp_sentinel.services.order_service import OrderService
from mcp_sentinel.tools.audit_tools import handle_append_customer_audit_note
from mcp_sentinel.tools.customer_tools import (
    handle_delete_customer,
    handle_get_customer,
    handle_purge_inactive_customer_data,
    handle_query_customer_records,
    handle_update_customer,
)
from mcp_sentinel.tools.order_tools import (
    handle_get_customer_orders,
    handle_get_order,
)


@pytest.fixture
def services(db_pool):
    cust_repo = CustomerRepository(pool=db_pool)
    appr_repo = ApprovalRepository(pool=db_pool)
    ord_repo = OrderRepository(pool=db_pool)
    aud_repo = AuditRepository(pool=db_pool)

    cust_svc = CustomerService(
        customer_repo=cust_repo, approval_repo=appr_repo, audit_repo=aud_repo
    )
    ord_svc = OrderService(order_repo=ord_repo, audit_repo=aud_repo)
    aud_svc = AuditService(audit_repo=aud_repo)

    return {
        "cust_repo": cust_repo,
        "appr_repo": appr_repo,
        "ord_repo": ord_repo,
        "aud_repo": aud_repo,
        "cust_svc": cust_svc,
        "ord_svc": ord_svc,
        "aud_svc": aud_svc,
    }


# =============================================================================
# 1. query_customer_records
# =============================================================================
@pytest.mark.asyncio
async def test_tool_query_customer_records(services):
    res = await handle_query_customer_records(
        raw_args={"limit": 5, "offset": 0, "sort_by": "name", "sort_order": "ASC"},
        service=services["cust_svc"],
    )
    assert res["status"] == "success"
    assert "records" in res
    assert len(res["records"]) <= 5
    for r in res["records"]:
        assert "id" in r
        assert "name" in r
        assert "email" in r


# =============================================================================
# 2. get_customer
# =============================================================================
@pytest.mark.asyncio
async def test_tool_get_customer_success(services):
    res = await handle_get_customer(
        raw_args={"customer_id": 1},
        service=services["cust_svc"],
    )
    assert res["status"] == "success"
    cust = res["customer"]
    assert cust["id"] == 1
    assert "name" in cust
    assert "email" in cust
    assert "customer_code" in cust


@pytest.mark.asyncio
async def test_tool_get_customer_by_formatted_code(services):
    res = await handle_get_customer(
        raw_args={"customer_id": "CUST-000001"},
        service=services["cust_svc"],
    )
    assert res["status"] == "success"
    assert res["customer"]["id"] == 1


@pytest.mark.asyncio
async def test_tool_get_customer_not_found(services):
    res = await handle_get_customer(
        raw_args={"customer_id": 999999},
        service=services["cust_svc"],
    )
    assert res["status"] == "not_found"
    assert res["customer"] is None
    assert "not found" in res["message"].lower()


# =============================================================================
# 3. get_customer_orders
# =============================================================================
@pytest.mark.asyncio
async def test_tool_get_customer_orders(services, db_pool):
    # Ensure test order exists for customer 1
    async with db_pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO orders (order_number, customer_id, status, total_amount, currency)
            VALUES ('ORD-TOOL-001', 1, 'completed', 89.50, 'USD')
            ON CONFLICT (order_number) DO NOTHING
            """
        )

    res = await handle_get_customer_orders(
        raw_args={"customer_id": "CUST-000001", "limit": 10},
        service=services["ord_svc"],
    )
    assert res["status"] == "success"
    assert res["customer_id"] == 1
    assert len(res["orders"]) >= 1
    order = res["orders"][0]
    assert "order_number" in order
    assert "total_amount" in order
    assert "status" in order


# =============================================================================
# 4. get_order
# =============================================================================
@pytest.mark.asyncio
async def test_tool_get_order_by_number(services, db_pool):
    async with db_pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO orders (order_number, customer_id, status, total_amount, currency)
            VALUES ('ORD-LOOKUP-777', 1, 'processing', 250.00, 'USD')
            ON CONFLICT (order_number) DO NOTHING
            """
        )

    res = await handle_get_order(
        raw_args={"order_id": "ORD-LOOKUP-777"},
        service=services["ord_svc"],
    )
    assert res["status"] == "success"
    assert res["order"]["order_number"] == "ORD-LOOKUP-777"
    assert res["order"]["total_amount"] == 250.00


@pytest.mark.asyncio
async def test_tool_get_order_not_found(services):
    res = await handle_get_order(
        raw_args={"order_id": "ORD-NONEXISTENT"},
        service=services["ord_svc"],
    )
    assert res["status"] == "not_found"
    assert res["order"] is None


# =============================================================================
# 5. append_customer_audit_note
# =============================================================================
@pytest.mark.asyncio
async def test_tool_append_customer_audit_note(services):
    res = await handle_append_customer_audit_note(
        raw_args={
            "customer_id": "CUST-000001",
            "note": "Administrative KYC re-validation completed.",
            "author_id": "sec_agent_99",
        },
        service=services["aud_svc"],
    )
    assert res["status"] == "success"
    assert res["note_id"] > 0
    assert res["customer_id"] == 1


# =============================================================================
# 6. update_customer
# =============================================================================
@pytest.mark.asyncio
async def test_tool_update_customer_allowed_fields(services):
    """Low-risk updates (country, active status) remain ungated without approval ticket."""
    res = await handle_update_customer(
        raw_args={
            "customer_id": "CUST-000002",
            "status": "active",
            "country": "US",
        },
        service=services["cust_svc"],
    )
    assert res["status"] == "success"
    cust = res["customer"]
    assert cust["id"] == 2
    assert cust["status"] == "active"
    assert cust["country"] == "US"


@pytest.mark.asyncio
async def test_tool_update_customer_high_impact_status_blocked_without_ticket(services):
    """High-impact updates (suspended, banned, closed) require approval ticket and are rejected without one."""
    res = await handle_update_customer(
        raw_args={
            "customer_id": "CUST-000002",
            "status": "suspended",
        },
        service=services["cust_svc"],
    )
    assert res["status"] == "rejected"
    assert "strictly requires" in res.get("message", "").lower()


@pytest.mark.asyncio
async def test_tool_update_customer_high_impact_status_allowed_with_ticket(services, db_pool):
    """High-impact status updates succeed when a valid approval ticket is provided."""
    # Stage valid approval ticket for updating customer 2
    async with db_pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO gating_approval_tickets (ticket_id, target_id, action, approved, consumed, expires_at)
            VALUES ('TICKET-UPDATE-SUSPEND-002', '2', 'update_customer', TRUE, FALSE, NOW() + INTERVAL '1 hour')
            ON CONFLICT (ticket_id) DO UPDATE SET approved = TRUE, consumed = FALSE
            """
        )

    res = await handle_update_customer(
        raw_args={
            "customer_id": "CUST-000002",
            "status": "suspended",
            "approval_ticket": "TICKET-UPDATE-SUSPEND-002",
        },
        service=services["cust_svc"],
    )
    assert res["status"] == "success"
    assert res["customer"]["status"] == "suspended"


# =============================================================================
# 7. delete_customer (Destructive)
# =============================================================================
@pytest.mark.asyncio
async def test_tool_delete_customer_blocked_without_ticket(services):
    res = await handle_delete_customer(
        raw_args={
            "customer_id": 4,
            "approval_ticket": "",
            "reason": "Unauthorized deletion attempt",
        },
        service=services["cust_svc"],
    )
    assert res["status"] in ("error", "rejected")


@pytest.mark.asyncio
async def test_tool_delete_customer_with_authorized_ticket(services, db_pool):
    # Stage a temporary customer and valid approval ticket
    async with db_pool.acquire() as conn:
        cid = await conn.fetchval(
            """
            INSERT INTO customers (name, email, tier, status, country)
            VALUES ('Target To Delete', 'delete_me@example.test', 'standard', 'inactive', 'US')
            RETURNING id
            """
        )
        ticket = f"TICKET-DEL-{cid}"
        await conn.execute(
            """
            INSERT INTO gating_approval_tickets (ticket_id, target_id, action, approved, consumed, expires_at)
            VALUES ($1, $2, 'DELETE_CUSTOMER', TRUE, FALSE, NOW() + INTERVAL '1 hour')
            """,
            ticket,
            str(cid),
        )

    res = await handle_delete_customer(
        raw_args={
            "customer_id": cid,
            "approval_ticket": ticket,
            "reason": "Authorized account deletion request",
        },
        service=services["cust_svc"],
    )
    assert res["status"] == "success"
    assert res["deleted_records"] == 1


# =============================================================================
# 8. purge_inactive_customer_data (Destructive)
# =============================================================================
@pytest.mark.asyncio
async def test_tool_purge_inactive_bulk_dry_run(services, db_pool):
    # Stage approval ticket for bulk purge
    ticket = "TICKET-BULK-PURGE-PREVIEW"
    async with db_pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO gating_approval_tickets (ticket_id, target_id, action, approved, consumed, expires_at)
            VALUES ($1, '90', 'PURGE', TRUE, FALSE, NOW() + INTERVAL '1 hour')
            ON CONFLICT (ticket_id) DO UPDATE SET consumed = FALSE
            """,
            ticket,
        )

    res = await handle_purge_inactive_customer_data(
        raw_args={
            "approval_ticket": ticket,
            "inactivity_days": 90,
            "dry_run": True,
            "reason": "Preview dormant customers over 90 days",
        },
        service=services["cust_svc"],
    )
    assert res["status"] == "preview"
    assert res["dry_run"] is True
    assert "matched_records" in res
    assert res["deleted_records"] == 0
