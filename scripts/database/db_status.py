import asyncio
import pathlib
import sys

ROOT_DIR = pathlib.Path(__file__).resolve().parents[2]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import asyncpg

from mcp_sentinel.config.settings import get_settings


async def main():
    s = get_settings()
    conn = await asyncpg.connect(s.DATABASE_URL)
    try:
        ver = await conn.fetchval("SELECT version()")
        c_count = await conn.fetchval("SELECT COUNT(*) FROM customers")
        o_count = await conn.fetchval("SELECT COUNT(*) FROM orders")
        n_count = await conn.fetchval("SELECT COUNT(*) FROM customer_audit_notes")
        t_count = await conn.fetchval("SELECT COUNT(*) FROM gating_approval_tickets")
        u_count = await conn.fetchval("SELECT COUNT(*) FROM users")
        rows = await conn.fetch(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
        )
        tables = [r["table_name"] for r in rows]
        print("DATABASE_VERSION:", ver)
        print("TABLE_COUNT:", len(tables))
        print("TABLES:", ", ".join(tables))
        print(
            f"COUNTS: customers={c_count}, orders={o_count}, audit_notes={n_count}, tickets={t_count}, users={u_count}"
        )
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
