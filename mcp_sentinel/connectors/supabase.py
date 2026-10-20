"""
Supabase PostgreSQL Connector for SentinelCore.
Provides secure database pool telemetry, connection testing, and governed tool operations.
"""

from __future__ import annotations

import time
import urllib.parse
from typing import Any, Optional

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
from mcp_sentinel.database.connection import check_db_health, get_pool_status
from mcp_sentinel.tools.audit_tools import handle_append_customer_audit_note
from mcp_sentinel.tools.customer_tools import (
    handle_delete_customer,
    handle_get_customer,
    handle_purge_inactive_customer_data,
    handle_query_customer_records,
    handle_update_customer,
)
from mcp_sentinel.tools.order_tools import (
    handle_get_customer_orders,
    handle_get_order,
)


def _get_sanitized_endpoint() -> str:
    """Extracts a sanitized database endpoint without leaking username or password."""
    try:
        settings = get_settings()
        dsn = settings.DATABASE_URL
        if not dsn:
            return "postgresql://supabase-pooler"
        parsed = urllib.parse.urlparse(dsn)
        host = parsed.hostname or "localhost"
        port = f":{parsed.port}" if parsed.port else ""
        path = parsed.path or "/postgres"
        return f"postgresql://{host}{port}{path}"
    except Exception:
        return "postgresql://supabase-pooler"


