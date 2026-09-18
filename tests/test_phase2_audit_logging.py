"""
Phase 2 Audit Logging Tests:
Verifies that:
- Every tool call produces a structured security audit event.
- Blocked destructive actions produce an audit record.
- Successful executions produce an audit record.
- Input validation failures produce audit logs.
- Correlation request_id is consistently present.
"""

import pytest

from mcp_sentinel.repositories.approval_repository import ApprovalRepository
from mcp_sentinel.repositories.audit_repository import AuditRepository
from mcp_sentinel.repositories.customer_repository import CustomerRepository
from mcp_sentinel.security.correlation import set_request_id
from mcp_sentinel.services.customer_service import CustomerService
from mcp_sentinel.tools.customer_tools import (
    handle_delete_customer,
    handle_query_customer_records,
)


@pytest.mark.asyncio
async def test_audit_event_logged_on_tool_execution(db_pool):
    """Verifies successful tool execution records an audit event in PostgreSQL."""
    req_id = "req-audit-test-exec-001"
    set_request_id(req_id)

    cust_repo = CustomerRepository(pool=db_pool)
    audit_repo = AuditRepository(pool=db_pool)
    cust_svc = CustomerService(customer_repo=cust_repo, audit_repo=audit_repo)

    res = await handle_query_customer_records(
        raw_args={"limit": 2},
        service=cust_svc,
    )
    assert res["status"] == "success"

    # Verify audit event in PostgreSQL
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT event_type, tool_name, decision, request_id
            FROM audit_events
            WHERE request_id = $1
            ORDER BY id DESC LIMIT 1
            """,
            req_id,
        )
        assert row is not None
        assert row["tool_name"] == "query_customer_records"
        assert row["decision"] == "ALLOWED"
        assert row["request_id"] == req_id


@pytest.mark.asyncio
async def test_audit_event_logged_on_blocked_destructive_action(db_pool):
    """Verifies that an unauthorized destructive action attempts log DESTRUCTIVE_ACTION_BLOCKED."""
    req_id = "req-audit-test-block-002"
    set_request_id(req_id)

    cust_repo = CustomerRepository(pool=db_pool)
    appr_repo = ApprovalRepository(pool=db_pool)
    audit_repo = AuditRepository(pool=db_pool)
    cust_svc = CustomerService(
        customer_repo=cust_repo, approval_repo=appr_repo, audit_repo=audit_repo
    )

    res = await handle_delete_customer(
        raw_args={
            "customer_id": 1,
            "approval_ticket": "TICKET-UNAUTHORIZED-123",
            "reason": "Unauthorized deletion attempt",
        },
        service=cust_svc,
    )
    assert res["status"] == "rejected"

    # Verify blocked audit event in database
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT event_type, tool_name, decision, request_id
            FROM audit_events
            WHERE request_id = $1
            ORDER BY id DESC LIMIT 1
            """,
            req_id,
        )
        assert row is not None
        assert row["event_type"] == "DESTRUCTIVE_ACTION_BLOCKED"
        assert row["decision"] == "BLOCKED"
        assert row["tool_name"] == "delete_customer"
