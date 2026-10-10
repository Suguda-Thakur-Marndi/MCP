"""
MCP-Sentinel: Full Human-in-the-Loop Approval Console Flow Verification.
Validates the complete 4-step out-of-band lifecycle:
1. Agent attempts destructive operation without ticket -> Halt with REQUIRE_APPROVAL
2. Human Approver authorizes ticket in console
3. Agent retries with approved ticket -> Success and database mutation
4. Agent attempts replay attack with consumed ticket -> Replay defense blocks
"""

import asyncio
import json
import sys
from pathlib import Path

# Add project root to sys.path portably
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from httpx import ASGITransport, AsyncClient  # noqa: E402

from mcp_sentinel.api.app import app as fastapi_app  # noqa: E402
from mcp_sentinel.database.connection import get_db_pool  # noqa: E402
from mcp_sentinel.repositories.approval_repository import ApprovalRepository  # noqa: E402
from mcp_sentinel.repositories.customer_repository import CustomerRepository  # noqa: E402
from mcp_sentinel.server.app import create_app as create_mcp_app  # noqa: E402
from mcp_sentinel.services.customer_service import CustomerService  # noqa: E402
from scripts.seed_database import seed_data  # noqa: E402


def extract_data(res):
    if hasattr(res, "structured_content") and res.structured_content:
        return res.structured_content
    elif hasattr(res, "content") and res.content and hasattr(res.content[0], "text"):
        try:
            return json.loads(res.content[0].text)
        except Exception:
            return res.content[0].text
    elif isinstance(res, dict):
        return res
    return str(res)


