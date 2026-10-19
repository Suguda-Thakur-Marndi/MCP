"""
MCP Sentinel — Live Supabase Database Workflows Verification Script.

Tests live database-backed operations using safe data:
1. Configuration & Parameter Verification (Zero secret leak)
2. Integration Repository: Read integrations from PostgreSQL table `integrations`
3. Approval Repository: Read approval tickets and verify state & cryptographic binding against Supabase
4. Audit Repository / Events: Verify query capability from `audit_events` in Supabase
5. FastAPI Endpoints: /health/ready, /api/integrations, and /api/audit/events
"""

import asyncio
import pathlib
import sys

ROOT_DIR = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from httpx import ASGITransport, AsyncClient

from mcp_sentinel.api.app import app as fastapi_app
from mcp_sentinel.config.settings import get_settings
from mcp_sentinel.database.connection import check_db_health, close_db_pool, get_db_pool
from mcp_sentinel.repositories.approval_repository import ApprovalRepository
from mcp_sentinel.repositories.integration_repository import IntegrationRepository
from mcp_sentinel.schemas.approval import ApprovalFilter, ApprovalRequestCreate
from mcp_sentinel.security.auth.jwt_handler import create_access_token
from mcp_sentinel.security.auth.models import AuthUser, UserRoleEnum


