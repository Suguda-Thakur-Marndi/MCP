"""
Tool Registry Service for MCP Sentinel Multi-Software Gateway.
Orchestrates tool discovery across all active connectors, synchronizes
tools with the database, and enforces the tool state machine:
DISCOVERED -> AVAILABLE -> AUTHORIZED -> APPROVED -> EXECUTED.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from mcp_sentinel.connectors.models import DiscoveredTool, ToolState
from mcp_sentinel.connectors.registry import ConnectorRegistry, get_connector_registry
from mcp_sentinel.repositories.tool_repository import ToolRepository

logger = logging.getLogger(__name__)


class ToolRegistryService:
    """
    Central tool registry management service.
    """

    def __init__(
        self,
        tool_repo: Optional[ToolRepository] = None,
        connector_registry: Optional[ConnectorRegistry] = None,
    ) -> None:
        self.tool_repo = tool_repo or ToolRepository()
        self.connector_registry = connector_registry or get_connector_registry()

    async def sync_all_tools(self) -> list[dict[str, Any]]:
        """
        Discovers tools across all active connectors and persists them to the database.
        """
        discovered = await self.connector_registry.discover_all_tools()
        synced: list[dict[str, Any]] = []

        for tool in discovered:
            # Check connector connection status to set state
            connector = self.connector_registry.get_connector(tool.integration_id)
            if connector and connector.is_connected:
                tool.state = ToolState.AVAILABLE
            else:
                tool.state = ToolState.DISCOVERED

            saved = await self.tool_repo.upsert_tool(tool)
            synced.append(saved)

        logger.info(f"Synchronized {len(synced)} tools to database registry.")
        return synced

    async def get_tool(self, tool_id: str) -> Optional[dict[str, Any]]:
        return await self.tool_repo.get_tool(tool_id)

    async def list_tools(
        self,
        integration_id: Optional[str] = None,
        risk_level: Optional[str] = None,
        enabled_only: bool = False,
    ) -> list[dict[str, Any]]:
        return await self.tool_repo.list_tools(
            integration_id=integration_id,
            risk_level=risk_level,
            enabled_only=enabled_only,
        )

    async def authorize_tool(self, tool_id: str) -> None:
        """Transitions tool to AUTHORIZED state."""
        await self.tool_repo.update_tool_state(tool_id, ToolState.AUTHORIZED)

    async def approve_tool(self, tool_id: str) -> None:
        """Transitions tool to APPROVED state."""
        await self.tool_repo.update_tool_state(tool_id, ToolState.APPROVED)
