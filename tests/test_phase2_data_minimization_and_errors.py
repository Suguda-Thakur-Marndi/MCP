"""
Phase 2 Data Minimization, Result Limits, and Error Sanitization Tests:
Verifies:
- Only approved fields are returned by customer and order tools.
- Strict server-side result limit bounds (1-100).
- Error responses never leak stack traces, database DSNs, or internal SQL.
"""

import pytest

from mcp_sentinel.repositories.customer_repository import CustomerRepository
from mcp_sentinel.repositories.order_repository import OrderRepository
from mcp_sentinel.services.customer_service import CustomerService
from mcp_sentinel.services.order_service import OrderService
from mcp_sentinel.tools.customer_tools import (
    handle_get_customer,
    handle_query_customer_records,
)
from mcp_sentinel.tools.order_tools import (
    handle_get_customer_orders,
    handle_get_order,
)


@pytest.mark.asyncio
async def test_get_customer_data_minimization(db_pool):
    """Verifies get_customer returns only approved fields, no internal infrastructure details."""
    cust_repo = CustomerRepository(pool=db_pool)
    cust_svc = CustomerService(customer_repo=cust_repo)

    res = await handle_get_customer(
        raw_args={"customer_id": 1},
        service=cust_svc,
    )
    assert res["status"] == "success"
    cust = res["customer"]

    allowed_fields = {
        "id",
        "customer_code",
        "name",
        "email",
        "country",
        "status",
        "tier",
        "created_at",
        "updated_at",
    }
    assert set(cust.keys()).issubset(allowed_fields)

    # Prohibited fields
    prohibited = ["password", "hash", "secret", "token", "db_url", "dsn", "table", "port"]
    for k in cust.keys():
        for p in prohibited:
            assert p not in k.lower()


@pytest.mark.asyncio
async def test_get_order_data_minimization(db_pool):
    """Verifies get_order returns only approved fields."""
    order_repo = OrderRepository(pool=db_pool)
    order_svc = OrderService(order_repo=order_repo)

    # Ensure an order exists
    async with db_pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO orders (order_number, customer_id, status, total_amount, currency)
            VALUES ('ORD-MIN-001', 1, 'completed', 50.00, 'USD')
            ON CONFLICT (order_number) DO NOTHING
            """
        )

    res = await handle_get_order(
        raw_args={"order_id": "ORD-MIN-001"},
        service=order_svc,
    )
    assert res["status"] == "success"
    order = res["order"]

    allowed_fields = {
        "id",
        "order_number",
        "customer_id",
        "status",
        "total_amount",
        "currency",
        "created_at",
    }
    assert set(order.keys()).issubset(allowed_fields)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "limit_val, expected_status",
    [
        (1, "success"),
        (50, "success"),
        (100, "success"),
        (101, "error"),
        (10000, "error"),
        (-1, "error"),
        (0, "error"),
    ],
)
async def test_query_customer_records_limit_bounds(limit_val, expected_status, db_pool):
    """Verifies strict server-side capping / rejection for customer query limits."""
    cust_repo = CustomerRepository(pool=db_pool)
    cust_svc = CustomerService(customer_repo=cust_repo)

    res = await handle_query_customer_records(
        raw_args={"limit": limit_val},
        service=cust_svc,
    )
    assert res["status"] == expected_status
    if expected_status == "error":
        assert "validation" in res["message"].lower() or "limit" in res["message"].lower()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "limit_val, expected_status",
    [
        (1, "success"),
        (100, "success"),
        (101, "error"),
        (5000, "error"),
    ],
)
async def test_get_customer_orders_limit_bounds(limit_val, expected_status, db_pool):
    """Verifies strict server-side bounds for get_customer_orders limit."""
    order_repo = OrderRepository(pool=db_pool)
    order_svc = OrderService(order_repo=order_repo)

    res = await handle_get_customer_orders(
        raw_args={"customer_id": 1, "limit": limit_val},
        service=order_svc,
    )
    assert res["status"] == expected_status


@pytest.mark.asyncio
async def test_error_response_does_not_leak_internals():
    """Forces validation errors and verifies no database internals or paths are in messages."""
    res = await handle_get_customer(
        raw_args={"customer_id": "NOT-A-VALID-ID"},
    )
    assert res["status"] == "error"
    msg = res["message"]

    forbidden_tokens = [
        "postgres://",
        "password",
        "SELECT",
        "FROM customers",
        "Traceback",
        'File "',
        ".py:",
    ]
    for token in forbidden_tokens:
        assert token not in msg
