"""
Generic Remote MCP Server Connector for MCP Sentinel.
Connects to remote MCP servers via Streamable HTTP / SSE JSON-RPC 2.0 protocol.
Handles initialization, tool discovery, input schema inspection, and execution.
"""

from __future__ import annotations

import time
from datetime import datetime
from typing import Any, Optional
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
    RiskLevel,
    ToolExecutionResult,
    ToolState,
)


class RemoteMcpConnector(BaseConnector):
    """
    Connects to external MCP servers exposing HTTP/SSE endpoints (such as Canva remote MCP).
    """

    def __init__(
        self,
        integration_id: str,
        name: str,
        endpoint: str,
        auth_type: AuthType = AuthType.OAUTH2,
        credentials: Optional[ConnectorCredentials] = None,
        timeout_seconds: float = 15.0,
    ) -> None:
        super().__init__(
            integration_id=integration_id,
            name=name,
            endpoint=endpoint,
            protocol_type=ProtocolType.REMOTE_MCP,
            auth_type=auth_type,
            credentials=credentials,
        )
        self.timeout_seconds = timeout_seconds
        self._server_info: dict[str, Any] = {}
        self._capabilities: dict[str, Any] = {}
        self._tool_cache: dict[str, DiscoveredTool] = {}

    def _get_headers(self) -> dict[str, str]:
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
            "User-Agent": "MCP-Sentinel-Gateway/1.0",
        }
        if self._credentials and self._credentials.access_token:
            headers["Authorization"] = f"{self._credentials.token_type} {self._credentials.access_token}"
        elif self._credentials and self._credentials.api_key:
            headers["Authorization"] = f"Bearer {self._credentials.api_key}"
        return headers

    async def _send_rpc(self, method: str, params: Optional[dict[str, Any]] = None) -> dict[str, Any]:
        """Sends a JSON-RPC 2.0 request to the remote MCP server."""
        payload = {
            "jsonrpc": "2.0",
            "id": int(time.time() * 1000),
            "method": method,
            "params": params or {},
        }
        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            resp = await client.post(
                self.endpoint,
                json=payload,
                headers=self._get_headers(),
            )
            if resp.status_code == 401:
                self._status = IntegrationStatus.ERROR
                raise PermissionError("Remote MCP authentication failed: 401 Unauthorized")
            if resp.status_code == 403:
                self._status = IntegrationStatus.ERROR
                raise PermissionError("Remote MCP access forbidden: 403 Forbidden")
            if resp.status_code >= 400:
                raise RuntimeError(f"Remote MCP HTTP {resp.status_code}: {resp.text}")

            data = resp.json()
            if "error" in data:
                err = data["error"]
                raise RuntimeError(f"Remote MCP error ({err.get('code')}): {err.get('message')}")
            return data.get("result", {})

    async def connect(self) -> bool:
        """Handshake with the remote MCP server via 'initialize'."""
        try:
            start = time.perf_counter()
            init_params = {
                "protocolVersion": "2024-11-05",
                "capabilities": {
                    "tools": {"listChanged": True},
                    "logging": {},
                },
                "clientInfo": {
                    "name": "mcp-sentinel-gateway",
                    "version": "1.0.0",
                },
            }
            result = await self._send_rpc("initialize", init_params)
            self._server_info = result.get("serverInfo", {})
            self._capabilities = result.get("capabilities", {})
            self._latency_ms = int((time.perf_counter() - start) * 1000)
            self._connected = True
            self._status = IntegrationStatus.CONNECTED
            return True
        except Exception:
            self._connected = False
            self._status = IntegrationStatus.ERROR
            raise

    async def disconnect(self) -> bool:
        self._connected = False
        self._status = IntegrationStatus.DISCONNECTED
        self._tool_cache.clear()
        return True

    async def authenticate(self, credentials: ConnectorCredentials) -> bool:
        self._credentials = credentials
        return await self.connect()

    async def refresh_auth(self) -> bool:
        # Implemented by sub-classes or OAuth manager
        return False

    async def test_connection(self) -> ConnectionTestResult:
        start = time.perf_counter()
        try:
            # Probe endpoint
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                resp = await client.get(self.endpoint, headers=self._get_headers())
            latency = int((time.perf_counter() - start) * 1000)
            is_valid = resp.status_code in (200, 400, 404, 405) # Active HTTP service
            return ConnectionTestResult(
                success=is_valid,
                latency_ms=latency,
                message="Remote MCP endpoint reachable" if is_valid else f"Status: {resp.status_code}",
                server_version=self._server_info.get("version"),
                protocol_version="2024-11-05",
            )
        except Exception as exc:
            latency = int((time.perf_counter() - start) * 1000)
            return ConnectionTestResult(
                success=False,
                latency_ms=latency,
                message=f"Connection failed: {str(exc)}",
            )

    async def list_tools(self) -> list[DiscoveredTool]:
        """Queries 'tools/list' and converts remote MCP tools into DiscoveredTool models."""
        result = await self._send_rpc("tools/list")
        raw_tools = result.get("tools", [])
        discovered: list[DiscoveredTool] = []

        for item in raw_tools:
            name = item.get("name", "")
            tool_id = f"{self.integration_id}.{name}" if not name.startswith(self.integration_id) else name
            desc = item.get("description", "")
            schema = item.get("inputSchema", {})

            # Default risk classification based on name patterns
            risk = RiskLevel.MEDIUM
            lower_name = name.lower()
            if any(w in lower_name for w in ["search", "list", "get", "read", "view"]):
                risk = RiskLevel.LOW
            elif any(w in lower_name for w in ["delete", "remove", "purge", "revoke", "destroy"]):
                risk = RiskLevel.CRITICAL
            elif any(w in lower_name for w in ["create", "post", "send", "update", "patch"]):
                risk = RiskLevel.HIGH

            tool = DiscoveredTool(
                tool_id=tool_id,
                integration_id=self.integration_id,
                name=name,
                description=desc,
                input_schema=schema,
                risk_level=risk,
                approval_required=(risk in (RiskLevel.HIGH, RiskLevel.CRITICAL)),
                enabled=True,
                state=ToolState.AVAILABLE if self.is_connected else ToolState.DISCOVERED,
            )
            self._tool_cache[tool_id] = tool
            discovered.append(tool)

        return discovered

    async def get_tool_schema(self, tool_id: str) -> dict[str, Any]:
        if tool_id in self._tool_cache:
            return self._tool_cache[tool_id].input_schema
        tools = await self.list_tools()
        for t in tools:
            if t.tool_id == tool_id:
                return t.input_schema
        return {}

    async def execute_tool(
        self,
        tool_id: str,
        parameters: dict[str, Any],
    ) -> ToolExecutionResult:
        start = time.perf_counter()
        raw_tool_name = tool_id.split(".", 1)[-1] if "." in tool_id else tool_id

        try:
            result = await self._send_rpc("tools/call", {
                "name": raw_tool_name,
                "arguments": parameters,
            })
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
