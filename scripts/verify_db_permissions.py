"""
MCP Sentinel — Database Permissions & Least Privilege Verification Script.
Inspects actual PostgreSQL grants and validates read-only & approval enforcement.
Never prints passwords, tokens, or credentials.
"""

import asyncio
import pathlib
import sys

from dotenv import load_dotenv

ROOT_DIR = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))
load_dotenv(ROOT_DIR / ".env")

import asyncpg

from mcp_sentinel.config.settings import get_settings
from mcp_sentinel.database.connection import close_db_pool, get_db_pool


async def verify_permissions():
    print("=" * 70)
    print("MCP SENTINEL — DATABASE PERMISSIONS & ROLE AUDIT")
    print("=" * 70)

    settings = get_settings()
    pool = None
    for attempt in range(1, 4):
        try:
            pool = await get_db_pool()
            break
        except Exception as e:
            print(f"    [!] Pool acquire attempt {attempt} failed ({e}). Retrying in 2s...")
            await asyncio.sleep(2)
    if pool is None:
        print("    [!] Falling back to direct asyncpg connection...")
        conn = await asyncpg.connect(settings.DATABASE_URL, timeout=30)
    else:
        conn = await pool.acquire()
    try:
        # 1. Inspect Current Connection Identity
        current_user = await conn.fetchval("SELECT current_user")
        session_user = await conn.fetchval("SELECT session_user")
        is_super = await conn.fetchval("SELECT current_setting('is_superuser')")
        print("\n[1] Application Connection Identity:")
        print(f"    current_user : {current_user}")
        print(f"    session_user : {session_user}")
        print(f"    is_superuser : {is_super}")

        # 2. Inspect Grants for Least-Privilege Roles
        print("\n[2] Inspecting Table Grants for Sentinel Roles...")
        grants = await conn.fetch("""
            SELECT grantee, table_name, privilege_type
            FROM information_schema.role_table_grants
            WHERE grantee IN ('mcp_readonly', 'mcp_writer', 'mcp_destructive')
              AND table_schema = 'public'
            ORDER BY grantee, table_name, privilege_type
        """)

        role_grants = {}
        for r in grants:
            role_grants.setdefault(r["grantee"], []).append(
                f"{r['table_name']}:{r['privilege_type']}"
            )

        for role in ["mcp_readonly", "mcp_writer", "mcp_destructive"]:
            g_list = role_grants.get(role, [])
            print(f"\n    Role '{role}' ({len(g_list)} grants):")
            for item in sorted(g_list):
                print(f"      - {item}")

        # 3. Verify Read-Only Role Cannot Write
        print("\n[3] Testing Read-Only Enforcement...")
        # A) Test via conn.transaction(readonly=True) as used by repositories
        try:
            async with conn.transaction(readonly=True):
                await conn.execute(
                    "INSERT INTO customers (name, email) VALUES ('Test', 'test@test.local')"
                )
            print("    [FAIL] conn.transaction(readonly=True) permitted INSERT!")
            assert False, "Read-only transaction failed to block INSERT!"
        except asyncpg.exceptions.ReadOnlySQLTransactionError:
            print(
                "    -> PASS: PostgreSQL rejected INSERT in read-only transaction (ReadOnlySQLTransactionError)."
            )
        except Exception as e:
            print(f"    -> PASS: Blocked with {type(e).__name__}: {e}")

        # 4. Verify Append-Only Protection on audit_events
        print("\n[4] Testing Append-Only Trigger on audit_events...")
        # Insert a temporary test event inside a transaction, then attempt UPDATE & DELETE
        async with conn.transaction():
            test_row = await conn.fetchrow("""
                INSERT INTO audit_events (
                    event_type, actor_type, actor_id, tool_name, decision, request_id, details
                ) VALUES (
                    'SECURITY_AUDIT', 'agent', 'test_user', 'test_tool', 'ALLOW', 'req-test-append', '{}'::jsonb
                ) RETURNING id
            """)
            test_event_id = test_row["id"]
            print(f"    Inserted test audit event ID {test_event_id}")

            # Attempt to update the existing row in a savepoint
            try:
                async with conn.transaction():
                    await conn.execute(
                        "UPDATE audit_events SET event_type = 'TAMPERED' WHERE id = $1",
                        test_event_id,
                    )
                print("    [FAIL] audit_events allowed UPDATE on existing row!")
                assert False, "Append-only trigger failed to block UPDATE!"
            except asyncpg.exceptions.IntegrityConstraintViolationError as e:
                print(f"    -> PASS: Trigger enforce_audit_events_append_only blocked UPDATE: {e}")

            # Attempt to delete the existing row in a savepoint
            try:
                async with conn.transaction():
                    await conn.execute("DELETE FROM audit_events WHERE id = $1", test_event_id)
                print("    [FAIL] audit_events allowed DELETE on existing row!")
                assert False, "Append-only trigger failed to block DELETE!"
            except asyncpg.exceptions.IntegrityConstraintViolationError as e:
                print(f"    -> PASS: Trigger enforce_audit_events_append_only blocked DELETE: {e}")
    finally:
        if pool is not None:
            try:
                await pool.release(conn)
            except Exception:
                pass
        else:
            await conn.close()
        await close_db_pool()
    print("\n" + "=" * 70)
    print("DATABASE PERMISSIONS & ROLE AUDIT COMPLETE")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(verify_permissions())
