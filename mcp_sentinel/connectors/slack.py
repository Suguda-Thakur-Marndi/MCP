"""
Slack Connector for MCP Sentinel.
Connects to Slack Web API (https://slack.com/api).
Supports Bot Token OAuth (xoxb-...), channel reading, message search,
and governed message posting through Sentinel's security gateway.
"""

from __future__ import annotations

import time
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


class SlackConnector(BaseConnector):
    """
    Official Slack Web API Connector.
    Endpoint: https://slack.com/api
    """

    DEFAULT_ENDPOINT = "https://slack.com/api"

    STANDARD_SLACK_TOOLS = [
        {
            "id": "slack.search_messages",
            "name": "search_messages",
            "desc": "Search public workspace channels for messages matching query terms.",
            "risk": RiskLevel.LOW,
            "approval": False,
            "schema": {
                "type": "object",
                "required": ["query"],
                "properties": {
                    "query": {"type": "string", "description": "Search query terms"},
                    "count": {"type": "integer", "default": 20, "maximum": 100},
                },
            },
        },
        {
            "id": "slack.read_channel",
            "name": "read_channel",
            "desc": "Fetch recent messages and conversation history from a specific channel.",
            "risk": RiskLevel.LOW,
            "approval": False,
            "schema": {
                "type": "object",
                "required": ["channel_id"],
                "properties": {
                    "channel_id": {"type": "string", "description": "Slack channel ID (e.g. C12345)"},
                    "limit": {"type": "integer", "default": 30, "maximum": 100},
                },
            },
        },
        {
            "id": "slack.send_message",
            "name": "send_message",
            "desc": "Post a message or alert to an authorized Slack channel. Governed external action.",
            "risk": RiskLevel.HIGH,
            "approval": True,
            "schema": {
                "type": "object",
                "required": ["channel_id", "text"],
                "properties": {
                    "channel_id": {"type": "string", "description": "Target channel ID"},
                    "text": {"type": "string", "description": "Message body to post"},
                    "as_user": {"type": "boolean", "default": True},
                },
            },
        },
    ]

    def __init__(
        self,
        endpoint: str = DEFAULT_ENDPOINT,
        credentials: Optional[ConnectorCredentials] = None,
        timeout_seconds: float = 15.0,
    ) -> None:
        super().__init__(
            integration_id="slack",
            name="Slack",
            endpoint=endpoint,
            protocol_type=ProtocolType.REST_API,
            auth_type=AuthType.OAUTH2,
            credentials=credentials,
        )
        self.timeout_seconds = timeout_seconds
        self._tool_cache: dict[str, DiscoveredTool] = {}

    def _get_headers(self) -> dict[str, str]:
        headers = {
            "Content-Type": "application/json; charset=utf-8",
            "User-Agent": "MCP-Sentinel-Gateway/1.0",
        }
        token = None
        if self._credentials:
            token = self._credentials.access_token or self._credentials.api_key
        if token:
            headers["Authorization"] = f"Bearer {token}"
        return headers

    async def connect(self) -> bool:
        test = await self.test_connection()
        if test.success:
            self._connected = True
            self._status = IntegrationStatus.CONNECTED
            return True
        self._connected = False
        self._status = IntegrationStatus.ERROR
        return False

    async def disconnect(self) -> bool:
        self._connected = False
        self._status = IntegrationStatus.DISCONNECTED
        return True

    async def authenticate(self, credentials: ConnectorCredentials) -> bool:
        self._credentials = credentials
        return await self.connect()

    async def refresh_auth(self) -> bool:
        return False

    async def test_connection(self) -> ConnectionTestResult:
        start = time.perf_counter()
        try:
            has_token = self._credentials and (self._credentials.access_token or self._credentials.api_key)
            if not has_token:
                return ConnectionTestResult(
                    success=False,
                    latency_ms=0,
                    message="Slack connector has no bot token configured.",
                )

            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                resp = await client.post(f"{self.endpoint}/auth.test", headers=self._get_headers())

            latency = int((time.perf_counter() - start) * 1000)
            data = resp.json()
            if data.get("ok"):
                team = data.get("team", "")
                user = data.get("user", "")
                return ConnectionTestResult(
                    success=True,
                    latency_ms=latency,
                    message=f"Connected to Slack team '{team}' as {user}",
                    server_version="Slack-Web-API",
                    details=data,
                )
            else:
                return ConnectionTestResult(
                    success=False,
                    latency_ms=latency,
                    message=f"Slack auth.test rejected: {data.get('error', 'unknown error')}",
                )
        except Exception as exc:
            latency = int((time.perf_counter() - start) * 1000)
            return ConnectionTestResult(
                success=False,
                latency_ms=latency,
                message=f"Slack network connection error: {str(exc)}",
            )

    async def list_tools(self) -> list[DiscoveredTool]:
        discovered = []
        for s in self.STANDARD_SLACK_TOOLS:
            tool = DiscoveredTool(
                tool_id=s["id"],
                integration_id="slack",
                name=s["name"],
                description=s["desc"],
                input_schema=s["schema"],
                risk_level=s["risk"],
                approval_required=s["approval"],
                enabled=True,
                state=ToolState.AVAILABLE if self.is_connected else ToolState.DISCOVERED,
            )
            self._tool_cache[s["id"]] = tool
            discovered.append(tool)
        return discovered

    async def get_tool_schema(self, tool_id: str) -> dict[str, Any]:
        if not self._tool_cache:
            await self.list_tools()
        tool = self._tool_cache.get(tool_id)
        return tool.input_schema if tool else {}

    async def execute_tool(
        self,
        tool_id: str,
        parameters: dict[str, Any],
    ) -> ToolExecutionResult:
        start = time.perf_counter()
        if not self._credentials or not (self._credentials.access_token or self._credentials.api_key):
            return ToolExecutionResult(
                success=False,
                error="Slack connector is not authenticated. Please provide token.",
                latency_ms=0,
                status="BLOCKED",
                tool_id=tool_id,
                integration_id=self.integration_id,
            )

        headers = self._get_headers()
        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                if tool_id in ("slack.read_channel", "read_channel"):
                    channel_id = parameters["channel_id"]
                    limit = parameters.get("limit", 30)
                    resp = await client.get(
                        f"{self.endpoint}/conversations.history?channel={channel_id}&limit={limit}",
                        headers=headers,
                    )
                elif tool_id in ("slack.search_messages", "search_messages"):
                    query = parameters["query"]
                    count = parameters.get("count", 20)
                    resp = await client.get(
                        f"{self.endpoint}/search.messages?query={query}&count={count}",
                        headers=headers,
                    )
                elif tool_id in ("slack.send_message", "send_message"):
                    resp = await client.post(
                        f"{self.endpoint}/chat.postMessage",
                        json={
                            "channel": parameters["channel_id"],
                            "text": parameters["text"],
                            "as_user": parameters.get("as_user", True),
                        },
                        headers=headers,
                    )
                else:
                    raise ValueError(f"Unknown Slack tool: {tool_id}")

            latency = int((time.perf_counter() - start) * 1000)
            data = resp.json()
            if not data.get("ok"):
                return ToolExecutionResult(
                    success=False,
                    error=f"Slack API error: {data.get('error', 'unknown')}",
                    latency_ms=latency,
                    status="FAILED",
                    tool_id=tool_id,
                    integration_id=self.integration_id,
                )

            return ToolExecutionResult(
                success=True,
                data=data,
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
        test = await self.test_connection()
        return ConnectorHealth(
            status=IntegrationStatus.CONNECTED if test.success else IntegrationStatus.DEGRADED,
            latency_ms=test.latency_ms,
            error_message=None if test.success else test.message,
        )
