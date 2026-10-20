"""
Database Initialization and Migration Script for SentinelCore.
- Establishes a schema_migrations tracking table for repeatable, safe migrations.
- Safely detects already-applied migrations without modifying existing schema.
- Bypasses administrative database creation on managed cloud databases (e.g. Supabase).
- Strictly prevents seeding synthetic test data in production unless explicitly forced.
- Preserves existing production records.
"""

from __future__ import annotations

import argparse
import asyncio
import pathlib
import sys
import urllib.parse

# Ensure project root is in sys.path
sys.path.insert(0, str(pathlib.Path(__file__).parent.parent))

import asyncpg

from mcp_sentinel.config.settings import get_settings


async def init_single_db(
    target_url: str,
    seed_data: bool = False,
    check_only: bool = False,
    force_seed: bool = False,
) -> None:
    settings = get_settings()
    parsed = urllib.parse.urlparse(target_url)
    db_name = parsed.path.lstrip("/") or "mcp_sentinel_db"
    hostname = parsed.hostname or ""

    is_managed_db = any(k in hostname.lower() for k in ("supabase.co", "pooler.supabase.com", "rds.amazonaws.com"))

    # Only attempt database creation on local unmanaged PostgreSQL instances in non-prod
    if not is_managed_db and settings.APP_ENV not in ("production", "staging"):
        admin_url = urllib.parse.urlunparse((parsed.scheme, parsed.netloc, "postgres", "", "", ""))
        print(f"[*] Checking local server for database '{db_name}'...")
        try:
            conn = await asyncpg.connect(admin_url)
            try:
                exists = await conn.fetchval("SELECT 1 FROM pg_database WHERE datname = $1", db_name)
                if not exists:
                    print(f"[*] Creating local database '{db_name}'...")
                    await conn.execute(f'CREATE DATABASE "{db_name}"')
                    print(f"[+] Database '{db_name}' created.")
                else:
                    print(f"[+] Database '{db_name}' exists.")
            finally:
                await conn.close()
        except Exception as exc:
            print(f"[!] Note: Local database existence check skipped ({exc}). Proceeding.")
    else:
        print(f"[*] Managed cloud database detected ({hostname}). Connecting directly to target database.")

    # Mask credentials for display
    masked_url = target_url
    if parsed.password:
        masked_url = target_url.replace(parsed.password, "***")
    print(f"[*] Connecting to database: {masked_url}")

    target_conn = await asyncpg.connect(target_url)
    try:
        # 1. Establish migration tracking table
        await target_conn.execute("""
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version VARCHAR(255) PRIMARY KEY,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        """)

        # Fetch applied migrations
        applied_rows = await target_conn.fetch("SELECT version FROM schema_migrations")
        applied_set = {r["version"] for r in applied_rows}

        migrations_dir = pathlib.Path(__file__).parent.parent / "mcp_sentinel" / "database" / "migrations"
        migration_files = sorted(migrations_dir.glob("*.sql"))

        print(f"\n[*] Discovered {len(migration_files)} schema migrations in repository.")
        print(f"[*] Currently applied in database: {len(applied_set)} migrations.")

        if check_only:
            print("\n=== MIGRATION STATUS REPORT ===")
            for mf in migration_files:
                status_str = "[APPLIED]" if mf.name in applied_set else "[PENDING]"
                print(f"  {status_str} {mf.name}")
            return

        # Apply pending migrations in sequential order
        applied_count = 0
        for mf in migration_files:
            if mf.name in applied_set:
                print(f"  [=] Skipping already applied: {mf.name}")
                continue

            print(f"  [*] Applying migration: {mf.name}...")
            sql_content = mf.read_text(encoding="utf-8")
            try:
                async with target_conn.transaction():
                    await target_conn.execute(sql_content)
                    await target_conn.execute(
                        "INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING",
                        mf.name,
                    )
                print(f"  [+] Migration {mf.name} applied successfully.")
                applied_count += 1
            except Exception as m_exc:
                # Some environments (e.g. Supabase poolers) restrict role manipulation
                if "002_least_privilege_roles" in mf.name and "permission denied" in str(m_exc).lower():
                    print(f"  [!] Note on {mf.name}: Role creation restricted on managed DB ({m_exc}). Recording and proceeding.")
                    await target_conn.execute(
                        "INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING",
                        mf.name,
                    )
                else:
                    raise RuntimeError(f"Failed applying migration {mf.name}: {m_exc}") from m_exc

        print(f"\n[+] Migrations completed. Newly applied: {applied_count}, Total active: {len(applied_set) + applied_count}")

        # Seed Data (Protected by default)
        if seed_data:
            if settings.APP_ENV == "production" and not force_seed:
                print("\n[!] SAFETY VIOLATION: Seeding synthetic test data is strictly prohibited in production!")
                print("    Production tables were NOT truncated or modified. Pass --force-seed if this is intentional.")
                return

            seed_path = pathlib.Path(__file__).parent.parent / "mcp_sentinel" / "database" / "seed" / "seed_synthetic_data.sql"
            if seed_path.exists():
                print(f"\n[!] Applying seed data: {seed_path.name}...")
                seed_sql = seed_path.read_text(encoding="utf-8")
                await target_conn.execute(seed_sql)
                print("[+] Seed data applied successfully.")
        else:
            print("\n[*] Seed data skipped (production safety default: preservation of existing records).")

        # Table & Record Verification
        tables = await target_conn.fetch(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
        )
        table_names = [t["table_name"] for t in tables]
        print(f"[*] Public database tables active ({len(table_names)}): {', '.join(table_names)}")

    finally:
        await target_conn.close()


async def main() -> None:
    parser = argparse.ArgumentParser(description="Initialize and migrate SentinelCore database safely.")
    parser.add_argument(
        "--check-only",
        "--status",
        action="store_true",
        help="Inspect database and report migration status without applying changes",
    )
    parser.add_argument(
        "--seed",
        action="store_true",
        default=False,
        help="Seed synthetic test data (DISABLED by default; prohibited in production)",
    )
    parser.add_argument(
        "--force-seed",
        action="store_true",
        default=False,
        help="Force seeding even if APP_ENV is production (DANGEROUS: truncates test data)",
    )
    args = parser.parse_args()

    settings = get_settings()
    print("=================================================================")
    print(" SentinelCore — Production-Safe Database Migration Utility")
    print("=================================================================")
    print(f"Environment : {settings.APP_ENV}")

    target_dsn = settings.DATABASE_URL or settings.SUPABASE_DATABASE_URL
    if not target_dsn:
        print("[!] Error: Neither DATABASE_URL nor SUPABASE_DATABASE_URL is configured.")
        sys.exit(1)

    await init_single_db(
        target_url=target_dsn,
        seed_data=args.seed,
        check_only=args.check_only,
        force_seed=args.force_seed,
    )


if __name__ == "__main__":
    asyncio.run(main())