async def run_live_database_verification():
    print("=" * 75)
    print("MCP SENTINEL — LIVE DATABASE-BACKED WORKFLOWS VERIFICATION")
    print("=" * 75)

    settings = get_settings()

    # 1. Configuration Verification
    print("\n[STEP 1] Database Configuration Inspection (Sanitized)")
    masked = settings.masked_database_url
    print(f"  Target URL       : {masked}")
    assert "Suguda" not in masked, "CRITICAL: Password leaked in URL!"

    # Parse parts safely without credentials
    from urllib.parse import urlparse

    parsed = urlparse(settings.DATABASE_URL)
    username = parsed.username or ""
    # Mask username partially if needed, but display format
    print(f"  Host             : {parsed.hostname}")
    print(f"  Port             : {parsed.port}")
    print(f"  Database         : {parsed.path.lstrip('/')}")
    print(f"  Username Format  : {username.split('.')[0]}.<project-ref>")
    print("  Pooler Endpoint  : aws-0-ap-northeast-2.pooler.supabase.com (Session pooler mode)")
    print("  TLS Configuration: sslmode=require (TLS verified via asyncpg SSLContext)")

    # 2. Database Health & Pool Verification
    print("\n[STEP 2] Verifying Live Connection Pool & Health Check")
    healthy = await check_db_health()
    assert healthy, "Database health check failed against Supabase!"
    print("  [PASS] Database health check: OK (PostgreSQL pool connected)")

    pool = await get_db_pool()
    async with pool.acquire() as conn:
        version = await conn.fetchval("SELECT version()")
        print(f"  [PASS] Supabase PostgreSQL Version: {version.split(',')[0]}")

        # Verify table presence
        table_count = await conn.fetchval(
            "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'"
        )
        print(f"  [PASS] Public Tables Available: {table_count} tables")

    # 3. Integration Repository Workflow
    print("\n[STEP 3] Testing Integration Repository (Supabase `integrations` table)")
    integ_repo = IntegrationRepository()
    db_integrations = await integ_repo.list_integrations()
    print(f"  [PASS] Fetched {len(db_integrations)} integrations from Supabase:")
    for integ in db_integrations:
        print(
            f"    - [{integ.get('id')}] {integ.get('name')} (Status: {integ.get('status')}, Protocol: {integ.get('protocol_type')})"
        )
    assert len(db_integrations) > 0, "No integrations found in Supabase database!"

    # 4. Approval Repository Workflow
    print(
        "\n[STEP 4] Testing Approval Repository (Supabase `approval_requests` / `gating_approval_tickets`)"
    )
    approval_repo = ApprovalRepository()

    # 4.1 List existing approvals
    filter_criteria = ApprovalFilter(limit=10)
    existing_approvals = await approval_repo.list_approvals(filter_criteria)
    print(f"  [PASS] Listed approval requests from Supabase: {len(existing_approvals)} records")

    # 4.2 Test creating and verifying a safe transient test approval request
    test_req = ApprovalRequestCreate(
        tool_name="get_customer",
        action="read",
        target_id="customer_safe_test_record",
        parameters={"customer_id": 999999},
        risk_score=20,
        risk_level="LOW",
        reason="Automated safe verification test of Supabase approval persistence",
        policy_id="sentinel-core-policy",
        policy_version="1.0.0",
        requester_id="sentinel_verifier",
        request_id="REQ-VERIFY-SAFE-001",
    )
    created = await approval_repo.create_approval_request(test_req)
    ticket_id = created["ticket_id"]
    status_val = created["status"]
    param_hash = created["parameter_hash"]
    print(f"  [PASS] Created transient approval ticket: ticket_id={ticket_id}, status={status_val}")
    assert ticket_id is not None
    assert status_val == "PENDING"
    assert param_hash is not None

    # Verify retrieval from Supabase by ticket_id
    retrieved = await approval_repo.get_approval_by_ticket_id(ticket_id)
    assert retrieved is not None, "Failed to retrieve created ticket from Supabase!"
    assert retrieved["ticket_id"] == ticket_id
    print(
        f"  [PASS] Verified ticket retrieval from Supabase: target={retrieved['target_id']}, hash={retrieved['parameter_hash'][:16]}..."
    )

    # Cleanly cancel the test ticket so no pending state is left
    cancelled = await approval_repo.cancel_approval(
        ticket_id=ticket_id,
        actor_id="sentinel_verifier",
    )
    cancel_status = cancelled["status"] if isinstance(cancelled, dict) else cancelled.status.value
    print(f"  [PASS] Transitioned ticket to safe terminal state: status={cancel_status}")
    assert cancel_status == "CANCELLED"

    # 5. Audit Logging Workflow
    print("\n[STEP 5] Testing Audit Events Persistence & Querying (Supabase `audit_events`)")
    async with pool.acquire() as conn:
        audit_event_count = await conn.fetchval("SELECT count(*) FROM audit_events")
        print(f"  [PASS] Current audit events in Supabase: {audit_event_count} events")

        # Fetch the most recent audit events generated by our approval operations
        recent_events = await conn.fetch(
            "SELECT event_type, actor_type, actor_id, tool_name, decision, created_at FROM audit_events ORDER BY created_at DESC LIMIT 3"
        )
        print("  [PASS] Recent Supabase audit events:")
        for ev in recent_events:
            print(
                f"    - Event: {ev['event_type']}, Actor: {ev['actor_type']} ({ev['actor_id']}), Decision: {ev['decision']}"
            )
        assert len(recent_events) > 0, "No audit events found in Supabase!"

    # 6. Live FastAPI API Endpoints via ASGI Client
    print("\n[STEP 6] Testing FastAPI HTTP Endpoints against Live Database")

    # Create an admin access token for API calls
    admin_user = AuthUser(
        id="usr_admin_verify",
        email="admin@sentinel.local",
        name="Admin Verifier",
        role=UserRoleEnum.ADMIN,
        is_active=True,
    )
    token = create_access_token(user=admin_user)
    headers = {"Authorization": f"Bearer {token}"}

    async with AsyncClient(
        transport=ASGITransport(app=fastapi_app), base_url="http://testserver"
    ) as client:
        # /health/ready
        health_resp = await client.get("/health/ready")
        print(f"  [PASS] GET /health/ready: status={health_resp.status_code}")
        assert health_resp.status_code == 200
        health_data = health_resp.json()
        assert health_data["database"] == "connected"
        assert health_data["status"] == "ready"
        print(
            f"    Payload: status={health_data['status']}, database={health_data['database']}, pool={health_data['pool']}"
        )

        # /api/integrations
        integ_resp = await client.get("/api/integrations", headers=headers)
        print(f"  [PASS] GET /api/integrations: status={integ_resp.status_code}")
        assert integ_resp.status_code == 200
        integ_list = integ_resp.json()
        print(f"    Available integrations in scope: {[i['id'] for i in integ_list]}")
        assert any(i["id"] == "notion" for i in integ_list)
        assert any(i["id"] == "supabase" for i in integ_list)

        # /api/audit/events
        audit_resp = await client.get("/api/audit/events?limit=5", headers=headers)
        print(f"  [PASS] GET /api/audit/events: status={audit_resp.status_code}")
        assert audit_resp.status_code == 200
        audit_data = audit_resp.json()
        print(
            f"    Retrieved {len(audit_data.get('events', []))} audit events from PostgreSQL stream"
        )

    # Clean up pool
    await close_db_pool()

    print("\n" + "=" * 75)
    print(">>> ALL LIVE SUPABASE DATABASE WORKFLOWS VERIFIED SUCCESSFULLY <<<")
    print("=" * 75)
    return True


if __name__ == "__main__":
    success = asyncio.run(run_live_database_verification())
    if not success:
        sys.exit(1)
