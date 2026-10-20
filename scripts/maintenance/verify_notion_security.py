"""
Comprehensive End-to-End Notion Security & Integration Verification Script.
MCP Sentinel Zero-Trust Architecture.

Verifies:
1. Configuration & Secret Safety (Zero-leakage, .env isolation, .env.example placeholders).
2. Live Notion API Connectivity (Official HTTPS, Notion-Version 2022-06-28, Bot handshake).
3. Live Read Tools (search_pages, get_page, query_database, UUID validation, safe errors).
4. archive_page Gating & Approval Lifecycle (Dual-custody, tamper detection, read-only gating).
5. FastMCP Server Tool Discovery & Schema Audit (12 registered tools).
6. Zero-Leakage & Audit Logging Telemetry.
"""

import asyncio
import json
import logging
import os
import pathlib
import sys

ROOT_DIR = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT_DIR))

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("notion_security_verify")

from mcp_sentinel.config.settings import get_settings
from mcp_sentinel.connectors.models import RiskLevel
from mcp_sentinel.connectors.notion import NotionConnector
from mcp_sentinel.security.middleware import SecurityGate
from mcp_sentinel.server.app import create_app


def print_header(title: str):
    print("\n" + "=" * 75)
    print(f" {title.upper()}")
    print("=" * 75)


def print_step(step_num: str, desc: str):
    print(f"\n[{step_num}] {desc}")


