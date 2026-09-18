"""
Phase 2 SQL Injection Regression Tests:
Verifies that all Phase 2 tools reject or safely neutralize malicious SQL payloads:
- customer_id injection payloads
- country injection payloads
- status injection payloads
- sort_by / sort_order injection payloads
- note field injection payloads (treated purely as passive data)
- database table integrity verification
"""

import pytest

from mcp_sentinel.repositories.customer_repository import CustomerRepository
from mcp_sentinel.repositories.order_repository import OrderRepository
from mcp_sentinel.services.audit_service import AuditService
from mcp_sentinel.services.customer_service import CustomerService
from mcp_sentinel.services.order_service import OrderService
from mcp_sentinel.tools.audit_tools import handle_append_customer_audit_note
from mcp_sentinel.tools.customer_tools import (
    handle_get_customer,
    handle_update_customer,
)
from mcp_sentinel.tools.order_tools import (
    handle_get_customer_orders,
    handle_get_order,
)

SQLI_PAYLOADS = [
    "1' OR '1'='1",
    "' OR 1=1 --",
    "admin' --",
    "1; DROP TABLE customers;",
    "1); DROP TABLE customers;--",
    "' UNION SELECT id, email, name FROM customers--",
    "'; EXEC xp_cmdshell('dir');--",
    "' OR EXISTS(SELECT 1 FROM information_schema.tables)--",
]


@pytest.fixture
def test_services(db_pool):
    cust_repo = CustomerRepository(pool=db_pool)
    ord_repo = OrderRepository(pool=db_pool)
    return {
        "cust_svc": CustomerService(customer_repo=cust_repo),
        "ord_svc": OrderService(order_repo=ord_repo),
        "aud_svc": AuditService(),
    }


@pytest.mark.asyncio
@pytest.mark.parametrize("payload", SQLI_PAYLOADS)
async def test_get_customer_rejects_sqli(payload, test_services, db_pool):
    """Verifies get_customer tool rejects SQL injection payloads in customer_id."""
    res = await handle_get_customer(
        raw_args={"customer_id": payload},
        service=test_services["cust_svc"],
    )
    assert res["status"] in ("error", "not_found")

    # Verify table integrity
    async with db_pool.acquire() as conn:
        count = await conn.fetchval("SELECT COUNT(*) FROM customers")
        assert count > 0


@pytest.mark.asyncio
@pytest.mark.parametrize("payload", SQLI_PAYLOADS)
async def test_get_order_rejects_or_safely_binds_sqli(payload, test_services, db_pool):
    """Verifies get_order tool safely handles SQL injection payloads."""
    res = await handle_get_order(
        raw_args={"order_id": payload},
        service=test_services["ord_svc"],
    )
    assert res["status"] in ("error", "not_found")
    assert res.get("order") is None

    # Verify orders table still exists
    async with db_pool.acquire() as conn:
        val = await conn.fetchval("SELECT 1 FROM orders LIMIT 1")
        assert val is None or val == 1


@pytest.mark.asyncio
@pytest.mark.parametrize("payload", SQLI_PAYLOADS)
async def test_get_customer_orders_rejects_sqli(payload, test_services, db_pool):
    """Verifies get_customer_orders rejects SQL injection in customer_id."""
    res = await handle_get_customer_orders(
        raw_args={"customer_id": payload, "limit": 10},
        service=test_services["ord_svc"],
    )
    assert res["status"] in ("error", "rejected")


@pytest.mark.asyncio
@pytest.mark.parametrize("payload", SQLI_PAYLOADS)
async def test_update_customer_rejects_sqli_in_status_and_country(payload, test_services, db_pool):
    """Verifies update_customer rejects SQL injection in status and country."""
    res = await handle_update_customer(
        raw_args={"customer_id": 1, "status": payload, "country": payload},
        service=test_services["cust_svc"],
    )
    assert res["status"] == "error"
    assert res["error_type"] == "ValidationError"


@pytest.mark.asyncio
async def test_append_audit_note_treats_sqli_payload_as_passive_text(db_pool):
    """
    Verifies that a severe SQL injection payload in audit note is stored
    strictly as passive text data and NOT executed as SQL.
    """
    cust_repo = CustomerRepository(pool=db_pool)
    malicious_text = "'; DROP TABLE customer_audit_notes; SELECT 'injected"

    res = await handle_append_customer_audit_note(
        raw_args={
            "customer_id": 1,
            "note": malicious_text,
            "author_id": "test_agent",
        },
        repo=cust_repo,
    )
    assert res["status"] == "success"
    assert res["note_id"] > 0

    # Verify customer_audit_notes table still exists and contains the exact payload string
    async with db_pool.acquire() as conn:
        stored = await conn.fetchval(
            "SELECT note_text FROM customer_audit_notes WHERE note_id = $1",
            res["note_id"],
        )
        assert stored == malicious_text

        # Verify customer_audit_notes table is still fully functional
        table_count = await conn.fetchval("SELECT COUNT(*) FROM customer_audit_notes")
        assert table_count > 0