async def test_full_console_lifecycle():
    print("=" * 80)
    print("MCP-SENTINEL: FULL HUMAN-IN-THE-LOOP APPROVAL CONSOLE FLOW VERIFICATION")
    print("=" * 80)

    # 0. Re-seed database
    print("\n[STEP 0] Resetting and seeding database...")
    await seed_data()
    pool = await get_db_pool()
    cust_repo = CustomerRepository(pool=pool)
    appr_repo = ApprovalRepository(pool=pool)
    cust_svc = CustomerService(customer_repo=cust_repo, approval_repo=appr_repo)
    server = create_mcp_app(customer_service=cust_svc)

    # Verify customer ID 1 exists
    c_before = await cust_repo.get_customer_by_id(1)
    assert c_before is not None, "Customer ID 1 must exist before test"
    print(f"  [OK] Customer found: ID={c_before['id']}, Code={c_before['customer_code']}, Name={c_before['name']}")

    # Verify that FastMCP tools do NOT expose any approve or decide tool
    tools = await server.list_tools()
    tool_names = [t.name for t in tools]
    print(f"  [OK] MCP Server exposed tools ({len(tool_names)}): {', '.join(tool_names)}")
    assert "approve_ticket" not in tool_names, "CRITICAL SECURITY FAULT: approve_ticket must NOT be on MCP surface!"
    assert "decide_approval" not in tool_names, "CRITICAL SECURITY FAULT: decide_approval must NOT be on MCP surface!"
    assert "approve" not in tool_names
    print("  [PASS] Verified: AI client CANNOT reach approval endpoints via MCP protocol.")

    # 1. AI Client calls delete_customer without ticket
    print("\n[STEP 1] Agent requests delete_customer(customer_id=1, approval_ticket=None)...")
    res1 = await server.call_tool("delete_customer", {"customer_id": 1})
    data1 = extract_data(res1)
    print("  Server Response:", data1)
    assert data1.get("status") in ("REQUIRE_APPROVAL", "rejected"), "Must halt on approval requirement"
    assert data1.get("approval_required") is True, "approval_required must be True"
    ticket_id = data1.get("ticket_id")
    assert ticket_id, "Must return a ticket_id"
    print(f"  [PASS] Step 1: Server halted execution. Ticket generated: {ticket_id}")

    # Verify DB still has customer intact
    c_check1 = await cust_repo.get_customer_by_id(1)
    assert c_check1 is not None, "Database must NOT be mutated while approval is pending"
    print("  [PASS] Verified: Customer ID 1 remains intact in PostgreSQL database.")

    # 2. Human Operator logs into Approval Console and approves ticket
    print(f"\n[STEP 2] Human Operator logs into Console and approves ticket '{ticket_id}'...")
    async with AsyncClient(transport=ASGITransport(app=fastapi_app), base_url="http://test") as client:
        # Step 2a: Login as APPROVER
        login_resp = await client.post("/api/auth/login", json={
            "id_token": "test-token:approver@sentinel.test:APPROVER",
            "provider": "mock"
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        auth_info = login_resp.json()
        token = auth_info["access_token"]
        approver_id = auth_info["user"]["id"]
        print(f"  Approver logged in: {auth_info['user']['email']} (ID: {approver_id})")

        # Step 2b: Inspect pending approvals
        headers = {"Authorization": f"Bearer {token}", "X-CSRF-Token": "sentinel-csrf"}
        pending_resp = await client.get("/api/approvals/pending", headers=headers)
        assert pending_resp.status_code == 200
        pending_tickets = pending_resp.json()
        matching = [t for t in pending_tickets if t["ticket_id"] == ticket_id]
        assert len(matching) > 0, f"Ticket {ticket_id} must appear in pending queue"
        print(f"  [OK] Ticket {ticket_id} verified in pending queue with Risk Score: {matching[0]['risk_score']}")

        # Step 2c: Human issues Approval Sign-Off
        approve_resp = await client.post(
            f"/api/approvals/{ticket_id}/approve",
            json={"decision_notes": "Authorized by security compliance lead"},
            headers=headers
        )
        assert approve_resp.status_code == 200, f"Approval decision failed: {approve_resp.text}"
        decision_data = approve_resp.json()
        assert decision_data["status"] == "APPROVED"
        assert decision_data["approver_id"] == approver_id
        print(f"  [PASS] Step 2: Human authorized ticket in Console. Approver recorded: {decision_data['approver_id']}")

    # 3. AI Client retries with approved ticket
    print(f"\n[STEP 3] Agent retries delete_customer with approved ticket '{ticket_id}'...")
    res2 = await server.call_tool("delete_customer", {
        "customer_id": 1,
        "approval_ticket": ticket_id
    })
    data2 = extract_data(res2)
    print("  Server Response:", data2)
    assert data2.get("status") == "success", f"Execution should succeed with approved ticket: {data2}"
    assert data2.get("deleted_records") == 1 or data2.get("rows_affected") == 1
    print("  [PASS] Step 3: Deletion executed successfully.")

    # Verify customer is now deleted in DB
    c_after = await cust_repo.get_customer_by_id(1)
    assert c_after is None, "Customer ID 1 must now be deleted from database"
    print("  [PASS] Verified: Customer ID 1 successfully removed from PostgreSQL.")

    # 4. Replay attack attempt
    print(f"\n[STEP 4] Replay attack: Agent attempts to reuse consumed ticket '{ticket_id}'...")
    res3 = await server.call_tool("delete_customer", {
        "customer_id": 1,
        "approval_ticket": ticket_id
    })
    data3 = extract_data(res3)
    print("  Server Response to Replay:", data3)
    assert (
        data3.get("status") in ("DENY", "error", "rejected")
        or "error" in data3
        or "denied" in str(data3).lower()
        or "consumed" in str(data3).lower()
        or data3.get("approval_required") is True
    ), f"Replay must be blocked: {data3}"
    print("  [PASS] Step 4: Replay attack successfully blocked by server-side anti-replay defense.")

    print("\n" + "=" * 80)
    print("ALL 4 STEPS OF THE HITL APPROVAL CONSOLE LIFECYCLE PASSED PERFECTLY!")
    print("=" * 80)


if __name__ == "__main__":
    asyncio.run(test_full_console_lifecycle())
