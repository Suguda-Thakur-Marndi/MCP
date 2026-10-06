"""
End-to-End MCP Protocol & Security Verification Script.
Simulates a real AI Client (Claude Desktop / Cursor) connecting to MCP-Sentinel Server
over standard input/output (stdio JSON-RPC transport).
Verifies:
  1. Handshake & Capabilities negotiation
  2. Tool Discovery & Schema Validation
  3. Resource Discovery & Retrieval
  4. Prompt Discovery & Rendering
  5. Real Data Read Access (PostgreSQL customers & orders)
  6. Human-in-the-Loop Gating for Destructive Operations
  7. Human Approval Sign-off & Bound Execution
  8. Anti-Replay Defense on consumed tickets
  9. SQL Injection / Input Validation Defense
"""

from __future__ import annotations

import asyncio
import os
import pathlib
import sys
import uuid

ROOT_DIR = pathlib.Path(__file__).parent.parent
sys.path.insert(0, str(ROOT_DIR))

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from mcp_sentinel.database.connection import get_db_pool
from mcp_sentinel.repositories.approval_repository import ApprovalRepository
from mcp_sentinel.repositories.customer_repository import CustomerRepository
from mcp_sentinel.security.auth.models import UserRoleEnum


async def main():
    print("=" * 80)
    print("MCP-SENTINEL: REAL AI CLIENT (CLAUDE / CURSOR) E2E VERIFICATION")
    print("=" * 80)

    server_params = StdioServerParameters(
        command=sys.executable,
        args=["-m", "mcp_server.server"],
        cwd=str(ROOT_DIR),
        env=dict(os.environ),
    )

    results = {}

    print("\n[PHASE 1] Launching MCP Server Subprocess over stdio...")
    async with stdio_client(server_params) as (read_stream, write_stream):
        async with ClientSession(read_stream, write_stream) as session:
            # 1. Handshake
            init_res = await session.initialize()
            assert init_res.server_info.name == "MCP-Sentinel"
            print(f"  [PASS] Handshake Initialized: Server={init_res.server_info.name}, Version={init_res.server_info.version}")
            results["Handshake"] = "PASS"

            # 2. Tool Discovery
            tools_res = await session.list_tools()
            tool_names = [t.name for t in tools_res.tools]
            print(f"  [PASS] Tools Discovered ({len(tools_res.tools)}): {', '.join(tool_names)}")
            assert "get_customer" in tool_names
            assert "delete_customer" in tool_names
            results["Tool Discovery"] = "PASS"

            # 3. Resource Discovery & Reading
            res_list = await session.list_resources()
            res_uris = [str(r.uri) for r in res_list.resources]
            print(f"  [PASS] Resources Discovered ({len(res_list.resources)}): {', '.join(res_uris)}")
            assert "schema://customers" in res_uris
            assert "security://policy" in res_uris

            policy_res = await session.read_resource("security://policy")
            policy_text = getattr(policy_res.contents[0], "text", str(policy_res.contents[0]))
            assert "Zero Trust" in policy_text
            print(f"  [PASS] Resource Retrieved: security://policy ({len(policy_text)} bytes)")
            results["Resources"] = "PASS"

            # 4. Prompt Discovery & Rendering
            prompts_res = await session.list_prompts()
            prompt_names = [p.name for p in prompts_res.prompts]
            print(f"  [PASS] Prompts Discovered ({len(prompts_res.prompts)}): {', '.join(prompt_names)}")
            assert "customer_investigation_brief" in prompt_names

            rendered_prompt = await session.get_prompt("customer_investigation_brief", {"customer_id": "CUST-000001"})
            assert len(rendered_prompt.messages) > 0
            print("  [PASS] Prompt Rendered: customer_investigation_brief")
            results["Prompts"] = "PASS"

            # 5. Real Data Read Access
            read_res = await session.call_tool("get_customer", {"customer_id": "CUST-000001"})
            data = read_res.structured_content or (read_res.content[0].text if read_res.content else {})
            if isinstance(data, str):
                import json
                data = json.loads(data)
            assert data["status"] == "success"
            assert data["customer"]["customer_code"] == "CUST-000001"
            print(f"  [PASS] Read Real Data: Found customer '{data['customer']['name']}' (Country: {data['customer']['country']})")
            results["Real Data Read"] = "PASS"

            # 6. Destructive Operation Gating (Without approval)
            print("\n[PHASE 2] Verifying Human-in-the-Loop Gating for Sensitive Deletion...")
            test_target_code = "CUST-000002"
            gate_res = await session.call_tool("delete_customer", {
                "customer_id": test_target_code,
                "approval_ticket": "",
                "reason": "E2E verification of human gating",
            })
            gate_data = gate_res.structured_content or (gate_res.content[0].text if gate_res.content else {})
            if isinstance(gate_data, str):
                import json
                gate_data = json.loads(gate_data)

            assert gate_data["status"] == "rejected"
            assert gate_data["approval_required"] is True
            ticket_id = gate_data.get("ticket_id") or gate_data.get("approval_id")
            assert ticket_id, "Server must provide a staged approval ticket ID"
            print(f"  [PASS] Destructive Operation Blocked: Approval required. Staged Ticket={ticket_id}")
            results["HITL Gating"] = "PASS"

            # Verify target was NOT deleted
            pool = await get_db_pool()
            cust_repo = CustomerRepository(pool=pool)
            cust_still_exists = await cust_repo.get_customer_by_id(2)
            assert cust_still_exists is not None, "Target customer must remain intact before approval"
            print("  [PASS] Database Intact: Customer was NOT deleted.")

            # 7. Human Sign-Off & Execution
            print("\n[PHASE 3] Simulating Human Sign-Off & Approved Execution...")
            appr_repo = ApprovalRepository(pool=pool)
            await appr_repo.decide_approval(
                ticket_id=ticket_id,
                approver_id="security.lead@enterprise.test",
                decision="APPROVED",
                decision_notes="Approved for E2E testing",
            )
            print(f"  [PASS] Human Sign-Off Complete: Ticket {ticket_id} transitioned to APPROVED")

            # Retry with valid approval ticket
            exec_res = await session.call_tool("delete_customer", {
                "customer_id": test_target_code,
                "approval_ticket": ticket_id,
                "reason": "E2E verification of human gating",
            })
            exec_data = exec_res.structured_content or (exec_res.content[0].text if exec_res.content else {})
            if isinstance(exec_data, str):
                import json
                exec_data = json.loads(exec_data)

            assert exec_data["status"] == "success", f"Execution failed: {exec_data}"
            print("  [PASS] Approved Execution Succeeded: Customer permanently deleted with approval ticket.")
            results["Approved Execution"] = "PASS"

            # 8. Replay Attack Prevention
            print("\n[PHASE 4] Verifying Anti-Replay Defense on Consumed Ticket...")
            replay_res = await session.call_tool("delete_customer", {
                "customer_id": test_target_code,
                "approval_ticket": ticket_id,
                "reason": "E2E replay test",
            })
            replay_data = replay_res.structured_content or (replay_res.content[0].text if replay_res.content else {})
            if isinstance(replay_data, str):
                import json
                replay_data = json.loads(replay_data)

            assert replay_data["status"] in ("rejected", "error"), f"Replay was not blocked: {replay_data}"
            print("  [PASS] Replay Attack Blocked: Consumed ticket cannot be re-executed.")
            results["Anti-Replay"] = "PASS"

            # 9. SQL Injection / Input Validation Defense
            print("\n[PHASE 5] Verifying Input Validation & SQL Injection Defenses...")
            sqli_res = await session.call_tool("get_customer", {
                "customer_id": "1' OR '1'='1' --",
            })
            sqli_data = sqli_res.structured_content or (sqli_res.content[0].text if sqli_res.content else {})
            if isinstance(sqli_data, str):
                import json
                sqli_data = json.loads(sqli_data)

            assert sqli_data["status"] in ("error", "not_found")
            print("  [PASS] Malicious SQL Injection Safely Defeated: Input validated before execution.")
            results["SQL Injection Defense"] = "PASS"

    print("\n" + "=" * 80)
    print("ALL 9 E2E CLIENT VERIFICATION STAGES PASSED SUCCESSFULLY!")
    print("=" * 80)
    for k, v in results.items():
        print(f"  - {k:<25}: {v}")
    print("=" * 80)


if __name__ == "__main__":
    asyncio.run(main())
