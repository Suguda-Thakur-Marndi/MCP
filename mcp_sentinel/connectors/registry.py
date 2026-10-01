"""
Central Connector Registry for MCP Sentinel Multi-Software Gateway.
Maintains active connector instances, routes tool execution,
and discovers tools across all connected software systems.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from mcp_sentinel.connectors.base import BaseConnector
from mcp_sentinel.connectors.canva import CanvaConnector
from mcp_sentinel.connectors.github import GitHubConnector
from mcp_sentinel.connectors.google_drive import GoogleDriveConnector
from mcp_sentinel.connectors.local_mcp import LocalMcpConnector
from mcp_sentinel.connectors.models import (
    AuthType,
    ConnectorCredentials,
    ConnectorHealth,
    DiscoveredTool,
    IntegrationStatus,
    ProtocolType,
    ToolExecutionResult,
)
from mcp_sentinel.connectors.remote_mcp import RemoteMcpConnector
from mcp_sentinel.connectors.rest_api import RestApiConnector
from mcp_sentinel.connectors.slack import SlackConnector

logger = logging.getLogger(__name__)


class ConnectorRegistry:
    """
    Central manager for external software and MCP connectors.
    Thread-safe singleton lifecycle.
    """

    def __init__(self) -> None:
        self._connectors: dict[str, BaseConnector] = {}
        self._initialize_builtins()

    def _initialize_builtins(self) -> None:
        """Registers default platform connectors."""
        # 1. Canva (Phase 1 Remote MCP)
        self.register_connector(CanvaConnector())

        # 2. GitHub (Phase 2 REST API)
        self.register_connector(GitHubConnector())

        # 3. Slack (Phase 3 Web API)
        self.register_connector(SlackConnector())

        # 4. Google Drive (Phase 4 REST API)
        self.register_connector(GoogleDriveConnector())

        # 5. Local MCP PostgreSQL (FastMCP tools)
        self.register_connector(LocalMcpConnector())

    def register_connector(self, connector: BaseConnector) -> None:
        """Registers or replaces a connector instance."""
        self._connectors[connector.integration_id] = connector
        logger.info(f"Registered connector for integration: {connector.integration_id} ({connector.name})")

    def unregister_connector(self, integration_id: str) -> None:
        if integration_id in self._connectors:
            del self._connectors[integration_id]
            logger.info(f"Unregistered connector: {integration_id}")

    def get_connector(self, integration_id: str) -> Optional[BaseConnector]:
        return self._connectors.get(integration_id)

    def list_connectors(self) -> list[BaseConnector]:
        return list(self._connectors.values())

    def register_custom_mcp(
        self,
        server_id: str,
        name: str,
        endpoint: str,
        transport: str = "stream-http",
        auth_type: AuthType = AuthType.OAUTH2,
        credentials: Optional[ConnectorCredentials] = None,
    ) -> RemoteMcpConnector:
        """Registers an administrator-defined custom MCP server."""
        connector = RemoteMcpConnector(
            integration_id=server_id,
            name=name,
            endpoint=endpoint,
            auth_type=auth_type,
            credentials=credentials,
        )
        self.register_connector(connector)
        return connector

    async def discover_all_tools(self) -> list[DiscoveredTool]:
        """Queries all registered connectors and aggregates their tools."""
        all_tools: list[DiscoveredTool] = []
        for connector in self._connectors.values():
            try:
                tools = await connector.list_tools()
                all_tools.extend(tools)
            except Exception as exc:
                logger.warning(f"Error discovering tools for {connector.integration_id}: {exc}")
        return all_tools

    async def health_check_all(self) -> dict[str, ConnectorHealth]:
        """Runs concurrent health probes across all connectors."""
        results: dict[str, ConnectorHealth] = {}
        for int_id, connector in self._connectors.items():
            try:
                results[int_id] = await connector.health_check()
            except Exception as exc:
                results[int_id] = ConnectorHealth(
                    status=IntegrationStatus.ERROR,
                    latency_ms=0,
                    error_message=str(exc),
                )
        return results

    async def execute_tool(
        self,
        tool_id: str,
        parameters: dict[str, Any],
    ) -> ToolExecutionResult:
        """
        Routes tool execution to the appropriate connector.
        Tool ID format: '{integration_id}.{tool_name}' or matching registered tool.
        """
        integration_id = tool_id.split(".", 1)[0] if "." in tool_id else None
        
        # Check if matched by prefix
        if integration_id and integration_id in self._connectors:
            return await self._connectors[integration_id].execute_tool(tool_id, parameters)

        # Fallback: scan connectors for tool
        for connector in self._connectors.values():
            tools = await connector.list_tools()
            if any(t.tool_id == tool_id for t in tools):
                return await connector.execute_tool(tool_id, parameters)

        return ToolExecutionResult(
            success=False,
            error=f"No active connector found for tool: {tool_id}",
            latency_ms=0,
            status="FAILED",
            tool_id=tool_id,
            integration_id=integration_id or "unknown",
        )


# Global registry singleton
_registry_instance: Optional[ConnectorRegistry] = None


def get_connector_registry() -> ConnectorRegistry:
    global _registry_instance
    if _registry_instance is None:
        _registry_instance = ConnectorRegistry()
    return _registry_instance