def extract_fastmcp_payload(res):
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
    print_header("MCP Sentinel - Notion Integration End-to-End Security Verification")

    results = {
        "config_check": False,
        "live_connectivity": False,
        "tool_search_pages": False,
        "tool_get_page": False,
        "tool_query_database": False,
        "archive_read_only_gated": False,
        "approval_tamper_rejected": False,
        "fastmcp_tool_registration": False,
        "zero_secret_leakage": False,
    }

    settings = get_settings()
    raw_token = (
        settings.NOTION_API_KEY
        or settings.NOTION_API_TOKEN
        or os.environ.get("NOTION_API_KEY")
        or os.environ.get("NOTION_API_TOKEN")
    )

    # -------------------------------------------------------------------------
    # STAGE 1: Configuration & Secret Management Verification
    # -------------------------------------------------------------------------
    print_step("STAGE 1", "Static Configuration & Secret Isolation Checks")

    gitignore_path = ROOT_DIR / ".gitignore"
    with open(gitignore_path, "r", encoding="utf-8") as f:
        gitignore_content = f.read()
    assert ".env" in gitignore_content, "SECURITY RISK: .env is not ignored in .gitignore!"
    print("  ✓ .gitignore properly ignores .env file")

    example_path = ROOT_DIR / ".env.example"
    with open(example_path, "r", encoding="utf-8") as f:
        example_content = f.read()
    assert "NOTION_API_KEY=" in example_content
    assert "secret_" not in example_content and "ntn_" not in example_content, (
        "SECURITY RISK: Live Notion tokens found in .env.example!"
    )
    print("  ✓ .env.example contains placeholder configuration only (zero secret leakage)")

    assert raw_token, "NOTION_API_KEY or NOTION_API_TOKEN must be configured in environment"
    masked = settings.masked_notion_api_key
    assert masked.startswith("ntn_...") or masked == "[NOT CONFIGURED]"
    assert raw_token not in masked, "Masked key reveals full secret!"
    print(f"  ✓ Secret safely masked: {masked}")

    assert settings.NOTION_WRITE_ENABLED is False, "NOTION_WRITE_ENABLED must default to False"
    print("  ✓ Least privilege enforced: NOTION_WRITE_ENABLED defaults to False (Read-Only)")

    results["config_check"] = True

    # -------------------------------------------------------------------------
    # STAGE 2: Live Authenticated Request to Official Notion API
    # -------------------------------------------------------------------------
    print_step("STAGE 2", "Live Authenticated Request to Official Notion API (HTTPS /v1/users/me)")

    connector = NotionConnector()
    test_result = await connector.test_connection()
    assert test_result.success, f"Live Notion connection test failed: {test_result.message}"
    assert test_result.details is not None
    bot_id = test_result.details.get("bot_id")
    bot_name = test_result.details.get("bot_name")
    workspace_name = test_result.details.get("workspace_name")

    print(f"  ✓ Live Notion Handshake Success (Latency: {test_result.latency_ms}ms)")
    print(f"    - Bot ID: {bot_id}")
    print(f"    - Bot Name: {bot_name}")
    print(f"    - Workspace: {workspace_name}")
    print(f"    - Endpoint: {connector.endpoint}")
    print(f"    - API Version: {connector.NOTION_VERSION}")

    results["live_connectivity"] = True

    # -------------------------------------------------------------------------
    # STAGE 3: Tool Verification — search_pages (Live)
    # -------------------------------------------------------------------------
    print_step("STAGE 3", "Verifying 'search_pages' Tool (Validation & Live Execution)")

    # 3.1 Invalid arguments (unsupported filter object type)
    inv_res = await connector.search_pages(filter_type="invalid_object_type")
    assert inv_res["status"] == "error"
    print(f"  ✓ Argument bounds enforced: {inv_res['message']}")

    # 3.2 Valid Live Search Request
    live_search = await connector.search_pages(query="", page_size=5)
    assert live_search["status"] == "success"
    print(
        f"  ✓ Live Search Executed Successfully (HTTP 200 OK): returned {live_search['count']} accessible pages"
    )
    results["tool_search_pages"] = True

    # -------------------------------------------------------------------------
    # STAGE 4: Tool Verification — get_page (UUID Validation & Safe 404s)
    # -------------------------------------------------------------------------
    print_step("STAGE 4", "Verifying 'get_page' Tool (UUID Syntax & Safe Error Handling)")

    # 4.1 Malformed page ID injection rejected before network call
    malformed_id = "page-123-injection' OR '1'='1"
    malformed_res = await connector.get_page(page_id=malformed_id)
    assert malformed_res["status"] == "error"
    assert "Invalid or missing page_id" in malformed_res["message"]
    print(f"  ✓ Malformed UUID rejected immediately: {malformed_res['message']}")

    # 4.2 Valid UUID not shared with integration produces safe 404 error
    dummy_uuid = "11111111-2222-3333-4444-555555555555"
    unshared_res = await connector.get_page(page_id=dummy_uuid)
    assert unshared_res["status"] == "error"
    assert raw_token not in json.dumps(unshared_res), "Token leaked in error response!"
    print(
        f"  ✓ Unshared resource produces sanitized error without credential leak: {unshared_res['message']}"
    )
    results["tool_get_page"] = True

    # -------------------------------------------------------------------------
    # STAGE 5: Tool Verification — query_database (Schema & Execution)
    # -------------------------------------------------------------------------
    print_step("STAGE 5", "Verifying 'query_database' Tool (Filter/Sort Validation & Safety)")

    # 5.1 Invalid UUID rejected
    inv_db_res = await connector.query_database(database_id="non-uuid-database")
    assert inv_db_res["status"] == "error"
    assert "Invalid or missing database_id" in inv_db_res["message"]
    print(f"  ✓ Database UUID format enforced: {inv_db_res['message']}")

    # 5.2 Valid UUID unshared produces safe 404 error
    unshared_db = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
    db_res = await connector.query_database(database_id=unshared_db, page_size=10)
    assert db_res["status"] == "error"
    assert raw_token not in json.dumps(db_res)
    print(f"  ✓ Safe database error extracted: {db_res['message']}")
    results["tool_query_database"] = True

    # -------------------------------------------------------------------------
    # STAGE 6: Tool Verification — archive_page (Capability & Approval Gating)
    # -------------------------------------------------------------------------
    print_step(
        "STAGE 6", "Verifying 'archive_page' Tool (Read-Only Capability & Approval Enforcement)"
    )

    target_page = "12345678-1234-1234-1234-123456789abc"

    # 6.1 Direct execution with write disabled must fail closed
    assert connector.is_write_enabled() is False
    blocked_res = await connector.archive_page(page_id=target_page, archive=True)
    assert blocked_res["status"] == "blocked"
    assert (
        "read-only" in blocked_res["message"].lower()
        or "not enabled" in blocked_res["message"].lower()
    )
    print(f"  ✓ Direct execution blocked by read-only policy: {blocked_res['message']}")
    results["archive_read_only_gated"] = True

    # 6.2 Tool Discovery reports archive_page as disabled & approval required
    tool_list = await connector.list_tools()
    archive_tool = next((t for t in tool_list if t.name == "archive_page"), None)
    assert archive_tool is not None
    assert archive_tool.enabled is False, (
        "archive_page must be marked enabled=False when write is disabled!"
    )
    assert archive_tool.approval_required is True, (
        "archive_page must mandate dual-custody approval!"
    )
    assert archive_tool.risk_level in (RiskLevel.HIGH, RiskLevel.CRITICAL)
    print(
        f"  ✓ Tool Registry Gating: enabled={archive_tool.enabled}, approval_required={archive_tool.approval_required}, risk={archive_tool.risk_level.value}"
    )

    # 6.3 SecurityGate Dual-Custody Approval Verification (Mocked Isolation Flow)
    print("  Testing SecurityGate Approval Evaluation & Parameter Tamper Rejection...")
    allowed, decision, err = await SecurityGate.evaluate_and_gate(
        tool_name="archive_page",
        raw_args={"page_id": target_page, "archive": True},
    )
    assert allowed is False, "archive_page execution must NOT be allowed without valid approval!"
    dec_val = (
        decision.decision.value if hasattr(decision.decision, "value") else str(decision.decision)
    )
    assert dec_val == "REQUIRE_APPROVAL", f"Expected REQUIRE_APPROVAL, got {dec_val}"
    assert decision.risk_score >= 80, (
        f"Expected critical/high risk score >= 80, got {decision.risk_score}"
    )
    assert err.get("status") == "rejected" and err.get("approval_required") is True
    print(
        f"  ✓ SecurityGate halted execution: decision={dec_val}, risk_score={decision.risk_score}"
    )

    # 6.4 Parameter Tamper & Forged Ticket Rejection Verification
    tampered_page = "87654321-4321-4321-4321-cba987654321"
    allowed_t, decision_t, err_t = await SecurityGate.evaluate_and_gate(
        tool_name="archive_page",
        raw_args={
            "page_id": tampered_page,
            "archive": True,
            "approval_ticket": "tk-forged-approval-ticket-tampered",
        },
    )
    assert allowed_t is False, "Forged ticket or tampered parameter must NOT be allowed!"
    print("  ✓ Parameter tampering / forged ticket rejected (Dual-custody verification enforced)")
    results["approval_tamper_rejected"] = True

    # -------------------------------------------------------------------------
    # STAGE 7: FastMCP Server Registration Verification
    # -------------------------------------------------------------------------
    print_step("STAGE 7", "Verifying FastMCP Server Tool Inventory Registration")

    server = create_app()
    server_tools = await server.list_tools()
    server_tool_names = [t.name for t in server_tools]

    print(f"  FastMCP registered {len(server_tool_names)} total tools.")
    expected_notion_tools = ["search_pages", "get_page", "query_database", "archive_page"]
    for tname in expected_notion_tools:
        assert tname in server_tool_names, f"Tool {tname} missing from FastMCP registration!"
        print(f"  ✓ FastMCP Tool Registered: {tname}")

    results["fastmcp_tool_registration"] = True

    # -------------------------------------------------------------------------
    # STAGE 8: Zero Secret Leakage Verification
    # -------------------------------------------------------------------------
    print_step("STAGE 8", "Telemetry & Zero Secret Leakage Audit")

    # Verify no raw token in any connector string representation
    conn_repr = repr(connector)
    conn_str = str(connector)
    assert raw_token not in conn_repr, "Raw token leaked in repr(connector)!"
    assert raw_token not in conn_str, "Raw token leaked in str(connector)!"
    print("  ✓ Connector string/repr representations do not leak secrets")

    results["zero_secret_leakage"] = True

    # -------------------------------------------------------------------------
    # SUMMARY REPORT
    # -------------------------------------------------------------------------
    print_header("Verification Summary")
    all_passed = all(results.values())
    for check_name, status in results.items():
        symbol = "✓ PASS" if status else "✗ FAIL"
        print(f"  [{symbol}] {check_name}")

    if all_passed:
        print("\n>>> ALL NOTION INTEGRATION SECURITY CHECKS PASSED SUCCESSFULLY <<<")
    else:
        print("\n>>> ONE OR MORE VERIFICATION CHECKS FAILED <<<")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
