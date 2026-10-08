"""
Experimental Multi-Software Connector Platform.

NOTE: These connectors (Canva, GitHub, Slack, Google Drive, REST, and external MCP)
are optional, experimental standalone integration modules. They are NOT registered
as tools on the core FastMCP server tool surface. The core MCP server focuses
strictly on PostgreSQL enterprise data access with HITL gating.
"""

from mcp_sentinel.connectors.base import BaseConnector
from mcp_sentinel.connectors.canva import CanvaConnector
from mcp_sentinel.connectors.github import GitHubConnector
from mcp_sentinel.connectors.google_drive import GoogleDriveConnector
from mcp_sentinel.connectors.local_mcp import LocalMcpConnector
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
from mcp_sentinel.connectors.registry import ConnectorRegistry, get_connector_registry
from mcp_sentinel.connectors.remote_mcp import RemoteMcpConnector
from mcp_sentinel.connectors.rest_api import RestApiConnector
from mcp_sentinel.connectors.slack import SlackConnector
from mcp_sentinel.connectors.vault import CredentialVault, get_vault

__all__ = [
    "BaseConnector",
    "CanvaConnector",
    "GitHubConnector",
    "SlackConnector",
    "GoogleDriveConnector",
    "LocalMcpConnector",
    "RemoteMcpConnector",
    "RestApiConnector",
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
