"""
Abstract Base Connector interface for Multi-Software MCP Connector Platform.
Every integration (Canva, GitHub, Slack, Google Drive, Custom MCP, etc.)
inherits from BaseConnector and implements the 10 standard lifecycle methods.
"""

from __future__ import annotations

import abc
from datetime import datetime
from typing import Any, Optional

from mcp_sentinel.connectors.models import (
    AuthType,
    ConnectionTestResult,
    ConnectorCredentials,
    ConnectorHealth,
    DiscoveredTool,
    IntegrationStatus,
    ProtocolType,
    ToolExecutionResult,
)


class BaseConnector(abc.ABC):
    """
    Standard interface for all software connectors in MCP Sentinel.
    Enforces uniform lifecycle, tool discovery, schema introspection,
    execution, and health checking while accommodating varied auth methods.
    """

    def __init__(
        self,
        integration_id: str,
        name: str,
        endpoint: str,
        protocol_type: ProtocolType,
        auth_type: AuthType,
        credentials: Optional[ConnectorCredentials] = None,
    ) -> None:
        self.integration_id = integration_id
        self.name = name
        self.endpoint = endpoint
        self.protocol_type = protocol_type
        self.auth_type = auth_type
        self._credentials = credentials
        self._status = IntegrationStatus.DISCONNECTED
        self._connected: bool = False
        self._last_health_check: Optional[datetime] = None
        self._latency_ms: int = 0

    @property
    def is_connected(self) -> bool:
        return self._connected

    @property
    def status(self) -> IntegrationStatus:
        return self._status

    @abc.abstractmethod
    async def connect(self) -> bool:
        """
        Establishes connection to the external software/MCP server.
        Sets self._connected = True upon verified handshake.
        """
        pass

    @abc.abstractmethod
    async def disconnect(self) -> bool:
        """
        Terminates the active connection or transport session cleanly.
        """
        pass

    @abc.abstractmethod
    async def authenticate(self, credentials: ConnectorCredentials) -> bool:
        """
        Applies and validates credentials (OAuth token, PAT, API Key) for this connector.
        """
        pass

    @abc.abstractmethod
    async def refresh_auth(self) -> bool:
        """
        Refreshes expired OAuth tokens or rotates credentials if supported.
        Returns True if refresh succeeded, False otherwise.
        """
        pass

    @abc.abstractmethod
    async def test_connection(self) -> ConnectionTestResult:
        """
        Runs a ping/handshake test against the target endpoint and measures latency.
        """
        pass

    @abc.abstractmethod
    async def list_tools(self) -> list[DiscoveredTool]:
        """
        Discovers all available tools/operations exposed by the software or MCP server.
        """
        pass

    @abc.abstractmethod
    async def get_tool_schema(self, tool_id: str) -> dict[str, Any]:
        """
        Returns JSON Schema for inputs to a specific registered tool.
        """
        pass

    @abc.abstractmethod
    async def execute_tool(
        self,
        tool_id: str,
        parameters: dict[str, Any],
    ) -> ToolExecutionResult:
        """
        Executes a governed tool operation against the external software.
        Must only be invoked after the full Sentinel security pipeline
        (Identity -> Auth -> Policy -> Risk -> Approval) has passed.
        """
        pass

    @abc.abstractmethod
    async def revoke_credentials(self) -> bool:
        """
        Revokes the active tokens at the external provider where supported
        and clears internal credential state.
        """
        pass

    @abc.abstractmethod
    async def health_check(self) -> ConnectorHealth:
        """
        Performs a non-destructive health probe and returns ConnectorHealth.
        """
        pass
