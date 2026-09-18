"""
Category I: End-to-End Security Regression Tests.
Complies with Section 18:
1. Malicious input -> MCP tool -> Validation -> Security layer -> BLOCK.
   Demonstrates arbitrary SQL cannot reach PostgreSQL and tables remain intact.
2. Agent requests destructive operation -> No valid authorization -> Server rejects -> Database unchanged.
3. Agent requests destructive operation -> Valid authorization -> Executes -> Ticket marked consumed -> Replay blocked.
"""

import pytest

from mcp_sentinel.tools.destructive_tools import handle_purge_inactive_customer_data
from mcp_sentinel.tools.query_tools import handle_query_customer_records


@pytest.mark.asyncio
async def test_end_to_end_malicious_sql_rejection_and_table_integrity(customer_repo, db_pool):
    """
    Simulates AI Agent submitting adversarial SQL injection payload.
    Flow: Malicious Input -> MCP Tool -> Schema/Builder Validation -> REJECT -> Database Unchanged.
    """
    # 1. Verify initial state
    async with db_pool.acquire() as conn:
        initial_count = await conn.fetchval("SELECT COUNT(*) FROM customers")
        assert initial_count == 8

    # 2. Malicious prompt/agent injection payload
    attack_payload = {
        "filters": {
            "status": "active' OR '1'='1'; DROP TABLE customers; --",
        },
        "limit": 50,
    }

    # 3. Submit to MCP tool handler
    response = await handle_query_customer_records(customer_repo, attack_payload)

    # 4. Result must either be a validation error or parameterized safe query with zero matches
    if response["status"] == "error":
        assert "Validation" in response.get("error_type", "") or "error" in response["status"]
    else:
        # Parameterized query evaluated payload as exact literal status
        assert response["count"] == 0

    # 5. Verify PostgreSQL database table was NOT dropped and data is 100% intact
    async with db_pool.acquire() as conn:
        table_exists = await conn.fetchval(
            "SELECT 1 FROM information_schema.tables WHERE table_name = 'customers'"
        )
        assert table_exists == 1
        final_count = await conn.fetchval("SELECT COUNT(*) FROM customers")
        assert final_count == 8


@pytest.mark.asyncio
async def test_end_to_end_unauthorized_destructive_purge_blocked(
    customer_repo, approval_repo, db_pool
):
    """
    Simulates AI Agent requesting destructive customer purge without valid authorization ticket.
    Flow: Destructive Request -> Server-side Gate -> Verification Failed -> REJECT -> DB Intact.
    """
    # Target inactive customer 3
    target_id = 3

    # Confirm customer exists and is inactive
    async with db_pool.acquire() as conn:
        exists_before = await conn.fetchval("SELECT status FROM customers WHERE id = $1", target_id)
        assert exists_before == "inactive"

    # Agent calls destructive tool with no/fake approval
    unauthorized_request = {
        "customer_id": target_id,
        "approval_ticket": "TICKET-UNAUTHORIZED-AGENT-CLAIM",
        "reason": "Agent autonomous cleanup attempt",
    }

    res = await handle_purge_inactive_customer_data(
        customer_repo=customer_repo,
        approval_repo=approval_repo,
        raw_args=unauthorized_request,
    )

    # Server must reject
    assert res["status"] in ("rejected", "error")
    assert "Access Denied" in res["message"] or "cannot be authorized" in res["message"]

    # Customer record must STILL exist in database
    async with db_pool.acquire() as conn:
        exists_after = await conn.fetchval("SELECT status FROM customers WHERE id = $1", target_id)
        assert exists_after == "inactive"


@pytest.mark.asyncio
async def test_end_to_end_authorized_purge_and_replay_defense(
    customer_repo, approval_repo, db_pool
):
    """
    Full lifecycle test:
    1. Valid human authorization ticket presented -> Purge succeeds -> Customer deleted.
    2. Ticket is atomically marked consumed.
    3. Immediate replay of identical ticket -> Server REJECTS -> Replay blocked.
    """
    target_id = 3
    valid_ticket = "TICKET-VALID-PURGE-003"

    # Step 1: Execute authorized purge
    authorized_request = {
        "customer_id": target_id,
        "approval_ticket": valid_ticket,
        "reason": "Authorized compliance dormancy purge",
    }

    res = await handle_purge_inactive_customer_data(
        customer_repo=customer_repo,
        approval_repo=approval_repo,
        raw_args=authorized_request,
    )

    assert res["status"] == "success"
    assert res["rows_affected"] == 1
    assert res["ticket_consumed"] == valid_ticket

    # Verify customer 3 is deleted from database
    async with db_pool.acquire() as conn:
        cust_exists = await conn.fetchval("SELECT 1 FROM customers WHERE id = $1", target_id)
        assert cust_exists is None

        # Verify ticket is marked consumed in database
        consumed = await conn.fetchval(
            "SELECT consumed FROM gating_approval_tickets WHERE ticket_id = $1",
            valid_ticket,
        )
        assert consumed is True

    # Step 2: Attempt replay attack using identical ticket
    replay_res = await handle_purge_inactive_customer_data(
        customer_repo=customer_repo,
        approval_repo=approval_repo,
        raw_args=authorized_request,
    )

    # Replay MUST be rejected
    assert replay_res["status"] == "rejected"
    assert "Access Denied" in replay_res["message"]
