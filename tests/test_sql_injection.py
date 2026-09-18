"""
Category C: SQL Injection Defense Tests.
Verifies complete neutralization of arbitrary SQL injection attacks:
- Classical tautologies (' OR 1=1)
- Statement stacking (; DROP TABLE)
- UNION SELECT credential extraction
- Comment truncation (--)
- Prohibited legacy raw SQL parameters (query_filter)
Confirms all attacks are blocked and database tables remain untouched.
"""

import pytest

from mcp_sentinel.security.exceptions import (
    SecurityValidationError,
    SecurityViolationError,
)
from mcp_sentinel.security.filters import SecureQueryBuilder
from mcp_sentinel.tools.query_tools import handle_query_customer_records

SQLI_ATTACK_PAYLOADS = [
    "1' OR '1'='1",
    "' OR 1=1 --",
    "admin' --",
    "1; DROP TABLE customers;",
    "1); DROP TABLE customers;--",
    "' UNION SELECT id, password, 'a', 'b', 'c', 'd', NOW() FROM users--",
    "active' AND 1=cast((SELECT table_name FROM information_schema.tables LIMIT 1) as int)--",
    "active' OR (SELECT COUNT(*) FROM customers) > 0 --",
    "'; EXEC xp_cmdshell('dir');--",
    "' OR EXISTS(SELECT 1 FROM pg_user)--",
]


def test_builder_rejects_raw_query_filter_parameter():
    """Verifies that attempting to supply a raw query_filter raises SecurityViolationError."""
    with pytest.raises(SecurityViolationError):
        SecureQueryBuilder.build_customer_query(
            filters={"query_filter": "1=1; DROP TABLE customers;"},
            limit=50,
        )


def test_builder_rejects_unsupported_filter_keys():
    """Verifies that non-allowlisted filter keys are rejected."""
    with pytest.raises(SecurityValidationError):
        SecureQueryBuilder.build_customer_query(
            filters={"role": "admin", "department": "engineering"},
            limit=50,
        )


@pytest.mark.parametrize("payload", SQLI_ATTACK_PAYLOADS)
def test_builder_safely_binds_status_parameter(payload):
    """
    Verifies that malicious payloads in allowlisted string fields are strictly bound
    as literal parameters ($1) and never interpolated into SQL structure.
    """
    sql, params = SecureQueryBuilder.build_customer_query(
        filters={"status": payload},
        limit=50,
    )
    # The generated SQL must NEVER contain raw payload text
    assert payload not in sql
    assert "status = $1" in sql
    assert params[0] == payload.strip().lower()


@pytest.mark.parametrize("payload", SQLI_ATTACK_PAYLOADS)
def test_builder_rejects_malicious_sort_by(payload):
    """Verifies that SQL injection in sort_by is blocked."""
    with pytest.raises(SecurityValidationError):
        SecureQueryBuilder.build_customer_query(
            sort_by=payload,
            limit=50,
        )


@pytest.mark.parametrize("payload", SQLI_ATTACK_PAYLOADS)
def test_builder_rejects_malicious_sort_order(payload):
    """Verifies that SQL injection in sort_order is blocked."""
    with pytest.raises(SecurityValidationError):
        SecureQueryBuilder.build_customer_query(
            sort_order=payload,
            limit=50,
        )


@pytest.mark.asyncio
async def test_tool_handler_neutralizes_sqli_end_to_end(customer_repo, db_pool):
    """
    End-to-end test executing malicious queries against real PostgreSQL database.
    Demonstrates that malicious strings fail or are safely treated as exact literals,
    and database customers table remains intact.
    """
    # 1. Attempt raw query_filter
    raw_attack = {"query_filter": "1=1; DROP TABLE customers;"}
    res1 = await handle_query_customer_records(customer_repo, raw_attack)
    assert res1["status"] == "error"

    # 2. Attempt stack injection via status filter
    attack_args = {
        "filters": {"status": "inactive'; DROP TABLE customers;--"},
        "limit": 10,
    }
    # Schema validation or parameterized query treats it as string literal
    res2 = await handle_query_customer_records(customer_repo, attack_args)
    # Either validation error or empty result (since no customer has status="inactive'; DROP TABLE...")
    if res2["status"] == "success":
        assert res2["count"] == 0

    # 3. Verify database tables are completely intact
    async with db_pool.acquire() as conn:
        table_exists = await conn.fetchval(
            "SELECT 1 FROM information_schema.tables WHERE table_name = 'customers'"
        )
        assert table_exists == 1
        count = await conn.fetchval("SELECT COUNT(*) FROM customers")
        assert count == 8  # all 8 seeded customers remain