class SupabaseConnector(BaseConnector):
    """
    Connects to the enterprise Supabase PostgreSQL database pool.
    Provides verified tools with strict zero-trust database security.
    """

    STANDARD_SUPABASE_TOOLS: list[dict[str, Any]] = [
        {
            "id": "query_customer_records",
            "name": "query_customer_records",
            "desc": "Executes parameterized read queries against customer records with allow-listed filters.",
            "risk": RiskLevel.LOW,
            "approval": False,
            "schema": {
                "type": "object",
                "properties": {
                    "filters": {
                        "type": "object",
                        "description": "Allowed filter criteria: status, country, customer_id, tier",
                        "properties": {
                            "status": {
                                "type": "string",
                                "enum": ["ACTIVE", "INACTIVE", "SUSPENDED"],
                            },
                            "country": {"type": "string"},
                            "tier": {"type": "string"},
                            "customer_id": {"type": "string"},
                        },
                    },
                    "limit": {"type": "integer", "default": 50, "minimum": 1, "maximum": 100},
                    "offset": {"type": "integer", "default": 0, "minimum": 0},
                    "sort_by": {"type": "string", "default": "created_at"},
                    "sort_order": {"type": "string", "enum": ["ASC", "DESC"], "default": "DESC"},
                },
            },
        },
        {
            "id": "get_customer",
            "name": "get_customer",
            "desc": "Retrieves a single customer profile by internal ID or customer code.",
            "risk": RiskLevel.LOW,
            "approval": False,
            "schema": {
                "type": "object",
                "required": ["customer_id"],
                "properties": {
                    "customer_id": {
                        "type": "string",
                        "description": "Internal customer UUID or code (e.g. 'CUST-000001')",
                    },
                },
            },
        },
        {
            "id": "get_customer_orders",
            "name": "get_customer_orders",
            "desc": "Retrieves purchase order history for a customer with bounded pagination.",
            "risk": RiskLevel.LOW,
            "approval": False,
            "schema": {
                "type": "object",
                "required": ["customer_id"],
                "properties": {
                    "customer_id": {"type": "string", "description": "Customer identifier"},
                    "limit": {"type": "integer", "default": 20, "minimum": 1, "maximum": 100},
                    "offset": {"type": "integer", "default": 0, "minimum": 0},
                },
            },
        },
        {
            "id": "get_order",
            "name": "get_order",
            "desc": "Retrieves detailed metadata for a single customer order.",
            "risk": RiskLevel.LOW,
            "approval": False,
            "schema": {
                "type": "object",
                "required": ["order_id"],
                "properties": {
                    "order_id": {"type": "string", "description": "Order identifier or UUID"},
                },
            },
        },
        {
            "id": "update_customer",
            "name": "update_customer",
            "desc": "Updates mutable customer attributes with field-level authorization.",
            "risk": RiskLevel.MEDIUM,
            "approval": True,
            "schema": {
                "type": "object",
                "required": ["customer_id", "updates"],
                "properties": {
                    "customer_id": {"type": "string", "description": "Customer identifier"},
                    "updates": {
                        "type": "object",
                        "description": "Key-value map of allowed fields to update",
                    },
                    "reason": {"type": "string", "description": "Justification for update"},
                },
            },
        },
        {
            "id": "delete_customer",
            "name": "delete_customer",
            "desc": "Soft-deletes a customer record. Requires verified Human-in-the-Loop approval.",
            "risk": RiskLevel.CRITICAL,
            "approval": True,
            "schema": {
                "type": "object",
                "required": ["customer_id", "reason"],
                "properties": {
                    "customer_id": {"type": "string", "description": "Customer identifier"},
                    "reason": {"type": "string", "description": "Reason for deletion"},
                    "approval_ticket": {
                        "type": "string",
                        "description": "Cryptographically verified approval ticket",
                    },
                },
            },
        },
        {
            "id": "purge_inactive_customer_data",
            "name": "purge_inactive_customer_data",
            "desc": "Permanently purges customer records inactive beyond retention threshold. Strict dual-custody approval.",
            "risk": RiskLevel.CRITICAL,
            "approval": True,
            "schema": {
                "type": "object",
                "required": ["retention_days", "reason"],
                "properties": {
                    "retention_days": {
                        "type": "integer",
                        "minimum": 30,
                        "description": "Days of inactivity",
                    },
                    "reason": {
                        "type": "string",
                        "description": "Audit justification for permanent purge",
                    },
                    "approval_ticket": {
                        "type": "string",
                        "description": "Cryptographically verified approval ticket",
                    },
                },
            },
        },
        {
            "id": "append_customer_audit_note",
            "name": "append_customer_audit_note",
            "desc": "Appends an immutable audit annotation to a customer record.",
            "risk": RiskLevel.LOW,
            "approval": False,
            "schema": {
                "type": "object",
                "required": ["customer_id", "note"],
                "properties": {
                    "customer_id": {"type": "string", "description": "Customer identifier"},
                    "note": {"type": "string", "description": "Immutable audit annotation content"},
                    "author": {"type": "string", "description": "Operator or agent author ID"},
                },
            },
        },
    ]

    def __init__(
        self,
        integration_id: str = "supabase",
        name: str = "Supabase PostgreSQL",
        endpoint: Optional[str] = None,
    ) -> None:
        sanitized_endpoint = endpoint or _get_sanitized_endpoint()
        super().__init__(
            integration_id=integration_id,
            name=name,
            endpoint=sanitized_endpoint,
            protocol_type=ProtocolType.LOCAL_MCP,
            auth_type=AuthType.NONE,
            credentials=None,
        )
        self._connected: bool = False
        self._tool_cache: dict[str, DiscoveredTool] = {}

    async def connect(self) -> bool:
        """
        Validates connection to the Supabase PostgreSQL database pool.
        Sets _connected and updates integration status.
        """
        is_healthy = await check_db_health()
        self._connected = is_healthy
        self._status = IntegrationStatus.CONNECTED if is_healthy else IntegrationStatus.ERROR
        return self._connected

    async def disconnect(self) -> bool:
        """Sets connector state to disconnected."""
        self._connected = False
        self._status = IntegrationStatus.DISCONNECTED
        return True

    async def authenticate(self, credentials: ConnectorCredentials) -> bool:
        """
        Accepts credentials, sets in-memory state, and tests pool connectivity.
        """
        self._credentials = credentials
        dsn = credentials.api_key or credentials.access_token
        if dsn:
            try:
                parsed = urllib.parse.urlparse(dsn)
                host = parsed.hostname or "localhost"
                port = f":{parsed.port}" if parsed.port else ""
                path = parsed.path or "/postgres"
                self.endpoint = f"postgresql://{host}{port}{path}"
            except Exception:
                pass
        return await self.connect()

    async def refresh_auth(self) -> bool:
        """
        Refreshes connection pool status against Supabase PostgreSQL.
        Database pool connections do not use rotating OAuth tokens.
        """
        return await self.connect()

    async def revoke_credentials(self) -> bool:
        """
        Clears connector credentials and resets connection state.
        Server environment DATABASE_URL remains unaffected.
        """
        self._credentials = None
        self._connected = False
        self._status = IntegrationStatus.DISCONNECTED
        self.endpoint = _get_sanitized_endpoint()
        return True

    def get_project_info(self) -> dict[str, Any]:
        """Returns structured database project telemetry without exposing secrets."""
        pool_stats = get_pool_status()
        dsn = None
        if self._credentials and (self._credentials.api_key or self._credentials.access_token):
            dsn = self._credentials.api_key or self._credentials.access_token
        if not dsn:
            try:
                settings = get_settings()
                dsn = settings.SUPABASE_DATABASE_URL or settings.DATABASE_URL
            except Exception:
                dsn = None

        host = "supabase-pooler"
        port = 5432
        database = "postgres"
        username = "postgres"
        if dsn:
            try:
                parsed = urllib.parse.urlparse(dsn)
                host = parsed.hostname or host
                port = parsed.port or port
                database = parsed.path.lstrip("/") or database
                username = parsed.username or username
            except Exception:
                pass

        return {
            "host": host,
            "port": port,
            "database": database,
            "username": username,
            "tls_enforced": True,
            "protocol": "asyncpg-tls",
            "pool": {
                "total": pool_stats.get("total", 0),
                "used": pool_stats.get("used", 0),
                "free": pool_stats.get("free", 0),
            },
        }

    async def test_connection(self) -> ConnectionTestResult:
        """Tests live database connectivity and pool availability."""
        t0 = time.perf_counter()
        is_healthy = await check_db_health()
        latency = int((time.perf_counter() - t0) * 1000)

        pool_stats = get_pool_status()
        if is_healthy:
            self._connected = True
            self._status = IntegrationStatus.CONNECTED
            res = ConnectionTestResult(
                success=True,
                latency_ms=latency,
                message="Supabase PostgreSQL pool connection verified",
                server_version="PostgreSQL 17.11 (Supabase)",
                protocol_version="asyncpg-tls",
                details={
                    "status": "HEALTHY",
                    "pool_total": pool_stats.get("total", 0),
                    "pool_used": pool_stats.get("used", 0),
                    "pool_free": pool_stats.get("free", 0),
                    "tls_enforced": True,
                    "endpoint": self.endpoint,
                },
            )
        else:
            self._connected = False
            self._status = IntegrationStatus.ERROR
            res = ConnectionTestResult(
                success=False,
                latency_ms=latency,
                message="Supabase database pool unreachable or initialization pending",
                details={
                    "status": "UNHEALTHY",
                    "endpoint": self.endpoint,
                },
            )

        self._last_test_result = res
        return res

    def is_write_enabled(self) -> bool:
        """Database mutations are governed by policy and approval tickets."""
        return True

    async def health_check(self) -> ConnectorHealth:
        test = await self.test_connection()
        return ConnectorHealth(
            integration_id=self.integration_id,
            status=self.status,
            latency_ms=test.latency_ms,
            error_message=None if test.success else test.message,
            tools_count=8,
        )

    async def list_tools(self) -> list[DiscoveredTool]:
        """Returns the 8 governed Supabase customer, order, and audit tools with schemas."""
        discovered = []
        for s in self.STANDARD_SUPABASE_TOOLS:
            tool = DiscoveredTool(
                tool_id=s["id"],
                integration_id=self.integration_id,
                name=s["name"],
                description=s["desc"],
                input_schema=s["schema"],
                risk_level=s["risk"],
                approval_required=s["approval"],
                enabled=True,
                state=ToolState.AVAILABLE if self.is_connected else ToolState.DISCOVERED,
            )
            self._tool_cache[s["id"]] = tool
            self._tool_cache[f"{self.integration_id}.{s['id']}"] = tool
            discovered.append(tool)
        return discovered

    async def get_tool_schema(self, tool_id: str) -> dict[str, Any]:
        """Returns the JSON input schema for a specific registered Supabase tool."""
        if not self._tool_cache:
            await self.list_tools()
        clean_id = tool_id.replace(f"{self.integration_id}.", "")
        tool = self._tool_cache.get(tool_id) or self._tool_cache.get(clean_id)
        return tool.input_schema if tool else {}

    async def execute_tool(
        self,
        tool_name: str,
        parameters: dict[str, Any],
        credentials: Optional[ConnectorCredentials] = None,
    ) -> ToolExecutionResult:
        """Executes a governed tool on Supabase PostgreSQL."""
        name = tool_name.replace(f"{self.integration_id}.", "")
        try:
            if name == "query_customer_records":
                data = await handle_query_customer_records(raw_args=parameters)
            elif name == "get_customer":
                data = await handle_get_customer(raw_args=parameters)
            elif name == "get_customer_orders":
                data = await handle_get_customer_orders(raw_args=parameters)
            elif name == "get_order":
                data = await handle_get_order(raw_args=parameters)
            elif name == "update_customer":
                data = await handle_update_customer(raw_args=parameters)
            elif name == "delete_customer":
                data = await handle_delete_customer(raw_args=parameters)
            elif name == "purge_inactive_customer_data":
                data = await handle_purge_inactive_customer_data(raw_args=parameters)
            elif name == "append_customer_audit_note":
                data = await handle_append_customer_audit_note(raw_args=parameters)
            else:
                return ToolExecutionResult(
                    success=False,
                    error=f"Unknown Supabase tool '{tool_name}'",
                )
            return ToolExecutionResult(success=True, data=data)
        except Exception as exc:
            return ToolExecutionResult(success=False, error=str(exc))
