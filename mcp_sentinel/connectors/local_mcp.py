"""
Local FastMCP Server Connector for MCP Sentinel.
Wraps the internal FastMCP server (PostgreSQL customer, order, and audit tools)
into the unified BaseConnector lifecycle interface.
"""

from __future__ import annotations

import time
from typing import Any

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
from mcp_sentinel.database.connection import get_db_pool
from mcp_sentinel.services.audit_service import AuditService
from mcp_sentinel.services.customer_service import CustomerService
from mcp_sentinel.services.order_service import OrderService
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


class LocalMcpConnector(BaseConnector):
    """
    Connects to the internal PostgreSQL FastMCP server.
    Provides verified tools with strict zero-trust database security.
    """

    def __init__(
        self,
        integration_id: str = "custom_mcp",
        name: str = "Custom MCP PostgreSQL",
        endpoint: str = "internal://postgres-fastmcp",
    ) -> None:
        super().__init__(
            integration_id=integration_id,
            name=name,
            endpoint=endpoint,
            protocol_type=ProtocolType.LOCAL_MCP,
            auth_type=AuthType.NONE,
            credentials=None,
        )
        self._connected = True
        self._status = IntegrationStatus.CONNECTED
        self._tool_cache: dict[str, DiscoveredTool] = {}
        self._init_tools()

    def _init_tools(self) -> None:
        raw_specs = [
            {
                "id": "custom_mcp.query_customer_records",
                "name": "query_customer_records",
                "desc": "Search and filter enterprise customer records with strict pagination and field minimization.",
                "risk": RiskLevel.LOW,
                "approval": False,
                "schema": {
                    "type": "object",
                    "properties": {
                        "filter": {"type": "object", "description": "Search criteria (status, search, email)"},
                        "limit": {"type": "integer", "default": 50},
                        "offset": {"type": "integer", "default": 0},
                    },
                },
            },
            {
                "id": "custom_mcp.get_customer",
                "name": "get_customer",
                "desc": "Fetch complete verified customer profile by immutable UUID.",
                "risk": RiskLevel.LOW,
                "approval": False,
                "schema": {
                    "type": "object",
                    "required": ["customer_id"],
                    "properties": {"customer_id": {"type": "string", "format": "uuid"}},
                },
            },
            {
                "id": "custom_mcp.update_customer",
                "name": "update_customer",
                "desc": "Update customer non-PII attributes with server-side validation.",
                "risk": RiskLevel.MEDIUM,
                "approval": False,
                "schema": {
                    "type": "object",
                    "required": ["customer_id", "patch"],
                    "properties": {
                        "customer_id": {"type": "string", "format": "uuid"},
                        "patch": {"type": "object"},
                    },
                },
            },
            {
                "id": "custom_mcp.delete_customer",
                "name": "delete_customer",
                "desc": "Soft-delete customer record. Strictly requires verified gating approval ticket.",
                "risk": RiskLevel.CRITICAL,
                "approval": True,
                "schema": {
                    "type": "object",
                    "required": ["customer_id", "reason"],
                    "properties": {
                        "customer_id": {"type": "string", "format": "uuid"},
                        "reason": {"type": "string", "minLength": 5},
                        "approval_ticket_id": {"type": "string"},
                    },
                },
            },
            {
                "id": "custom_mcp.purge_inactive_customer_data",
                "name": "purge_inactive_customer_data",
                "desc": "Permanently purge inactive customer records past retention period.",
                "risk": RiskLevel.CRITICAL,
                "approval": True,
                "schema": {
                    "type": "object",
                    "required": ["days_inactive", "reason"],
                    "properties": {
                        "days_inactive": {"type": "integer", "minimum": 30},
                        "reason": {"type": "string", "minLength": 10},
                        "approval_ticket_id": {"type": "string"},
                    },
                },
            },
            {
                "id": "custom_mcp.get_order",
                "name": "get_order",
                "desc": "Fetch single order detail with order line items.",
                "risk": RiskLevel.LOW,
                "approval": False,
                "schema": {
                    "type": "object",
                    "required": ["order_id"],
                    "properties": {"order_id": {"type": "string", "format": "uuid"}},
                },
            },
            {
                "id": "custom_mcp.get_customer_orders",
                "name": "get_customer_orders",
                "desc": "Query order history for specific customer.",
                "risk": RiskLevel.LOW,
                "approval": False,
                "schema": {
                    "type": "object",
                    "required": ["customer_id"],
                    "properties": {
                        "customer_id": {"type": "string", "format": "uuid"},
                        "limit": {"type": "integer", "default": 20},
                    },
                },
            },
            {
                "id": "custom_mcp.append_customer_audit_note",
                "name": "append_customer_audit_note",
                "desc": "Append immutable compliance audit note to customer record.",
                "risk": RiskLevel.MEDIUM,
                "approval": False,
                "schema": {
                    "type": "object",
                    "required": ["customer_id", "note"],
                    "properties": {
                        "customer_id": {"type": "string", "format": "uuid"},
                        "note": {"type": "string", "minLength": 5},
                    },
                },
            },
        ]

        for s in raw_specs:
            tool = DiscoveredTool(
                tool_id=s["id"],
                integration_id=self.integration_id,
                name=s["name"],
                description=s["desc"],
                input_schema=s["schema"],
                risk_level=s["risk"],
                approval_required=s["approval"],
                enabled=True,
                state=ToolState.AVAILABLE,
            )
            self._tool_cache[s["id"]] = tool

    async def connect(self) -> bool:
        self._connected = True
        self._status = IntegrationStatus.CONNECTED
        return True

    async def disconnect(self) -> bool:
        self._connected = False
        self._status = IntegrationStatus.DISCONNECTED
        return True

    async def authenticate(self, credentials: ConnectorCredentials) -> bool:
        return True

    async def refresh_auth(self) -> bool:
        return True

    async def test_connection(self) -> ConnectionTestResult:
        start = time.perf_counter()
        try:
            pool = await get_db_pool()
            async with pool.acquire() as conn:
                await conn.fetchval("SELECT 1")
            latency = int((time.perf_counter() - start) * 1000)
            return ConnectionTestResult(
                success=True,
                latency_ms=latency,
                message="Local PostgreSQL database connection verified.",
                server_version="FastMCP 1.0 (PostgreSQL)",
                protocol_version="internal",
            )
        except Exception as exc:
            latency = int((time.perf_counter() - start) * 1000)
            return ConnectionTestResult(
                success=False,
                latency_ms=latency,
                message=f"PostgreSQL connection error: {str(exc)}",
            )

    async def list_tools(self) -> list[DiscoveredTool]:
        return list(self._tool_cache.values())

    async def get_tool_schema(self, tool_id: str) -> dict[str, Any]:
        tool = self._tool_cache.get(tool_id)
        return tool.input_schema if tool else {}

    async def execute_tool(
        self,
        tool_id: str,
        parameters: dict[str, Any],
    ) -> ToolExecutionResult:
        start = time.perf_counter()
        pool = await get_db_pool()
        customer_service = CustomerService(pool)
        order_service = OrderService(pool)
        audit_service = AuditService(pool)

        try:
            if tool_id in ("custom_mcp.query_customer_records", "query_customer_records"):
                res = await handle_query_customer_records(parameters, service=customer_service)
            elif tool_id in ("custom_mcp.get_customer", "get_customer"):
                res = await handle_get_customer(parameters, service=customer_service)
            elif tool_id in ("custom_mcp.update_customer", "update_customer"):
                res = await handle_update_customer(parameters, service=customer_service)
            elif tool_id in ("custom_mcp.delete_customer", "delete_customer"):
                res = await handle_delete_customer(parameters, service=customer_service)
            elif tool_id in ("custom_mcp.purge_inactive_customer_data", "purge_inactive_customer_data"):
                res = await handle_purge_inactive_customer_data(parameters, service=customer_service)
            elif tool_id in ("custom_mcp.get_order", "get_order"):
                res = await handle_get_order(parameters, service=order_service)
            elif tool_id in ("custom_mcp.get_customer_orders", "get_customer_orders"):
                res = await handle_get_customer_orders(parameters, service=order_service)
            elif tool_id in ("custom_mcp.append_customer_audit_note", "append_customer_audit_note"):
                res = await handle_append_customer_audit_note(parameters, service=audit_service)
            else:
                raise ValueError(f"Unknown tool_id: {tool_id}")

            latency = int((time.perf_counter() - start) * 1000)
            data_val = res.model_dump() if hasattr(res, "model_dump") else res
            return ToolExecutionResult(
                success=True,
                data=data_val,
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
        return True

    async def health_check(self) -> ConnectorHealth:
        test = await self.test_connection()
        return ConnectorHealth(
            status=IntegrationStatus.CONNECTED if test.success else IntegrationStatus.ERROR,
            latency_ms=test.latency_ms,
            error_message=None if test.success else test.message,
        )
