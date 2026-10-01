"""
Database Initialization and Migration Script for MCP-Sentinel.
Creates target database if needed, runs schema migrations, and seeds synthetic test data.
"""

import asyncio
import pathlib
import sys
import urllib.parse

# Ensure project root is in sys.path
sys.path.insert(0, str(pathlib.Path(__file__).parent.parent))

import asyncpg

from mcp_sentinel.config.settings import get_settings


async def main() -> None:
    settings = get_settings()
    parsed = urllib.parse.urlparse(settings.DATABASE_URL)
    db_name = parsed.path.lstrip("/") or "mcp_sentinel_db"

    # Admin connection to postgres default database
    admin_url = urllib.parse.urlunparse((parsed.scheme, parsed.netloc, "postgres", "", "", ""))

    print(f"[*] Connecting to server to check database '{db_name}'...")
    try:
        conn = await asyncpg.connect(admin_url)
        try:
            exists = await conn.fetchval("SELECT 1 FROM pg_database WHERE datname = $1", db_name)
            if not exists:
                print(f"[*] Creating database '{db_name}'...")
                await conn.execute(f'CREATE DATABASE "{db_name}"')
                print(f"[+] Database '{db_name}' created.")
            else:
                print(f"[+] Database '{db_name}' already exists.")
        finally:
            await conn.close()
    except Exception as exc:
        print(f"[!] Warning during admin DB check: {exc}")

    # Connect to target database
    print(f"[*] Connecting to target database: {settings.masked_database_url}")
    target_conn = await asyncpg.connect(settings.DATABASE_URL)
    try:
        base_dir = pathlib.Path(__file__).parent.parent / "mcp_sentinel" / "database"

        # 1. Initial Schema
        schema_path = base_dir / "migrations" / "001_initial_schema.sql"
        print(f"[*] Applying migration: {schema_path.name}...")
        schema_sql = schema_path.read_text(encoding="utf-8")
        await target_conn.execute(schema_sql)
        print("[+] Migration 001 applied successfully.")

        # 2. Least Privilege Roles
        roles_path = base_dir / "migrations" / "002_least_privilege_roles.sql"
        print(f"[*] Applying migration: {roles_path.name}...")
        try:
            roles_sql = roles_path.read_text(encoding="utf-8")
            await target_conn.execute(roles_sql)
            print("[+] Migration 002 (roles) applied successfully.")
        except Exception as r_exc:
            print(f"[!] Note: Role creation skipped or restricted ({r_exc}). Proceeding.")

        # 3. Enterprise Orders & Audit Schema
        orders_schema_path = base_dir / "migrations" / "003_enterprise_orders_audit_schema.sql"
        print(f"[*] Applying migration: {orders_schema_path.name}...")
        orders_schema_sql = orders_schema_path.read_text(encoding="utf-8")
        await target_conn.execute(orders_schema_sql)
        print("[+] Migration 003 applied successfully.")

        # 4. Production Security Approvals & Auth Schema
        approvals_schema_path = (
            base_dir / "migrations" / "004_production_security_approvals_and_auth.sql"
        )
        print(f"[*] Applying migration: {approvals_schema_path.name}...")
        approvals_schema_sql = approvals_schema_path.read_text(encoding="utf-8")
        await target_conn.execute(approvals_schema_sql)
        print("[+] Migration 004 applied successfully.")

        # 5. Phase 5 Approval State Machine & Lifecycle Schema
        lifecycle_schema_path = (
            base_dir / "migrations" / "005_approval_state_machine_and_lifecycle.sql"
        )
        if lifecycle_schema_path.exists():
            print(f"[*] Applying migration: {lifecycle_schema_path.name}...")
            lifecycle_schema_sql = lifecycle_schema_path.read_text(encoding="utf-8")
            await target_conn.execute(lifecycle_schema_sql)
            print("[+] Migration 005 applied successfully.")

        # 6. Phase 6 Production Authentication & Sessions Schema
        auth_schema_path = base_dir / "migrations" / "006_production_auth_users_and_sessions.sql"
        if auth_schema_path.exists():
            print(f"[*] Applying migration: {auth_schema_path.name}...")
            auth_schema_sql = auth_schema_path.read_text(encoding="utf-8")
            await target_conn.execute(auth_schema_sql)
            print("[+] Migration 006 applied successfully.")

        # 7. Phase 8 Automated Security Evaluation Schema
        eval_schema_path = base_dir / "migrations" / "007_security_evaluation_schema.sql"
        if eval_schema_path.exists():
            print(f"[*] Applying migration: {eval_schema_path.name}...")
            eval_schema_sql = eval_schema_path.read_text(encoding="utf-8")
            await target_conn.execute(eval_schema_sql)
            print("[+] Migration 007 applied successfully.")

        # 8. Phase 9 Multi-Software Connector Gateway Schema
        gateway_schema_path = base_dir / "migrations" / "008_multi_software_connector_gateway.sql"
        if gateway_schema_path.exists():
            print(f"[*] Applying migration: {gateway_schema_path.name}...")
            gateway_schema_sql = gateway_schema_path.read_text(encoding="utf-8")
            await target_conn.execute(gateway_schema_sql)
            print("[+] Migration 008 applied successfully.")

        # 5. Seed Data
        seed_path = base_dir / "seed" / "seed_synthetic_data.sql"
        print(f"[*] Applying seed data: {seed_path.name}...")
        seed_sql = seed_path.read_text(encoding="utf-8")
        await target_conn.execute(seed_sql)
        print("[+] Seed data applied successfully.")

        # Verification counts
        cust_count = await target_conn.fetchval("SELECT COUNT(*) FROM customers")
        ticket_count = await target_conn.fetchval("SELECT COUNT(*) FROM gating_approval_tickets")
        print(f"[OK] Database ready. Customers: {cust_count}, Gating Tickets: {ticket_count}")

    finally:
        await target_conn.close()


if __name__ == "__main__":
    asyncio.run(main())
