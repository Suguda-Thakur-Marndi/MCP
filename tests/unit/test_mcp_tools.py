"""
Unit tests for SentinelCore FastMCP Server Tool Inventory and Security Boundaries.
Verifies:
- All 12 canonical tools are discovered and registered
- Tool annotations correctly reflect read_only and destructive hints
- Destructive operations fail closed when executed without a verified approval ticket
"""

import pytest


@pytest.mark.asyncio
async def test_fastmcp_server_registers_all_12_tools(fastmcp_server):
    """Verifies that the FastMCP server registers exactly the 12 canonical enterprise tools."""
    tools = await fastmcp_server.list_tools()
    tool_names = {t.name for t in tools}

    expected_tools = {
        # Core Customer & Order tools (8)
        "query_customer_records",
        "get_customer",
        "get_customer_orders",
        "get_order",
        "append_customer_audit_note",
        "update_customer",
        "delete_customer",
        "purge_inactive_customer_data",
        # Notion Integration tools (4)
        "search_pages",
        "get_page",
        "query_database",
        "archive_page",
    }

    assert expected_tools.issubset(tool_names), f"Missing tools: {expected_tools - tool_names}"
    assert len(tools) == 12


@pytest.mark.asyncio
async def test_fastmcp_tool_annotations_are_correct(fastmcp_server):
    """Verifies that tool annotations reflect security properties."""
    tools = await fastmcp_server.list_tools()
    tool_map = {t.name: t for t in tools}

    # Verify destructive annotations
    for d_name in ("delete_customer", "purge_inactive_customer_data", "archive_page"):
        tool = tool_map[d_name]
        assert tool.annotations is not None
        assert tool.annotations.destructive_hint is True
        assert tool.annotations.read_only_hint is False

    # Verify read-only annotations
    for r_name in (
        "query_customer_records",
        "get_customer",
        "get_customer_orders",
        "get_order",
        "search_pages",
        "get_page",
        "query_database",
    ):
        tool = tool_map[r_name]
        assert tool.annotations is not None
        assert tool.annotations.destructive_hint is False
        assert tool.annotations.read_only_hint is True


@pytest.mark.asyncio
async def test_destructive_tool_execution_blocks_without_approval(fastmcp_server):
    """Verifies that delete_customer called without an approval ticket fails closed."""
    res = await fastmcp_server.call_tool(
        "delete_customer",
        {"customer_id": "CUST-000001", "approval_ticket": None, "reason": "Test deletion"},
    )
    data = (
        res.structured_content
        if hasattr(res, "structured_content") and res.structured_content
        else res
    )
    if isinstance(data, list) and len(data) > 0 and hasattr(data[0], "text"):
        import json

        try:
            data = json.loads(data[0].text)
        except Exception:
            pass

    assert isinstance(data, dict)
    assert data.get("status") == "rejected"
    assert data.get("approval_required") is True
    assert data.get("decision") == "REQUIRE_APPROVAL"
    assert data.get("executed") is False
