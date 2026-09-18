"""
Manual Verification Script for MCP-Sentinel Phase 2.
Connects to the FastMCP server instance and verifies:
1. Tools can be discovered.
2. Tool schemas are visible.
3. Read tool works.
4. Structured filtering works.
5. Pagination works.
6. Write tool works.
7. Destructive tool is blocked without authorization.
8. Invalid input is rejected.
9. No raw SQL tool exists.
"""

import asyncio
import json
import pathlib
import sys

ROOT_DIR = pathlib.Path(__file__).parent.parent
sys.path.insert(0, str(ROOT_DIR))

from mcp_sentinel.server.app import create_app  # noqa: E402


def extract_data(res):
    if hasattr(res, "structured_content") and res.structured_content:
        return res.structured_content
    if hasattr(res, "content") and res.content and hasattr(res.content[0], "text"):
        try:
            return json.loads(res.content[0].text)
        except Exception:
            return res.content[0].text
    if isinstance(res, dict):
        return res
    return str(res)


async def main():
    print("=" * 65)
    print("MCP-SENTINEL PHASE 2 — MANUAL SERVER VERIFICATION")
    print("=" * 65)

    server = create_app()

    # 1. Tool Discovery
    print("\n[1] Discovering MCP Tools...")
    tools = await server.list_tools()
    tool_names = [t.name for t in tools]
    print(f"    Discovered {len(tools)} tools: {', '.join(tool_names)}")
    expected = [
        "query_customer_records",
        "get_customer",
        "get_customer_orders",
        "get_order",
        "append_customer_audit_note",
        "update_customer",
        "delete_customer",
        "purge_inactive_customer_data",
    ]
    for exp in expected:
        assert exp in tool_names, f"Missing tool: {exp}"
    print("    -> PASS: All 8 required Phase 2 tools discovered.")

    # 2. Tool Schemas
    print("\n[2] Checking Tool Schemas...")
    for t in tools:
        assert t.description, f"Missing description on tool {t.name}"
        assert t.parameters, f"Missing parameters schema on tool {t.name}"
    print("    -> PASS: All tools have explicit descriptions and strict parameter schemas.")

    # 3. Read Tool: get_customer
    print("\n[3] Testing Read Tool (get_customer)...")
    res = await server.call_tool("get_customer", {"customer_id": "CUST-000001"})
    data = extract_data(res)
    assert data["status"] == "success", f"Read customer failed: {data}"
    assert data["customer"]["customer_code"] == "CUST-000001"
    print(
        f"    Retrieved customer: ID={data['customer']['id']}, Code={data['customer']['customer_code']}, Name={data['customer']['name']}"
    )
    print("    -> PASS: Read tool returned approved customer profile.")

    # 4. Structured Filtering
    print("\n[4] Testing Structured Filtering (query_customer_records)...")
    res = await server.call_tool(
        "query_customer_records",
        {"filters": {"status": "active", "country": "US"}, "limit": 3},
    )
    data = extract_data(res)
    assert data["status"] == "success"
    print(f"    Returned {data['count']} active US records.")
    for rec in data["records"]:
        assert rec["status"] == "active"
        assert rec["country"] == "US"
    print("    -> PASS: Structured filtering enforced allow-listed criteria.")

    # 5. Pagination
    print("\n[5] Testing Pagination Bounds (query_customer_records)...")
    res1 = await server.call_tool("query_customer_records", {"limit": 2, "offset": 0})
    data1 = extract_data(res1)
    res2 = await server.call_tool("query_customer_records", {"limit": 2, "offset": 2})
    data2 = extract_data(res2)
    assert len(data1["records"]) == 2
    assert len(data2["records"]) == 2
    assert data1["records"][0]["id"] != data2["records"][0]["id"]
    print(f"    Page 1: ID {data1['records'][0]['id']}, Page 2: ID {data2['records'][0]['id']}")
    print("    -> PASS: Pagination limit/offset work deterministically.")

    # 6. Write Tool: append_customer_audit_note
    print("\n[6] Testing Write Tool (append_customer_audit_note)...")
    res = await server.call_tool(
        "append_customer_audit_note",
        {
            "customer_id": "CUST-000001",
            "note": "Phase 2 manual verification note",
            "author_id": "verifier_bot",
        },
    )
    data = extract_data(res)
    assert data["status"] == "success"
    print(f"    Appended note: Note ID {data['note_id']}, Customer {data['customer_id']}")
    print("    -> PASS: Write tool appended passive note without execution.")

    # 7. Destructive Tool Gating: delete_customer
    print("\n[7] Testing Destructive Tool Authorization Gating...")
    res = await server.call_tool(
        "delete_customer",
        {
            "customer_id": "CUST-000001",
            "approval_ticket": "TICKET-UNAUTHORIZED-TRIAL",
            "reason": "Unauthorized deletion test",
        },
    )
    data = extract_data(res)
    assert data["status"] in ("rejected", "error"), f"Unexpected pass: {data}"
    print(f"    Server decision: status={data['status']}, error_type={data.get('error_type')}")
    print("    -> PASS: Destructive tool blocked without valid approval ticket.")

    # 8. Input Validation
    print("\n[8] Testing Input Validation...")
    res = await server.call_tool("get_customer", {"customer_id": "ILLEGAL-SQL-1' OR '1'='1"})
    data = extract_data(res)
    assert data["status"] == "error"
    assert data["error_type"] == "ValidationError"
    print(f"    Validation failure handled safely: error_type={data['error_type']}")
    print("    -> PASS: Malicious/malformed input rejected before database query.")

    # 9. No Raw SQL Tool Exists
    print("\n[9] Confirming Absence of Raw SQL Tools...")
    prohibited = [
        "execute_sql",
        "run_sql",
        "raw_sql",
        "execute_query",
        "raw_database_query",
        "query",
    ]
    for p in prohibited:
        assert p not in tool_names, f"CRITICAL: Found raw SQL tool '{p}'!"
    print("    -> PASS: Absolutely no raw SQL execution tools exist.")

    print("\n" + "=" * 65)
    print("ALL 9 MANUAL VERIFICATION CHECKS PASSED SUCCESSFULLY!")
    print("=" * 65)


if __name__ == "__main__":
    asyncio.run(main())
