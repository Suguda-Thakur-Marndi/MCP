"""
Enterprise Data Connectors for SentinelCore.
Focuses strictly on:
1. Notion REST API (workspace pages, database querying, page archival)
2. Supabase PostgreSQL (database connection pool, customer, order, and audit persistence)
"""

from mcp_sentinel.connectors.base import BaseConnector
from mcp_sentinel.connectors.models import (
    AuthType,
    ConnectionTestResult,
    ConnectorCredentials,
    ConnectorHealth,
    DiscoveredTool,
    IntegrationStatus,
    ProtocolType,
    RiskLevel,
    ToolExecutionResult,
    ToolState,
)
from mcp_sentinel.connectors.notion import NotionConnector
from mcp_sentinel.connectors.registry import ConnectorRegistry, get_connector_registry
from mcp_sentinel.connectors.supabase import SupabaseConnector
from mcp_sentinel.connectors.vault import CredentialVault, get_vault

__all__ = [
    "BaseConnector",
    "NotionConnector",
    "SupabaseConnector",
    "ConnectorRegistry",
    "get_connector_registry",
    "CredentialVault",
    "get_vault",
    "AuthType",
    "ProtocolType",
    "IntegrationStatus",
    "ToolState",
    "RiskLevel",
    "ConnectorCredentials",
    "ConnectionTestResult",
    "DiscoveredTool",
    "ToolExecutionResult",
    "ConnectorHealth",
]
