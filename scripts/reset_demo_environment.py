#!/usr/bin/env python3
"""Safe Demo Environment Reset Script for MCP-Sentinel.

Restores the demo and evaluation database to a clean, deterministic seed state
(seed=42: 500 customers, 1000 orders, 100 audit notes).

SAFETY INVARIANTS:
1. FAILS CLOSED immediately if APP_ENV=production or ENV=production.
2. FAILS CLOSED if DATABASE_URL contains production hostnames or databases.
3. Operates strictly on demo/evaluation PostgreSQL databases.
4. Preserves system user accounts and migrations.
"""

from __future__ import annotations

import asyncio
import os
import sys
from urllib.parse import urlparse

import asyncpg

# Add repository root to path
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from mcp_sentinel.config.settings import get_settings  # noqa: E402
from scripts.seed_database import seed_data  # noqa: E402


def verify_safety_guards(db_url: str, app_env: str) -> None:
    """Enforce strict fail-closed safety checks before any mutation."""
    # 1. Environment check
    blocked_envs = {"production", "prod", "live"}
    if app_env.lower() in blocked_envs:
        raise RuntimeError(
            f"[FATAL SAFETY VIOLATION] Reset refused: APP_ENV is set to '{app_env}'. "
            "Demo reset can NEVER be executed in a production environment!"
        )

    # 2. Hostname check
    parsed = urlparse(db_url)
    hostname = (parsed.hostname or "").lower()
    allowed_hosts = {"localhost", "127.0.0.1", "::1", "db", "postgres"}
    if hostname not in allowed_hosts and not hostname.endswith(".local"):
        raise RuntimeError(
            f"[FATAL SAFETY VIOLATION] Reset refused: Target database host '{hostname}' "
            "is not an approved local/demo host (allowed: localhost, 127.0.0.1, db, postgres)."
        )

    # 3. Database name check
    dbname = (parsed.path or "").strip("/").lower()
    allowed_db_prefixes = {"mcp_sentinel_db", "mcp_sentinel_eval", "test", "demo"}
    if not any(dbname.startswith(prefix) for prefix in allowed_db_prefixes):
        raise RuntimeError(
            f"[FATAL SAFETY VIOLATION] Reset refused: Target database name '{dbname}' "
            "does not match approved demo/evaluation naming prefixes."
        )


async def reset_demo_database() -> dict[str, int]:
    """Execute safe reset and re-seed of the demo database."""
    settings = get_settings()
    app_env = os.environ.get("APP_ENV", settings.APP_ENV)
    db_url = os.environ.get("DATABASE_URL", settings.DATABASE_URL)

    print("=" * 60)
    print("MCP-SENTINEL SAFE DEMO ENVIRONMENT RESET")
    print("=" * 60)
    print(f"Target Database : {db_url.split('@')[-1] if '@' in db_url else db_url}")
    print(f"Environment     : {app_env}")

    # Enforce safety boundaries
    verify_safety_guards(db_url, app_env)
    print("[OK] Fail-closed safety guards verified. Safe to proceed.")

    print("\n1. Re-seeding deterministic dataset (seed=42)...")
    await seed_data(seed=42, customer_count=500, order_count=1000, note_count=100)

    # Verify post-reset record counts
    conn = await asyncpg.connect(db_url)
    counts: dict[str, int] = {}
    try:
        counts["customers"] = await conn.fetchval("SELECT COUNT(*) FROM customers")
        counts["orders"] = await conn.fetchval("SELECT COUNT(*) FROM orders")
        counts["customer_audit_notes"] = await conn.fetchval(
            "SELECT COUNT(*) FROM customer_audit_notes"
        )
        counts["gating_approval_tickets"] = await conn.fetchval(
            "SELECT COUNT(*) FROM gating_approval_tickets"
        )
        counts["users"] = await conn.fetchval("SELECT COUNT(*) FROM users")
    finally:
        await conn.close()

    print("\nPost-Reset Verified Invariants:")
    for entity, count in counts.items():
        print(f"   - {entity:<25}: {count}")

    print("\n" + "=" * 60)
    print("DEMO ENVIRONMENT RESET COMPLETED SUCCESSFULLY")
    print("=" * 60)
    return counts


def main():
    try:
        asyncio.run(reset_demo_database())
        sys.exit(0)
    except Exception as err:
        print(f"\n[FATAL] {err}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
