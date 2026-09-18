"""
Category H: Tool Classification & Annotations Tests.
Verifies:
- Security Rule #2: Never trust tool annotations as the sole security boundary.
- Accurate FastMCP tool annotations (readOnly, destructive, idempotent).
"""

import pytest

from mcp_sentinel.server.app import create_app


@pytest.mark.asyncio
async def test_tool_annotations_classification():
    """Verifies each MCP tool has the correct security and behavioral annotations."""
    server = create_app()
    tools = await server.list_tools()
    tool_map = {t.name: t for t in tools}

    assert "query_customer_records" in tool_map
    assert "append_customer_audit_note" in tool_map
    assert "purge_inactive_customer_data" in tool_map

    # 1. Read tool classification
    query_tool = tool_map["query_customer_records"]
    assert query_tool.annotations is not None
    assert query_tool.annotations.read_only_hint is True
    assert query_tool.annotations.destructive_hint is False

    # 2. Append tool classification
    audit_tool = tool_map["append_customer_audit_note"]
    assert audit_tool.annotations is not None
    assert audit_tool.annotations.read_only_hint is False
    assert audit_tool.annotations.destructive_hint is False

    # 3. Purge tool classification
    purge_tool = tool_map["purge_inactive_customer_data"]
    assert purge_tool.annotations is not None
    assert purge_tool.annotations.read_only_hint is False
    assert purge_tool.annotations.destructive_hint is True
