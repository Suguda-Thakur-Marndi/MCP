"""
Google Drive Connector for MCP Sentinel.
Connects to Google Drive v3 REST API (https://www.googleapis.com/drive/v3).
Governs enterprise file queries, sharing permissions, and destructive deletions.
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


class GoogleDriveConnector(BaseConnector):
    """
    Official Google Drive REST API Connector.
    Endpoint: https://www.googleapis.com/drive/v3
    """

    DEFAULT_ENDPOINT = "https://www.googleapis.com/drive/v3"

    STANDARD_DRIVE_TOOLS = [
        {
            "id": "google_drive.search_files",
            "name": "search_files",
            "desc": "Search Google Drive files, folders, and shared documents.",
            "risk": RiskLevel.LOW,
            "approval": False,
            "schema": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query expression (q parameter)"},
                    "page_size": {"type": "integer", "default": 20, "maximum": 100},
                },
            },
        },
        {
            "id": "google_drive.get_file_metadata",
            "name": "get_file_metadata",
            "desc": "Fetch complete metadata, owners, permissions, and size for a file ID.",
            "risk": RiskLevel.LOW,
            "approval": False,
            "schema": {
                "type": "object",
                "required": ["file_id"],
                "properties": {
                    "file_id": {"type": "string", "description": "Google Drive File ID"},
                },
            },
        },
        {
            "id": "google_drive.create_folder",
            "name": "create_folder",
            "desc": "Create a new organizational folder in Google Drive.",
            "risk": RiskLevel.MEDIUM,
            "approval": False,
            "schema": {
                "type": "object",
                "required": ["name"],
                "properties": {
                    "name": {"type": "string", "description": "Folder name"},
                    "parent_id": {"type": "string", "description": "Optional parent folder ID"},
                },
            },
        },
        {
            "id": "google_drive.delete_file",
            "name": "delete_file",
            "desc": "Permanently delete a file or document from Google Drive. Critical action requiring human approval.",
            "risk": RiskLevel.CRITICAL,
            "approval": True,
            "schema": {
                "type": "object",
                "required": ["file_id", "reason"],
                "properties": {
                    "file_id": {"type": "string"},
                    "reason": {"type": "string", "minLength": 5},
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
            integration_id="google_drive",
            name="Google Drive",
            endpoint=endpoint,
            protocol_type=ProtocolType.REST_API,
            auth_type=AuthType.OAUTH2,
            credentials=credentials,
        )
        self.timeout_seconds = timeout_seconds
        self._tool_cache: dict[str, DiscoveredTool] = {}

    def _get_headers(self) -> dict[str, str]:
        headers = {
            "Accept": "application/json",
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
                    message="Google Drive connector has no OAuth access token.",
                )

            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                resp = await client.get(f"{self.endpoint}/about?fields=user,storageQuota", headers=self._get_headers())
            
            latency = int((time.perf_counter() - start) * 1000)
            if resp.status_code == 200:
                data = resp.json()
                user = data.get("user", {}).get("displayName", "authenticated user")
                return ConnectionTestResult(
                    success=True,
                    latency_ms=latency,
                    message=f"Connected to Google Drive as {user}",
                    server_version="Google-Drive-v3",
                    details=data,
                )
            else:
                return ConnectionTestResult(
                    success=False,
                    latency_ms=latency,
                    message=f"Google Drive API returned HTTP {resp.status_code}",
                )
        except Exception as exc:
            latency = int((time.perf_counter() - start) * 1000)
            return ConnectionTestResult(
                success=False,
                latency_ms=latency,
                message=f"Google Drive network error: {str(exc)}",
            )

    async def list_tools(self) -> list[DiscoveredTool]:
        discovered = []
        for s in self.STANDARD_DRIVE_TOOLS:
            tool = DiscoveredTool(
                tool_id=s["id"],
                integration_id="google_drive",
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
                error="Google Drive connector is not authenticated.",
                latency_ms=0,
                status="BLOCKED",
                tool_id=tool_id,
                integration_id=self.integration_id,
            )

        headers = self._get_headers()
        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                if tool_id in ("google_drive.search_files", "search_files"):
                    q = parameters.get("query", "")
                    page_size = parameters.get("page_size", 20)
                    url = f"{self.endpoint}/files?pageSize={page_size}"
                    if q:
                        url += f"&q={httpx.QueryParams({'q': q})}"
                    resp = await client.get(url, headers=headers)
                elif tool_id in ("google_drive.get_file_metadata", "get_file_metadata"):
                    file_id = parameters["file_id"]
                    resp = await client.get(f"{self.endpoint}/files/{file_id}?fields=*", headers=headers)
                elif tool_id in ("google_drive.create_folder", "create_folder"):
                    body = {
                        "name": parameters["name"],
                        "mimeType": "application/vnd.google-apps.folder",
                    }
                    if "parent_id" in parameters:
                        body["parents"] = [parameters["parent_id"]]
                    resp = await client.post(f"{self.endpoint}/files", json=body, headers=headers)
                elif tool_id in ("google_drive.delete_file", "delete_file"):
                    file_id = parameters["file_id"]
                    resp = await client.delete(f"{self.endpoint}/files/{file_id}", headers=headers)
                else:
                    raise ValueError(f"Unknown Google Drive tool: {tool_id}")

            latency = int((time.perf_counter() - start) * 1000)
            if resp.status_code >= 400:
                return ToolExecutionResult(
                    success=False,
                    error=f"Google Drive HTTP {resp.status_code}: {resp.text}",
                    latency_ms=latency,
                    status="FAILED",
                    tool_id=tool_id,
                    integration_id=self.integration_id,
                )

            data = resp.json() if resp.text and resp.status_code != 204 else {"deleted": True}
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
