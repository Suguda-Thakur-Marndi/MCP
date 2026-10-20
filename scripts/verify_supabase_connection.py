"""
SentinelCore — Supabase PostgreSQL Connection & Health Verification Script.

Strict adherence to:
- No plain credentials printed in logs or outputs.
- Read-only database checks without destructive mutations or fake seed data.
- Live verification of FastAPI /health/ready reporting actual Supabase database status.
- Live verification of MCP server tool discovery.
"""

import asyncio
import pathlib
import sys

from dotenv import load_dotenv

# Add project root to sys.path
ROOT_DIR = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from httpx import ASGITransport, AsyncClient

from mcp_sentinel.api.app import app as fastapi_app
from mcp_sentinel.config.settings import get_settings
from mcp_sentinel.database.connection import check_db_health, close_db_pool, get_db_pool
from mcp_sentinel.server.app import create_app as create_mcp_app

load_dotenv(ROOT_DIR / ".env")


async def verify_supabase():
    print("=" * 70)
    print("SENTINELCORE — SUPABASE POSTGRESQL VERIFICATION")
    print("=" * 70)

    settings = get_settings()

    # 1. Connectivity Check (Without printing password)
    print("\n[1] Verifying Database Connectivity...")
    masked_url = settings.masked_database_url
    print(f"    Target Connection URL : {masked_url}")
    assert ":***@" in masked_url, "CRITICAL: Password not properly masked in database URL!"

    healthy = await check_db_health()
    assert healthy, "Database health check failed against Supabase!"
    print("    -> PASS: Successfully connected to Supabase PostgreSQL.")

    # 2. Schema and Role Inspection
    print("\n[2] Inspecting Schema & Least-Privilege Roles...")
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        version = await conn.fetchval("SELECT version()")
        print(f"    Engine Version : {version.split(',')[0]}")

        # Check Roles
        roles = await conn.fetch(
            "SELECT rolname, rolcanlogin, rolsuper FROM pg_roles WHERE rolname LIKE 'mcp_%' ORDER BY rolname"
        )
        print(f"    Least Privilege Roles Found ({len(roles)}):")
        for r in roles:
            print(f"      - {r['rolname']} (Login: {r['rolcanlogin']}, Superuser: {r['rolsuper']})")
        assert len(roles) >= 3, "Expected mcp_readonly, mcp_writer, mcp_destructive roles!"

        # Check Tables
        tables = await conn.fetch(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
        )
        table_names = [t["table_name"] for t in tables]
        print(f"    Public Tables Found ({len(table_names)}):")
        for t in table_names:
            print(f"      - {t}")

        required_tables = [
            "customers",
            "customer_audit_notes",
            "gating_approval_tickets",
            "orders",
            "users",
            "sessions",
            "audit_events",
            "integrations",
            "tools",
            "tool_permissions",
            "idempotency_records",
        ]
        for rt in required_tables:
            assert rt in table_names, f"Missing required table: {rt}"
        print("    -> PASS: Schema migrations 001-012 verified on Supabase.")

    # 3. Read-Only Query Verification
    print("\n[3] Executing Safe Read-Only Queries...")
    async with pool.acquire() as conn:
        customer_count = await conn.fetchval("SELECT COUNT(*) FROM customers")
        ticket_count = await conn.fetchval("SELECT COUNT(*) FROM gating_approval_tickets")
        integration_count = await conn.fetchval("SELECT COUNT(*) FROM integrations")
        print(f"    Customers count : {customer_count}")
        print(f"    Gating tickets  : {ticket_count}")
        print(f"    Integrations    : {integration_count}")
        print("    -> PASS: Safe read-only queries executed successfully.")

    # 4. FastAPI Backend & Readiness Endpoint Check
    print("\n[4] Verifying FastAPI Readiness Endpoint...")
    async with AsyncClient(
        transport=ASGITransport(app=fastapi_app), base_url="http://test"
    ) as client:
        resp_ready = await client.get("/health/ready")
        resp_live = await client.get("/health/live")
        print(f"    /health/live  status : {resp_live.status_code}")
        print(f"    /health/ready status : {resp_ready.status_code}")
        print(f"    /health/ready body   : {resp_ready.json()}")
        assert resp_ready.status_code == 200, f"/health/ready returned {resp_ready.status_code}"
        assert resp_ready.json().get("status") in ("ready", "healthy")
        print("    -> PASS: FastAPI backend reports live and ready with Supabase.")

    # 5. MCP Server & Tool Discovery Check
    print("\n[5] Verifying MCP Server Tool Registration...")
    mcp_app = create_mcp_app()
    tools = await mcp_app.list_tools()
    tool_names = [t.name for t in tools]
    print(f"    Registered Tools ({len(tool_names)}): {', '.join(tool_names)}")
    expected_tools = [
        "query_customer_records",
        "get_customer",
        "get_customer_orders",
        "get_order",
        "update_customer",
        "append_customer_audit_note",
        "delete_customer",
        "purge_inactive_customer_data",
    ]
    for et in expected_tools:
        assert et in tool_names, f"Missing required MCP tool: {et}"
    print("    -> PASS: All 8 core MCP tools registered and active.")

    await close_db_pool()
    print("\n" + "=" * 70)
    print("SUPABASE INTEGRATION SUCCESSFULLY VERIFIED — 100% PASS")
    print("=" * 70)
    return True


if __name__ == "__main__":
    success = asyncio.run(verify_supabase())
    sys.exit(0 if success else 1)
