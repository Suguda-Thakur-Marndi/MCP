"""
Category E: Database Integration & Pooling Tests.
Verifies:
- Connection pooling lifecycle.
- Parameterized execution.
- Transactional integrity and projection constraints.
"""

import pytest

from mcp_sentinel.database.connection import check_db_health
from mcp_sentinel.security.exceptions import SecurityValidationError


@pytest.mark.asyncio
async def test_database_health_check_passes():
    """Verifies that pool health check returns True on active database."""
    healthy = await check_db_health()
    assert healthy is True


@pytest.mark.asyncio
async def test_customer_read_projection_columns(customer_repo):
    """Verifies that only approved columns are returned (no secret/unauthorized columns)."""
    records = await customer_repo.query_customers(limit=5)
    assert len(records) > 0
    first = records[0]
    expected_cols = {"id", "name", "email", "tier", "status", "country", "created_at"}
    assert set(first.keys()) == expected_cols


@pytest.mark.asyncio
async def test_customer_read_with_status_filter(customer_repo):
    """Verifies parameterized status filtering."""
    inactive_records = await customer_repo.query_customers(filters={"status": "inactive"})
    assert len(inactive_records) > 0
    for r in inactive_records:
        assert r["status"] == "inactive"


@pytest.mark.asyncio
async def test_customer_read_with_country_filter(customer_repo):
    """Verifies parameterized country filtering."""
    in_records = await customer_repo.query_customers(filters={"country": "IN"})
    assert len(in_records) > 0
    for r in in_records:
        assert r["country"] == "IN"


@pytest.mark.asyncio
async def test_customer_append_audit_note_success(customer_repo):
    """Verifies appending an audit note to an existing customer."""
    res = await customer_repo.append_audit_note(
        customer_id=1,
        author_id="test_auditor",
        note_text="Automated integration test audit note.",
    )
    assert res["status"] == "success"
    assert res["note_id"] > 0
    assert res["customer_id"] == 1


@pytest.mark.asyncio
async def test_customer_append_audit_note_non_existent_customer(customer_repo):
    """Verifies that attempting to append a note to non-existent customer is rejected."""
    with pytest.raises(SecurityValidationError):
        await customer_repo.append_audit_note(
            customer_id=99999,
            author_id="test_auditor",
            note_text="Note for ghost customer",
        )
