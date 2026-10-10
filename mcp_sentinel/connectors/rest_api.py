"""
Generic REST API Connector for MCP Sentinel.
Provides governed API connectivity for integrations without a native MCP server
(or standard REST APIs like GitHub, Slack, Google Drive, Notion, Jira).
Translates governed tool calls into secure HTTP operations.
"""

from __future__ import annotations

import time
from typing import Any, Callable, Coroutine, Optional

import httpx

from mcp_sentinel.connectors.base import BaseConnector
from mcp_sentinel.connectors.models import (
    AuthType,
    ConnectionTestResult,
    ConnectorCredentials,
    ConnectorHealth,
    DiscoveredTool,
    IntegrationStatus,
    ProtocolType,
    ToolExecutionResult,
    ToolState,
)


class RestApiConnector(BaseConnector):
    """
    Connects to external REST APIs, maps declared tool actions to HTTP requests,
    and applies uniform security parameters.
    """

    def __init__(
        self,
        integration_id: str,
        name: str,
        base_url: str,
        auth_type: AuthType = AuthType.OAUTH2,
        credentials: Optional[ConnectorCredentials] = None,
        timeout_seconds: float = 15.0,
    ) -> None:
        super().__init__(
            integration_id=integration_id,
            name=name,
            endpoint=base_url,
            protocol_type=ProtocolType.REST_API,
            auth_type=auth_type,
            credentials=credentials,
        )
        self.timeout_seconds = timeout_seconds
        self._declared_tools: dict[str, DiscoveredTool] = {}
        self._tool_handlers: dict[str, Callable[[dict[str, Any]], Coroutine[Any, Any, Any]]] = {}

    def register_tool(
        self,
        tool: DiscoveredTool,
        handler: Optional[Callable[[dict[str, Any]], Coroutine[Any, Any, Any]]] = None,
    ) -> None:
        """Registers a known REST operation as a discoverable tool with an optional handler."""
        self._declared_tools[tool.tool_id] = tool
        if handler:
            self._tool_handlers[tool.tool_id] = handler

    def _get_auth_headers(self) -> dict[str, str]:
        headers = {
            "Accept": "application/json",
            "User-Agent": "MCP-Sentinel-Gateway/1.0",
        }
        if self._credentials:
            if self._credentials.access_token:
                headers["Authorization"] = f"{self._credentials.token_type} {self._credentials.access_token}"
            elif self._credentials.api_key:
                headers["Authorization"] = f"Bearer {self._credentials.api_key}"
        return headers

    async def connect(self) -> bool:
        """Verifies credentials against the API via test_connection."""
        test_res = await self.test_connection()
        if test_res.success:
            self._connected = True
            self._status = IntegrationStatus.CONNECTED
            for t in self._declared_tools.values():
                t.state = ToolState.AVAILABLE
            return True
        else:
            self._connected = False
            self._status = IntegrationStatus.ERROR
            return False

    async def disconnect(self) -> bool:
        self._connected = False
        self._status = IntegrationStatus.DISCONNECTED
        for t in self._declared_tools.values():
            t.state = ToolState.DISCOVERED
        return True

    async def authenticate(self, credentials: ConnectorCredentials) -> bool:
        self._credentials = credentials
        return await self.connect()

    async def refresh_auth(self) -> bool:
        return False

    async def test_connection(self) -> ConnectionTestResult:
        start = time.perf_counter()
        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                resp = await client.get(self.endpoint, headers=self._get_auth_headers())
            latency = int((time.perf_counter() - start) * 1000)
            success = resp.status_code < 400
            return ConnectionTestResult(
                success=success,
                latency_ms=latency,
                message=f"HTTP {resp.status_code}" if not success else "Connected successfully",
                details={"status_code": resp.status_code},
            )
        except Exception as exc:
            latency = int((time.perf_counter() - start) * 1000)
            return ConnectionTestResult(
                success=False,
                latency_ms=latency,
                message=f"Network error: {str(exc)}",
            )

    async def list_tools(self) -> list[DiscoveredTool]:
        return list(self._declared_tools.values())

    async def get_tool_schema(self, tool_id: str) -> dict[str, Any]:
        tool = self._declared_tools.get(tool_id)
        return tool.input_schema if tool else {}

    async def execute_tool(
        self,
        tool_id: str,
        parameters: dict[str, Any],
    ) -> ToolExecutionResult:
        start = time.perf_counter()
        if not self._connected and self.auth_type != AuthType.NONE:
            return ToolExecutionResult(
                success=False,
                error="Connector is not connected or authenticated.",
                latency_ms=0,
                status="BLOCKED",
                tool_id=tool_id,
                integration_id=self.integration_id,
            )

        handler = self._tool_handlers.get(tool_id)
        if not handler:
            return ToolExecutionResult(
                success=False,
                error=f"No execution handler registered for tool: {tool_id}",
                latency_ms=0,
                status="FAILED",
                tool_id=tool_id,
                integration_id=self.integration_id,
            )

        try:
            result = await handler(parameters)
            latency = int((time.perf_counter() - start) * 1000)
            return ToolExecutionResult(
                success=True,
                data=result,
                latency_ms=latency,
                status="EXECUTED",
                tool_id=tool_id,
                integration_id=self.integration_id,
            )
        except Exception as exc:
            latency = int((time.perf_counter() - start) * 1000)
            return ToolExecutionResult(
                success=False,
                error=str(exc),
                latency_ms=latency,
                status="FAILED",
                tool_id=tool_id,
                integration_id=self.integration_id,
            )

    async def revoke_credentials(self) -> bool:
        self._credentials = None
        await self.disconnect()
        return True

    async def health_check(self) -> ConnectorHealth:
        start = time.perf_counter()
        try:
            test_res = await self.test_connection()
            latency = int((time.perf_counter() - start) * 1000)
            status = IntegrationStatus.CONNECTED if test_res.success else IntegrationStatus.DEGRADED
            self._status = status
            return ConnectorHealth(
                status=status,
                latency_ms=latency,
                error_message=None if test_res.success else test_res.message,
            )
        except Exception as exc:
            latency = int((time.perf_counter() - start) * 1000)
            self._status = IntegrationStatus.ERROR
            return ConnectorHealth(
                status=IntegrationStatus.ERROR,
                latency_ms=latency,
                error_message=str(exc),
            )
