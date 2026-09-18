"""
Phase 2 Database Tests:
- Relational integrity, constraints, orders, and audit persistence.
- Cascading foreign keys.
- Parameterized order and audit operations.
"""

import asyncpg
import pytest

from mcp_sentinel.repositories.audit_repository import AuditRepository
from mcp_sentinel.repositories.customer_repository import CustomerRepository
from mcp_sentinel.repositories.order_repository import OrderRepository


@pytest.mark.asyncio
async def test_order_repository_lookup_by_number(db_pool):
    """Verifies parameterized order lookup by enterprise order_number."""
    order_repo = OrderRepository(pool=db_pool)

    # Insert a synthetic order
    async with db_pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO orders (order_number, customer_id, status, total_amount, currency)
            VALUES ('ORD-TEST-0001', 1, 'completed', 199.99, 'USD')
            ON CONFLICT (order_number) DO NOTHING
            """
        )

    order = await order_repo.get_order_by_id_or_number("ORD-TEST-0001")
    assert order is not None
    assert order["order_number"] == "ORD-TEST-0001"
    assert order["customer_id"] == 1
    assert order["status"] == "completed"
    assert order["total_amount"] == 199.99
    assert order["currency"] == "USD"
    assert "id" in order
    assert "created_at" in order


@pytest.mark.asyncio
async def test_order_repository_customer_orders_pagination(db_pool):
    """Verifies customer orders query with bounded pagination."""
    order_repo = OrderRepository(pool=db_pool)

    # Insert 3 orders for customer 2
    async with db_pool.acquire() as conn:
        for i in range(1, 4):
            await conn.execute(
                f"""
                INSERT INTO orders (order_number, customer_id, status, total_amount, currency)
                VALUES ('ORD-PAGINATE-{i}', 2, 'processing', {i * 50.0}, 'USD')
                ON CONFLICT (order_number) DO NOTHING
                """
            )

    orders = await order_repo.get_orders_by_customer_id(customer_id=2, limit=2, offset=0)
    assert len(orders) == 2
    assert orders[0]["customer_id"] == 2

    # Offset pagination
    orders_next = await order_repo.get_orders_by_customer_id(customer_id=2, limit=2, offset=2)
    assert len(orders_next) >= 1


@pytest.mark.asyncio
async def test_orders_foreign_key_cascade_on_customer_delete(db_pool):
    """Verifies that deleting a customer cascades cleanly to orders."""
    customer_repo = CustomerRepository(pool=db_pool)
    order_repo = OrderRepository(pool=db_pool)

    # Create temporary customer with unique email
    async with db_pool.acquire() as conn:
        cust_id = await conn.fetchval(
            """
            INSERT INTO customers (name, email, tier, status, country)
            VALUES ('Cascade Test', 'cascade@example.test', 'standard', 'inactive', 'US')
            RETURNING id
            """
        )
        await conn.execute(
            """
            INSERT INTO orders (order_number, customer_id, status, total_amount, currency)
            VALUES ('ORD-CASCADE-01', $1, 'pending', 49.99, 'USD')
            """,
            cust_id,
        )

    # Confirm order exists
    order = await order_repo.get_order_by_id_or_number("ORD-CASCADE-01")
    assert order is not None

    # Delete customer
    deleted = await customer_repo.delete_customer(cust_id)
    assert deleted == 1

    # Confirm order was cascade deleted
    order_after = await order_repo.get_order_by_id_or_number("ORD-CASCADE-01")
    assert order_after is None


@pytest.mark.asyncio
async def test_order_negative_amount_check_constraint(db_pool):
    """Verifies database-level check constraint rejects negative total_amount."""
    async with db_pool.acquire() as conn:
        with pytest.raises(asyncpg.CheckViolationError):
            await conn.execute(
                """
                INSERT INTO orders (order_number, customer_id, status, total_amount, currency)
                VALUES ('ORD-ILLEGAL-NEG', 1, 'pending', -10.00, 'USD')
                """
            )


@pytest.mark.asyncio
async def test_order_invalid_status_check_constraint(db_pool):
    """Verifies database-level check constraint rejects illegal status values."""
    async with db_pool.acquire() as conn:
        with pytest.raises(asyncpg.CheckViolationError):
            await conn.execute(
                """
                INSERT INTO orders (order_number, customer_id, status, total_amount, currency)
                VALUES ('ORD-ILLEGAL-STATUS', 1, 'hacked_status', 100.00, 'USD')
                """
            )


@pytest.mark.asyncio
async def test_audit_event_persistence(db_pool):
    """Verifies writing and querying structured audit events in audit_events table."""
    audit_repo = AuditRepository(pool=db_pool)

    event_id = await audit_repo.record_audit_event(
        event_type="TOOL_EXECUTED",
        tool_name="get_order",
        decision="ALLOWED",
        actor_type="agent",
        actor_id="test_agent",
        request_id="req-test-p2-audit-01",
        details={"test_key": "test_value"},
    )
    assert event_id is not None and event_id > 0

    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT event_type, tool_name, decision, request_id FROM audit_events WHERE id = $1",
            event_id,
        )
        assert row is not None
        assert row["event_type"] == "TOOL_EXECUTED"
        assert row["tool_name"] == "get_order"
        assert row["decision"] == "ALLOWED"
        assert row["request_id"] == "req-test-p2-audit-01"
