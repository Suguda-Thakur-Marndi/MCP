"""
Unit tests for MCP-Sentinel Connectors and Registry.
Verifies:
- Built-in connector discovery (Notion and Supabase)
- Tool listing across connectors
- Notion tool validation and read-only gating
- Credential safety in string representations
"""

import pytest

from mcp_sentinel.connectors.models import ConnectorCredentials, RiskLevel
from mcp_sentinel.connectors.notion import NotionConnector
from mcp_sentinel.connectors.registry import ConnectorRegistry
from mcp_sentinel.connectors.supabase import SupabaseConnector


def test_connector_registry_builtins():
    """Verifies that the central registry automatically initializes with built-in connectors."""
    registry = ConnectorRegistry()
    connectors = registry.list_connectors()
    ids = [c.integration_id for c in connectors]

    assert "notion" in ids
    assert "supabase" in ids

    notion = registry.get_connector("notion")
    assert isinstance(notion, NotionConnector)

    supabase = registry.get_connector("supabase")
    assert isinstance(supabase, SupabaseConnector)


@pytest.mark.asyncio
async def test_notion_connector_tools_registration():
    """Verifies Notion connector registers the authoritative 4 tools."""
    connector = NotionConnector()
    tools = await connector.list_tools()
    tool_names = [t.name for t in tools]

    assert "search_pages" in tool_names
    assert "get_page" in tool_names
    assert "query_database" in tool_names
    assert "archive_page" in tool_names

    archive_tool = next(t for t in tools if t.name == "archive_page")
    assert archive_tool.approval_required is True
    assert archive_tool.risk_level in (RiskLevel.HIGH, RiskLevel.CRITICAL)


@pytest.mark.asyncio
async def test_notion_connector_rejects_malformed_page_uuid():
    """Verifies that get_page rejects non-UUID arguments immediately without issuing HTTP calls."""
    connector = NotionConnector()
    res = await connector.get_page(page_id="invalid-uuid' OR 1=1--")

    assert res["status"] == "error"
    assert "Invalid or missing page_id" in res["message"]


def test_connector_repr_does_not_leak_secrets():
    """Verifies connector representation does not print raw secrets."""
    connector = NotionConnector()
    connector._credentials = ConnectorCredentials(api_key="ntn_super_secret_token_1234567890")
    conn_repr = repr(connector)
    conn_str = str(connector)
    assert "ntn_super_secret_token_1234567890" not in conn_repr
    assert "ntn_super_secret_token_1234567890" not in conn_str
