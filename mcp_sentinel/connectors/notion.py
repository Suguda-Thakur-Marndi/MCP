"""
Notion REST API Connector for MCP Sentinel.
Connects to official Notion API at https://api.notion.com/v1.
Supports workspace page search, database querying, page metadata retrieval,
and policy-governed page archiving.
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


class NotionConnector(BaseConnector):
    """
    Official Notion REST API Connector.
    Endpoint: https://api.notion.com/v1
    """

    DEFAULT_ENDPOINT = "https://api.notion.com/v1"
    NOTION_VERSION = "2022-06-28"

    STANDARD_NOTION_TOOLS = [
        {
            "id": "notion.search_pages",
            "name": "search_pages",
            "desc": "Search pages and databases across the authorized Notion workspace.",
            "risk": RiskLevel.LOW,
            "approval": False,
            "schema": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search keyword or text snippet"},
                    "filter_value": {
                        "type": "string",
                        "enum": ["page", "database"],
                        "description": "Filter by object type",
                    },
                    "page_size": {"type": "integer", "default": 20, "maximum": 100},
                },
            },
        },
        {
            "id": "notion.get_page",
            "name": "get_page",
            "desc": "Fetch complete page metadata, properties, and parent hierarchy by page ID.",
            "risk": RiskLevel.LOW,
            "approval": False,
            "schema": {
                "type": "object",
                "required": ["page_id"],
                "properties": {
                    "page_id": {"type": "string", "description": "32-character Notion page UUID"},
                },
            },
        },
        {
            "id": "notion.query_database",
            "name": "query_database",
            "desc": "Query records and property schemas from an authorized Notion database.",
            "risk": RiskLevel.LOW,
            "approval": False,
            "schema": {
                "type": "object",
                "required": ["database_id"],
                "properties": {
                    "database_id": {
                        "type": "string",
                        "description": "32-character Notion database UUID",
                    },
                    "page_size": {"type": "integer", "default": 50, "maximum": 100},
                },
            },
        },
        {
            "id": "notion.archive_page",
            "name": "archive_page",
            "desc": "Archive or trash a Notion page. Sensitive action requiring Human-in-the-Loop approval.",
            "risk": RiskLevel.HIGH,
            "approval": True,
            "schema": {
                "type": "object",
                "required": ["page_id"],
                "properties": {
                    "page_id": {
                        "type": "string",
                        "description": "Target Notion page UUID to archive",
                    },
                    "archive": {"type": "boolean", "default": True},
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
            integration_id="notion",
            name="Notion",
            endpoint=endpoint,
            protocol_type=ProtocolType.REST_API,
            auth_type=AuthType.API_KEY,
            credentials=credentials,
        )
        self.timeout_seconds = timeout_seconds
        self._tool_cache: dict[str, DiscoveredTool] = {}

    def _get_headers(self) -> dict[str, str]:
        headers = {
            "Notion-Version": self.NOTION_VERSION,
            "Content-Type": "application/json",
            "User-Agent": "MCP-Sentinel/1.0",
        }
        if self._credentials and self._credentials.api_key:
            headers["Authorization"] = f"Bearer {self._credentials.api_key}"
        elif self._credentials and self._credentials.access_token:
            headers["Authorization"] = f"Bearer {self._credentials.access_token}"
        return headers

    async def connect(self) -> bool:
        if self._credentials and (self._credentials.api_key or self._credentials.access_token):
            res = await self.test_connection()
            self._connected = res.success
            self._status = IntegrationStatus.CONNECTED if res.success else IntegrationStatus.ERROR
            return self._connected
        self._connected = False
        self._status = IntegrationStatus.DISCONNECTED
        return False

    async def disconnect(self) -> bool:
        self._connected = False
        self._status = IntegrationStatus.DISCONNECTED
        return True

    async def authenticate(self, credentials: ConnectorCredentials) -> bool:
        self._credentials = credentials
        return await self.connect()

    async def refresh_auth(self) -> bool:
        return self._connected

    async def revoke_credentials(self) -> bool:
        self._credentials = None
        self._connected = False
        self._status = IntegrationStatus.DISCONNECTED
        return True

    async def test_connection(self) -> ConnectionTestResult:
        start = time.perf_counter()
        token = None
        if self._credentials:
            token = self._credentials.api_key or self._credentials.access_token

        if not token:
            return ConnectionTestResult(
                success=False,
                latency_ms=0,
                message="Notion connector is not configured. An API key or integration token is required.",
                details={"configured": False},
            )

        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                resp = await client.get(
                    f"{self.endpoint}/users/me",
                    headers=self._get_headers(),
                )
            latency = int((time.perf_counter() - start) * 1000)

            if resp.status_code == 200:
                user_data = resp.json()
                return ConnectionTestResult(
                    success=True,
                    latency_ms=latency,
                    message="Notion API connection verified successfully.",
                    server_version=f"Notion-API/{self.NOTION_VERSION}",
                    protocol_version="REST",
                    details={
                        "bot_id": user_data.get("id"),
                        "bot_name": user_data.get("name"),
                        "status_code": resp.status_code,
                    },
                )
            return ConnectionTestResult(
                success=False,
                latency_ms=latency,
                message=f"Notion API authentication failed with status {resp.status_code}.",
                details={"status_code": resp.status_code},
            )
        except Exception as exc:
            latency = int((time.perf_counter() - start) * 1000)
            return ConnectionTestResult(
                success=False,
                latency_ms=latency,
                message=f"Notion connection probe failed: {str(exc)}",
            )

    async def health_check(self) -> ConnectorHealth:
        result = await self.test_connection()
        if result.success:
            self._status = IntegrationStatus.CONNECTED
            return ConnectorHealth(
                status=IntegrationStatus.CONNECTED,
                latency_ms=result.latency_ms,
                message=result.message,
            )
        token = (
            self._credentials.api_key or self._credentials.access_token
            if self._credentials
            else None
        )
        status = IntegrationStatus.ERROR if token else IntegrationStatus.DISCONNECTED
        self._status = status
        return ConnectorHealth(
            status=status,
            latency_ms=result.latency_ms,
            error_message=result.message,
        )

    async def list_tools(self) -> list[DiscoveredTool]:
        discovered = []
        for s in self.STANDARD_NOTION_TOOLS:
            tool = DiscoveredTool(
                tool_id=s["id"],
                integration_id="notion",
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
        token = (
            self._credentials.api_key or self._credentials.access_token
            if self._credentials
            else None
        )
        if not token:
            return ToolExecutionResult(
                success=False,
                error="Notion connector is not authenticated. Please configure a valid Notion API key.",
                latency_ms=0,
                status="BLOCKED",
                tool_id=tool_id,
                integration_id=self.integration_id,
            )

        headers = self._get_headers()
        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                if tool_id in ("notion.search_pages", "search_pages"):
                    payload: dict[str, Any] = {
                        "page_size": min(parameters.get("page_size", 20), 100),
                    }
                    if "query" in parameters:
                        payload["query"] = parameters["query"]
                    if "filter_value" in parameters:
                        payload["filter"] = {
                            "value": parameters["filter_value"],
                            "property": "object",
                        }
                    resp = await client.post(
                        f"{self.endpoint}/search",
                        json=payload,
                        headers=headers,
                    )
                elif tool_id in ("notion.get_page", "get_page"):
                    page_id = parameters["page_id"].replace("-", "")
                    resp = await client.get(
                        f"{self.endpoint}/pages/{page_id}",
                        headers=headers,
                    )
                elif tool_id in ("notion.query_database", "query_database"):
                    database_id = parameters["database_id"].replace("-", "")
                    payload = {
                        "page_size": min(parameters.get("page_size", 50), 100),
                    }
                    resp = await client.post(
                        f"{self.endpoint}/databases/{database_id}/query",
                        json=payload,
                        headers=headers,
                    )
                elif tool_id in ("notion.archive_page", "archive_page"):
                    page_id = parameters["page_id"].replace("-", "")
                    resp = await client.patch(
                        f"{self.endpoint}/pages/{page_id}",
                        json={"archived": parameters.get("archive", True)},
                        headers=headers,
                    )
                else:
                    return ToolExecutionResult(
                        success=False,
                        error=f"Unsupported Notion tool operation: {tool_id}",
                        latency_ms=0,
                        status="FAILED",
                        tool_id=tool_id,
                        integration_id=self.integration_id,
                    )

            latency = int((time.perf_counter() - start) * 1000)
            if resp.status_code >= 400:
                err_body = (
                    resp.json()
                    if resp.headers.get("content-type", "").startswith("application/json")
                    else {}
                )
                err_msg = err_body.get("message", f"Notion API returned HTTP {resp.status_code}")
                return ToolExecutionResult(
                    success=False,
                    error=err_msg,
                    latency_ms=latency,
                    status="FAILED",
                    tool_id=tool_id,
                    integration_id=self.integration_id,
                )

            return ToolExecutionResult(
                success=True,
                data=resp.json(),
                latency_ms=latency,
                status="EXECUTED",
                tool_id=tool_id,
                integration_id=self.integration_id,
            )
        except Exception as exc:
            latency = int((time.perf_counter() - start) * 1000)
            return ToolExecutionResult(
                success=False,
                error=f"Notion request failed: {str(exc)}",
                latency_ms=latency,
                status="FAILED",
                tool_id=tool_id,
                integration_id=self.integration_id,
            )
