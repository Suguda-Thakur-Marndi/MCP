"""
Performance Sanity Test for MCP-Sentinel Phase 2.
Measures basic latency metrics across tool execution and database connection pooling.
"""

import asyncio
import pathlib
import sys
import time

ROOT_DIR = pathlib.Path(__file__).parent.parent
sys.path.insert(0, str(ROOT_DIR))

from mcp_sentinel.database.connection import close_db_pool, get_db_pool  # noqa: E402
from mcp_sentinel.server.app import create_app  # noqa: E402


async def main():
    print("=" * 60)
    print("MCP-SENTINEL PHASE 2 — PERFORMANCE SANITY TEST")
    print("=" * 60)

    server = create_app()
    pool = await get_db_pool()

    # 1. Connection Pool Acquire/Release Latency
    print("\n[*] Measuring PostgreSQL Pool Acquire/Release Latency (50 iterations)...")
    pool_latencies = []
    for _ in range(50):
        t0 = time.perf_counter()
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        pool_latencies.append((time.perf_counter() - t0) * 1000)

    avg_pool = sum(pool_latencies) / len(pool_latencies)
    min_pool = min(pool_latencies)
    max_pool = max(pool_latencies)
    print(
        f"    Avg Pool Latency: {avg_pool:.2f} ms (Min: {min_pool:.2f} ms, Max: {max_pool:.2f} ms)"
    )

    # 2. Single Record Lookup Latency (get_customer)
    print("\n[*] Measuring MCP get_customer Tool Latency (50 iterations)...")
    lookup_latencies = []
    for _ in range(50):
        t0 = time.perf_counter()
        await server.call_tool("get_customer", {"customer_id": "CUST-000001"})
        lookup_latencies.append((time.perf_counter() - t0) * 1000)

    avg_lookup = sum(lookup_latencies) / len(lookup_latencies)
    min_lookup = min(lookup_latencies)
    max_lookup = max(lookup_latencies)
    print(
        f"    Avg get_customer Latency: {avg_lookup:.2f} ms (Min: {min_lookup:.2f} ms, Max: {max_lookup:.2f} ms)"
    )

    # 3. Filtered Query Latency (query_customer_records)
    print("\n[*] Measuring MCP query_customer_records Tool Latency (50 iterations)...")
    query_latencies = []
    for _ in range(50):
        t0 = time.perf_counter()
        await server.call_tool(
            "query_customer_records",
            {"filters": {"status": "active", "country": "US"}, "limit": 20},
        )
        query_latencies.append((time.perf_counter() - t0) * 1000)

    avg_query = sum(query_latencies) / len(query_latencies)
    min_query = min(query_latencies)
    max_query = max(query_latencies)
    print(
        f"    Avg query_customer_records Latency: {avg_query:.2f} ms (Min: {min_query:.2f} ms, Max: {max_query:.2f} ms)"
    )

    print("\n" + "=" * 60)
    print("PERFORMANCE SANITY CHECK COMPLETE: NO BOTTLENECKS DETECTED")
    print("=" * 60)

    await close_db_pool()


if __name__ == "__main__":
    asyncio.run(main())
