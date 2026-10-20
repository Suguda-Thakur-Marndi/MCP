"""
Notion REST API Connector for MCP Sentinel.
Connects to official Notion API at https://api.notion.com/v1.
Supports workspace page search, database querying, page metadata retrieval,
and policy-governed page archiving.
"""

from __future__ import annotations

import logging
import os
import re
import time
from typing import Any, Optional

import httpx

from mcp_sentinel.config.secrets import get_secret_provider
from mcp_sentinel.config.settings import get_settings
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

logger = logging.getLogger(__name__)

UUID_REGEX = re.compile(
    r"^[0-9a-fA-F]{8}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{12}$"
)


def is_valid_notion_id(val: Any) -> bool:
    """Validates that a string is a 32-character hex or 36-character hyphenated UUID."""
    if not isinstance(val, str):
        return False
    return bool(UUID_REGEX.match(val.strip()))


def normalize_notion_id(val: str) -> str:
    """Normalizes a Notion ID by removing hyphens for clean REST path interpolation."""
    return val.strip().replace("-", "")


class NotionConnector(BaseConnector):
    """
    Official Notion REST API Connector for MCP Sentinel.
    Endpoint: https://api.notion.com/v1
    Version: 2022-06-28
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
                    "query": {
                        "type": "string",
                        "description": "Search keyword or text snippet (max 500 characters)",
                    },
                    "filter_value": {
                        "type": "string",
                        "enum": ["page", "database"],
                        "description": "Filter by object type ('page' or 'database')",
                    },
                    "page_size": {
                        "type": "integer",
                        "default": 20,
                        "minimum": 1,
                        "maximum": 100,
                        "description": "Number of results to return (1-100)",
                    },
                    "start_cursor": {
                        "type": "string",
                        "description": "Pagination cursor for fetching the next page of results",
                    },
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
                    "page_id": {
                        "type": "string",
                        "description": "32-character hex or 36-character hyphenated Notion page UUID",
                    },
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
                        "description": "32-character hex or 36-character hyphenated Notion database UUID",
                    },
                    "filter": {
                        "type": "object",
                        "description": "Optional compound or property condition filter dictionary",
                    },
                    "sorts": {
                        "type": "array",
                        "items": {"type": "object"},
                        "description": "Optional list of sort ordering objects",
                    },
                    "page_size": {
                        "type": "integer",
                        "default": 50,
                        "minimum": 1,
                        "maximum": 100,
                        "description": "Maximum number of records to return (1-100)",
                    },
                    "start_cursor": {
                        "type": "string",
                        "description": "Pagination cursor for fetching subsequent database records",
                    },
                },
            },
        },
        {
            "id": "notion.archive_page",
            "name": "archive_page",
            "desc": "Archive or trash a Notion page. Sensitive action requiring Human-in-the-Loop approval and write permissions.",
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
                    "archive": {
                        "type": "boolean",
                        "default": True,
                        "description": "Set to true to archive the page, false to unarchive",
                    },
                    "approval_ticket": {
                        "type": "string",
                        "description": "Cryptographic approval ticket issued by Sentinel for page archival",
                    },
                    "reason": {
                        "type": "string",
                        "description": "Auditable justification for archiving this Notion document",
                    },
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
        self._last_test_result: Optional[ConnectionTestResult] = None
        self._workspace_info: dict[str, Any] = {}

        # Auto-resolve credentials from environment or secrets provider if not explicitly provided
        if self._credentials is None:
            self._credentials = self._resolve_credentials()

    def _resolve_credentials(self) -> Optional[ConnectorCredentials]:
        """
        Safely resolves Notion credentials from SecretProvider, Settings, or environment.
        Never hardcodes, logs, or prints the secret.
        """
        token: Optional[str] = None
        try:
            sec_provider = get_secret_provider()
            token = sec_provider.get_secret("NOTION_API_KEY") or sec_provider.get_secret(
                "NOTION_API_TOKEN"
            )
        except Exception:
            token = None

        if not token:
            try:
                settings = get_settings()
                token = settings.NOTION_API_KEY or settings.NOTION_API_TOKEN
            except Exception:
                token = None

        if not token:
            token = os.environ.get("NOTION_API_KEY") or os.environ.get("NOTION_API_TOKEN")

        if token and token.strip() and not token.strip().startswith("YOUR_"):
            return ConnectorCredentials(
                api_key=token.strip(),
                token_type="Bearer",
            )
        return None

    def is_write_enabled(self) -> bool:
        """
        Determines whether write operations (such as archiving or updating pages)
        are permitted on this Notion integration.
        Defaults to False (read-only) unless explicitly configured and verified.
        """
        try:
            settings = get_settings()
            if settings.NOTION_WRITE_ENABLED:
                return True
        except Exception:
            pass

        env_val = os.environ.get("NOTION_WRITE_ENABLED", "false").lower()
        if env_val in ("true", "1", "yes", "enabled"):
            return True

        if self._credentials and self._credentials.scopes:
            scopes = [s.lower() for s in self._credentials.scopes]
            if "write" in scopes or "update" in scopes or "full_access" in scopes:
                return True

        return False

    def _get_headers(self) -> dict[str, str]:
        headers = {
            "Notion-Version": self.NOTION_VERSION,
            "Content-Type": "application/json",
            "User-Agent": "MCP-Sentinel/1.0",
        }
        token = None
        if self._credentials:
            token = self._credentials.api_key or self._credentials.access_token

        if token:
            headers["Authorization"] = f"Bearer {token}"
        return headers

    async def connect(self) -> bool:
        if not self._credentials:
            self._credentials = self._resolve_credentials()

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
        self._workspace_info = {}
        return True

    def get_workspace_info(self) -> dict[str, Any]:
        """Returns verified workspace and bot identity for client display."""
        if self._workspace_info:
            return self._workspace_info
        if self._last_test_result and self._last_test_result.details:
            d = self._last_test_result.details
            return {
                "workspace_name": d.get("workspace_name", "Authorized Workspace"),
                "bot_name": d.get("bot_name", "MCP Sentinel"),
                "bot_id": d.get("bot_id"),
                "workspace_id": d.get("workspace_id"),
                "api_version": self.NOTION_VERSION,
            }
        return {
            "workspace_name": "Notion Workspace",
            "bot_name": "MCP Sentinel Integration",
            "api_version": self.NOTION_VERSION,
        }

    async def test_connection(self) -> ConnectionTestResult:
        """
        Executes a real probe to Notion API /v1/users/me over HTTPS.
        Never fabricates connectivity or returns a false positive.
        """
        start = time.perf_counter()
        if not self._credentials:
            self._credentials = self._resolve_credentials()

        token = None
        if self._credentials:
            token = self._credentials.api_key or self._credentials.access_token

        if not token:
            result = ConnectionTestResult(
                success=False,
                latency_ms=0,
                message="Notion connector is not configured. An API key or integration token is required.",
                details={"configured": False, "write_enabled": False},
            )
            self._last_test_result = result
            return result

        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                resp = await client.get(
                    f"{self.endpoint}/users/me",
                    headers=self._get_headers(),
                )
            latency = int((time.perf_counter() - start) * 1000)

            if resp.status_code == 200:
                user_data = resp.json()
                bot_info = user_data.get("bot", {})
                workspace_name = bot_info.get("workspace_name", "Authorized Workspace")
                bot_name = user_data.get("name", "MCP Sentinel")
                bot_id = user_data.get("id")
                write_enabled = self.is_write_enabled()

                self._connected = True
                self._status = IntegrationStatus.CONNECTED
                self._workspace_info = {
                    "workspace_name": workspace_name,
                    "bot_name": bot_name,
                    "bot_id": bot_id,
                    "workspace_id": bot_info.get("workspace_id"),
                    "workspace_icon": bot_info.get("workspace_icon"),
                    "api_version": self.NOTION_VERSION,
                }

                result = ConnectionTestResult(
                    success=True,
                    latency_ms=latency,
                    message=f"Notion API connection verified successfully (Workspace: {workspace_name}, Bot: {bot_name}).",
                    server_version=f"Notion-API/{self.NOTION_VERSION}",
                    protocol_version="REST",
                    details={
                        "bot_id": bot_id,
                        "bot_name": bot_name,
                        "workspace_name": workspace_name,
                        "workspace_id": bot_info.get("workspace_id"),
                        "write_enabled": write_enabled,
                        "configured": True,
                        "status_code": resp.status_code,
                    },
                )
                self._last_test_result = result
                return result

            latency = int((time.perf_counter() - start) * 1000)
            err_msg = "Notion API authentication failed."
            if resp.status_code == 401:
                err_msg = "Notion authentication failed: invalid or revoked token."
            elif resp.status_code == 403:
                err_msg = "Notion authentication failed: insufficient integration permissions."

            result = ConnectionTestResult(
                success=False,
                latency_ms=latency,
                message=f"{err_msg} (HTTP {resp.status_code})",
                details={
                    "status_code": resp.status_code,
                    "configured": True,
                    "write_enabled": False,
                },
            )
            self._last_test_result = result
            return result
        except httpx.TimeoutException:
            latency = int((time.perf_counter() - start) * 1000)
            result = ConnectionTestResult(
                success=False,
                latency_ms=latency,
                message=f"Notion connection probe timed out after {self.timeout_seconds} seconds.",
                details={"error": "TIMEOUT", "configured": True},
            )
            self._last_test_result = result
            return result
        except Exception as exc:
            latency = int((time.perf_counter() - start) * 1000)
            result = ConnectionTestResult(
                success=False,
                latency_ms=latency,
                message=f"Notion connection probe failed: {str(exc)}",
                details={"configured": True},
            )
            self._last_test_result = result
            return result

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
        """
        Discovers tools and accurately sets their enabled state based on
        connectivity and capability gates.
        The archive_page tool is marked disabled unless write permission is enabled.
        """
        write_ok = self.is_write_enabled()
        discovered = []

        for s in self.STANDARD_NOTION_TOOLS:
            is_write_tool = s["id"] == "notion.archive_page"
            tool_enabled = (not is_write_tool) or write_ok

            if not tool_enabled:
                tool_state = ToolState.DISCOVERED
            elif self.is_connected:
                tool_state = ToolState.AVAILABLE
            else:
                tool_state = ToolState.DISCOVERED

            tool = DiscoveredTool(
                tool_id=s["id"],
                integration_id="notion",
                name=s["name"],
                description=s["desc"],
                input_schema=s["schema"],
                risk_level=s["risk"],
                approval_required=s["approval"],
                enabled=tool_enabled,
                state=tool_state,
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
        """
        Executes a Notion operation with strict input validation,
        capability checks, and sanitized structured responses.
        Input validation is performed before credential checks (defense-in-depth).
        """
        start = time.perf_counter()

        # -----------------------------------------------------------------
        # Pre-authentication input validation (defense-in-depth).
        # Reject structurally invalid inputs before any credential access.
        # -----------------------------------------------------------------
        if tool_id in ("notion.get_page", "get_page"):
            page_id = parameters.get("page_id")
            if not page_id or not is_valid_notion_id(page_id):
                return ToolExecutionResult(
                    success=False,
                    error=(
                        f"Invalid or missing page_id: '{page_id}'. "
                        "Must be a valid 32-character hex or 36-character hyphenated UUID."
                    ),
                    latency_ms=0,
                    status="FAILED",
                    tool_id=tool_id,
                    integration_id=self.integration_id,
                )

        if tool_id in ("notion.query_database", "query_database"):
            database_id = parameters.get("database_id")
            if not database_id or not is_valid_notion_id(database_id):
                return ToolExecutionResult(
                    success=False,
                    error=(
                        f"Invalid or missing database_id: '{database_id}'. "
                        "Must be a valid 32-character hex or 36-character hyphenated UUID."
                    ),
                    latency_ms=0,
                    status="FAILED",
                    tool_id=tool_id,
                    integration_id=self.integration_id,
                )

        if not self._credentials:
            self._credentials = self._resolve_credentials()

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
                # -----------------------------------------------------------------
                # Tool 1: search_pages
                # -----------------------------------------------------------------
                if tool_id in ("notion.search_pages", "search_pages"):
                    # Validate parameters
                    raw_page_size = parameters.get("page_size", 20)
                    try:
                        page_size = max(1, min(int(raw_page_size), 100))
                    except (ValueError, TypeError):
                        page_size = 20

                    filter_val = parameters.get("filter_value") or parameters.get("filter_type")
                    if filter_val and filter_val not in ("page", "database"):
                        return ToolExecutionResult(
                            success=False,
                            error=f"Invalid filter '{filter_val}'. Must be 'page' or 'database'.",
                            latency_ms=0,
                            status="FAILED",
                            tool_id=tool_id,
                            integration_id=self.integration_id,
                        )

                    payload: dict[str, Any] = {"page_size": page_size}

                    query = parameters.get("query")
                    if query is not None and isinstance(query, str):
                        payload["query"] = query.strip()[:500]

                    if filter_val:
                        payload["filter"] = {"value": filter_val, "property": "object"}

                    start_cursor = parameters.get("start_cursor")
                    if start_cursor and isinstance(start_cursor, str):
                        payload["start_cursor"] = start_cursor.strip()

                    resp = await client.post(
                        f"{self.endpoint}/search",
                        json=payload,
                        headers=headers,
                    )

                # -----------------------------------------------------------------
                # Tool 2: get_page (UUID already validated above pre-auth)
                # -----------------------------------------------------------------
                elif tool_id in ("notion.get_page", "get_page"):
                    page_id = parameters.get("page_id")  # guaranteed valid UUID by pre-auth check
                    clean_page_id = normalize_notion_id(page_id)
                    resp = await client.get(
                        f"{self.endpoint}/pages/{clean_page_id}",
                        headers=headers,
                    )

                # -----------------------------------------------------------------
                # Tool 3: query_database (UUID already validated above pre-auth)
                # -----------------------------------------------------------------
                elif tool_id in ("notion.query_database", "query_database"):
                    database_id = parameters.get("database_id")  # guaranteed valid UUID by pre-auth check
                    clean_db_id = normalize_notion_id(database_id)

                    raw_page_size = parameters.get("page_size", 50)
                    try:
                        page_size = max(1, min(int(raw_page_size), 100))
                    except (ValueError, TypeError):
                        page_size = 50

                    payload = {"page_size": page_size}

                    db_filter = parameters.get("filter")
                    if db_filter and isinstance(db_filter, dict):
                        payload["filter"] = db_filter

                    sorts = parameters.get("sorts")
                    if sorts and isinstance(sorts, list):
                        payload["sorts"] = sorts

                    start_cursor = parameters.get("start_cursor")
                    if start_cursor and isinstance(start_cursor, str):
                        payload["start_cursor"] = start_cursor.strip()

                    resp = await client.post(
                        f"{self.endpoint}/databases/{clean_db_id}/query",
                        json=payload,
                        headers=headers,
                    )

                # -----------------------------------------------------------------
                # Tool 4: archive_page
                # -----------------------------------------------------------------
                elif tool_id in ("notion.archive_page", "archive_page"):
                    # Gate 1: Check write permission capability
                    if not self.is_write_enabled():
                        return ToolExecutionResult(
                            success=False,
                            error=(
                                "Notion write permission is not enabled. The integration is configured for "
                                "read-only access. To enable write operations, verify update capabilities "
                                "in the Notion integration configuration and set NOTION_WRITE_ENABLED=true."
                            ),
                            latency_ms=0,
                            status="BLOCKED",
                            tool_id=tool_id,
                            integration_id=self.integration_id,
                        )

                    page_id = parameters.get("page_id")
                    if not page_id or not is_valid_notion_id(page_id):
                        return ToolExecutionResult(
                            success=False,
                            error=(
                                f"Invalid or missing page_id: '{page_id}'. "
                                "Must be a valid 32-character hex or 36-character hyphenated UUID."
                            ),
                            latency_ms=0,
                            status="FAILED",
                            tool_id=tool_id,
                            integration_id=self.integration_id,
                        )

                    clean_page_id = normalize_notion_id(page_id)
                    archive_val = parameters.get("archive", True)
                    if not isinstance(archive_val, bool):
                        archive_val = True

                    resp = await client.patch(
                        f"{self.endpoint}/pages/{clean_page_id}",
                        json={"archived": archive_val},
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

            # Handle Notion API error status codes safely
            if resp.status_code >= 400:
                err_body = (
                    resp.json()
                    if resp.headers.get("content-type", "").startswith("application/json")
                    else {}
                )
                raw_msg = err_body.get("message", "")

                if resp.status_code == 404:
                    err_msg = (
                        f"Notion resource not found or not shared with MCP Sentinel: {raw_msg}"
                        if raw_msg
                        else "Resource not found. Please ensure the target page or database is shared with the integration."
                    )
                elif resp.status_code == 401:
                    err_msg = (
                        "Notion API authentication failed: invalid or expired integration token."
                    )
                elif resp.status_code == 403:
                    err_msg = (
                        f"Notion API access forbidden: {raw_msg}"
                        if raw_msg
                        else "Access forbidden by Notion workspace policy."
                    )
                elif resp.status_code == 429:
                    err_msg = "Notion API rate limit exceeded. Please back off and retry."
                else:
                    err_msg = raw_msg or f"Notion API returned HTTP {resp.status_code}"

                return ToolExecutionResult(
                    success=False,
                    error=err_msg,
                    latency_ms=latency,
                    status="FAILED",
                    tool_id=tool_id,
                    integration_id=self.integration_id,
                )

            # Format clean, structured output
            raw_data = resp.json()
            structured_data = self._format_tool_response(tool_id, raw_data)

            return ToolExecutionResult(
                success=True,
                data=structured_data,
                latency_ms=latency,
                status="EXECUTED",
                tool_id=tool_id,
                integration_id=self.integration_id,
            )

        except httpx.TimeoutException:
            latency = int((time.perf_counter() - start) * 1000)
            return ToolExecutionResult(
                success=False,
                error=f"Notion request timed out after {self.timeout_seconds}s.",
                latency_ms=latency,
                status="FAILED",
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

    def _format_tool_response(self, tool_id: str, data: dict[str, Any]) -> dict[str, Any]:
        """Formats and sanitizes Notion REST responses into consistent, safe structures."""
        if tool_id in ("notion.search_pages", "search_pages"):
            raw_results = data.get("results", [])
            sanitized_results = []
            for item in raw_results:
                title = self._extract_title(item)
                sanitized_results.append(
                    {
                        "id": item.get("id"),
                        "object": item.get("object"),
                        "title": title,
                        "url": item.get("url"),
                        "created_time": item.get("created_time"),
                        "last_edited_time": item.get("last_edited_time"),
                        "archived": item.get("archived", False),
                        "parent": item.get("parent"),
                    }
                )
            return {
                "status": "success",
                "results": sanitized_results,
                "has_more": data.get("has_more", False),
                "next_cursor": data.get("next_cursor"),
                "total_results": len(sanitized_results),
                "count": len(sanitized_results),
            }

        elif tool_id in ("notion.get_page", "get_page"):
            return {
                "status": "success",
                "id": data.get("id"),
                "object": data.get("object", "page"),
                "title": self._extract_title(data),
                "url": data.get("url"),
                "created_time": data.get("created_time"),
                "last_edited_time": data.get("last_edited_time"),
                "archived": data.get("archived", False),
                "parent": data.get("parent"),
                "properties": data.get("properties", {}),
                "icon": data.get("icon"),
                "cover": data.get("cover"),
            }

        elif tool_id in ("notion.query_database", "query_database"):
            raw_results = data.get("results", [])
            sanitized_results = []
            for item in raw_results:
                sanitized_results.append(
                    {
                        "id": item.get("id"),
                        "title": self._extract_title(item),
                        "url": item.get("url"),
                        "created_time": item.get("created_time"),
                        "last_edited_time": item.get("last_edited_time"),
                        "archived": item.get("archived", False),
                        "properties": item.get("properties", {}),
                    }
                )
            return {
                "status": "success",
                "results": sanitized_results,
                "has_more": data.get("has_more", False),
                "next_cursor": data.get("next_cursor"),
                "total_records": len(sanitized_results),
                "count": len(sanitized_results),
            }

        elif tool_id in ("notion.archive_page", "archive_page"):
            return {
                "status": "success",
                "id": data.get("id"),
                "archived": data.get("archived", True),
                "title": self._extract_title(data),
                "url": data.get("url"),
                "last_edited_time": data.get("last_edited_time"),
            }

        return data

    @staticmethod
    def _extract_title(item: dict[str, Any]) -> str:
        """Safely extracts the human-readable plain text title from a page or database."""
        # For database objects: title is a top-level list
        if item.get("object") == "database" and isinstance(item.get("title"), list):
            titles = [t.get("plain_text", "") for t in item["title"] if isinstance(t, dict)]
            if titles:
                return "".join(titles)

        # For page objects: title is in properties under a title property
        props = item.get("properties", {})
        if isinstance(props, dict):
            for prop in props.values():
                if isinstance(prop, dict) and prop.get("type") == "title":
                    title_list = prop.get("title", [])
                    if isinstance(title_list, list):
                        parts = [t.get("plain_text", "") for t in title_list if isinstance(t, dict)]
                        if parts:
                            return "".join(parts)
        return "Untitled"

    async def search_pages(
        self,
        query: str = "",
        filter_type: Optional[str] = None,
        page_size: int = 50,
        start_cursor: Optional[str] = None,
    ) -> dict[str, Any]:
        """Convenience method to execute search_pages tool."""
        res = await self.execute_tool(
            "search_pages",
            {
                "query": query,
                "filter_type": filter_type,
                "page_size": page_size,
                "start_cursor": start_cursor,
            },
        )
        if res.success and isinstance(res.data, dict):
            return res.data
        return {
            "status": "error" if not res.success else "success",
            "message": res.error or "Operation completed",
            "count": 0,
            "results": [],
        }

    async def get_page(self, page_id: str) -> dict[str, Any]:
        """Convenience method to execute get_page tool."""
        res = await self.execute_tool("get_page", {"page_id": page_id})
        if res.success and isinstance(res.data, dict):
            return res.data
        return {
            "status": "error",
            "message": res.error or "Failed to retrieve page",
            "page_id": page_id,
        }

    async def query_database(
        self,
        database_id: str,
        filter: Optional[dict[str, Any]] = None,
        sorts: Optional[list[dict[str, Any]]] = None,
        page_size: int = 50,
        start_cursor: Optional[str] = None,
    ) -> dict[str, Any]:
        """Convenience method to execute query_database tool."""
        res = await self.execute_tool(
            "query_database",
            {
                "database_id": database_id,
                "filter": filter,
                "sorts": sorts,
                "page_size": page_size,
                "start_cursor": start_cursor,
            },
        )
        if res.success and isinstance(res.data, dict):
            return res.data
        return {
            "status": "error",
            "message": res.error or "Failed to query database",
            "database_id": database_id,
            "results": [],
            "count": 0,
        }

    async def archive_page(
        self,
        page_id: str,
        archive: bool = True,
        approval_ticket: Optional[str] = None,
        reason: Optional[str] = None,
    ) -> dict[str, Any]:
        """Convenience method to execute archive_page tool."""
        res = await self.execute_tool(
            "archive_page",
            {
                "page_id": page_id,
                "archive": archive,
                "approval_ticket": approval_ticket,
                "reason": reason,
            },
        )
        if res.success and isinstance(res.data, dict):
            return res.data
        return {
            "status": res.status.lower() if res.status else "error",
            "message": res.error or "Operation blocked or failed",
            "page_id": page_id,
        }
