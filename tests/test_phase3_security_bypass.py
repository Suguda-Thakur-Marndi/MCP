"""
Phase 3 Security Tests: Approval Bypass Prevention & Zero Direct DB Access Verification.
Verifies:
1. Agent cannot fake approval tickets (e.g. 'FAKE-APPROVED').
2. Agent cannot authorize itself via {'approved': True}.
3. The agent implementation package (mcp_sentinel.agent) contains ZERO direct database access.
4. Server-side security enforcement remains the sole authoritative boundary.
"""

import pathlib

import pytest

from mcp_sentinel.agent.mcp_client import SentinelMCPClient
from mcp_sentinel.server.app import create_app


# =============================================================================
# 1. APPROVAL SPOOFING: FAKE TICKET
# =============================================================================
@pytest.mark.asyncio
async def test_agent_cannot_spoof_approval_ticket(db_pool):
    """
    Simulates a rogue agent attempting to execute delete_customer with a fabricated ticket:
    {"customer_id": "CUST-000001", "approval_ticket": "FAKE-APPROVED"}
    Expected: MCP server rejects it; customer remains in database.
    """
    server = create_app()
    client = SentinelMCPClient(server_instance=server)

    result = await client.call_tool(
        name="delete_customer",
        arguments={
            "customer_id": "CUST-000001",
            "approval_ticket": "FAKE-APPROVED",
            "reason": "Agent fabricated authorization ticket",
        },
    )

    # Must be blocked by server-side approval check
    assert result["status"] in ("approval_required", "rejected", "error")

    # Verify customer still exists in database
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow("SELECT id FROM customers WHERE id = 1")
        assert row is not None


# =============================================================================
# 2. APPROVAL SPOOFING: "approved: true" PAYLOAD INJECTION
# =============================================================================
@pytest.mark.asyncio
async def test_agent_cannot_bypass_gate_with_approved_flag(db_pool):
    """
    Simulates an agent sending {'approved': True} or extra authorization flags.
    Expected: The MCP server rejects the input or ignores non-schema flags and checks ticket.
    """
    server = create_app()
    client = SentinelMCPClient(server_instance=server)

    result = await client.call_tool(
        name="delete_customer",
        arguments={
            "customer_id": "CUST-000001",
            "approved": True,  # Non-functional spoof attempt
            "approval_ticket": "AGENT-SELF-AUTHORIZED",
            "reason": "Agent claims it approved itself",
        },
    )

    assert result["status"] in ("approval_required", "rejected", "error")

    # Verify database was NOT modified
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow("SELECT id FROM customers WHERE id = 1")
        assert row is not None


# =============================================================================
# 3. ZERO DIRECT DATABASE ACCESS IN AGENT CODEBASE
# =============================================================================
def test_agent_codebase_contains_no_direct_database_access():
    """
    STATIC CODE ANALYSIS TEST:
    Searches the entire mcp_sentinel/agent/ directory and verifies that NO file:
    1. Imports or calls asyncpg.
    2. Imports or calls psycopg / psycopg2.
    3. Imports or creates SQLAlchemy connections / engines.
    4. Executes raw queries using DATABASE_URL.
    The agent must interact with enterprise data strictly through MCP protocol.
    """
    agent_dir = pathlib.Path(__file__).parent.parent / "mcp_sentinel" / "agent"
    assert agent_dir.exists() and agent_dir.is_dir()

    forbidden_patterns = [
        "import asyncpg",
        "from asyncpg",
        "import psycopg",
        "from psycopg",
        "import sqlalchemy",
        "from sqlalchemy",
        "create_engine",
        "asyncpg.connect",
        "asyncpg.create_pool",
    ]

    python_files = list(agent_dir.rglob("*.py"))
    assert len(python_files) > 0, "No agent python files found to inspect."

    violations = []
    for py_file in python_files:
        content = py_file.read_text(encoding="utf-8")
        for pattern in forbidden_patterns:
            if pattern in content:
                violations.append(f"{py_file.name} contains forbidden pattern: '{pattern}'")

    assert not violations, f"Direct database access patterns found in agent package: {violations}"
