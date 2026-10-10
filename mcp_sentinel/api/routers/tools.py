"""
Tools API Router for MCP Sentinel Multi-Software Gateway.
Exposes the Central Tool Registry and handles live tool execution through
the mandatory 9-stage Zero-Trust Security Pipeline.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field

from mcp_sentinel.repositories.tool_repository import ToolRepository
from mcp_sentinel.security.auth.dependencies import get_current_user
from mcp_sentinel.security.auth.models import AuthUser
from mcp_sentinel.security.risk.factors import TRUSTED_TOOL_REGISTRY
from mcp_sentinel.services.gateway_execution_service import (
    GatewayExecuteRequest,
    GatewayExecuteResponse,
    GatewayExecutionService,
)
from mcp_sentinel.services.tool_registry_service import ToolRegistryService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/tools", tags=["Tools"])

_tool_repo: Optional[ToolRepository] = None
_tool_registry_service: Optional[ToolRegistryService] = None
_gateway_service: Optional[GatewayExecutionService] = None


def get_tool_repo() -> ToolRepository:
    global _tool_repo
    if _tool_repo is None:
        _tool_repo = ToolRepository()
    return _tool_repo


def get_tool_service() -> ToolRegistryService:
    global _tool_registry_service
    if _tool_registry_service is None:
        _tool_registry_service = ToolRegistryService()
    return _tool_registry_service


def get_gateway_service() -> GatewayExecutionService:
    global _gateway_service
    if _gateway_service is None:
        _gateway_service = GatewayExecutionService()
    return _gateway_service


class ExecuteToolBody(BaseModel):
    """Execution request body submitted by client or AI agent."""
    parameters: dict[str, Any] = Field(default_factory=dict)
    approval_ticket_id: Optional[str] = None
    reason: Optional[str] = None
    agent_id: Optional[str] = "sentinel-agent-v1"
    agent_name: Optional[str] = "Sentinel Core Agent"


@router.get("", summary="List all registered tools")
async def list_tools(
    request: Request,
    integration_id: Optional[str] = Query(None, description="Filter by integration ID"),
    risk_level: Optional[str] = Query(None, description="Filter by risk level (LOW, MEDIUM, HIGH, CRITICAL)"),
    enabled_only: bool = Query(False, description="Filter to enabled tools only"),
    repo: ToolRepository = Depends(get_tool_repo),
) -> Any:
    db_tools = await repo.list_tools(
        integration_id=integration_id,
        risk_level=risk_level,
        enabled_only=enabled_only,
    )
    if integration_id is not None:
        return db_tools

    auth_header = request.headers.get("authorization", "")
    if not auth_header:
        return db_tools

    core_tool_names = [
        "query_customer_records",
        "get_customer",
        "get_customer_orders",
        "get_order",
        "append_customer_audit_note",
        "update_customer",
        "delete_customer",
        "purge_inactive_customer_data",
    ]
    tools_data = []
    for tool_name in core_tool_names:
        if tool_name in TRUSTED_TOOL_REGISTRY:
            profile = TRUSTED_TOOL_REGISTRY[tool_name]
            tools_data.append(
                {
                    "tool_name": tool_name,
                    "name": tool_name,
                    "base_risk": profile.base_risk,
                    "read_only": profile.read_only,
                    "destructive": profile.destructive,
                    "data_sensitivity": profile.data_sensitivity.value,
                    "external_side_effect": profile.external_side_effect,
                    "operation_type": profile.operation_type,
                    "resource_type": profile.resource_type,
                }
            )

    return {
        "status": "success",
        "tool_count": len(tools_data),
        "tools": tools_data,
        "registered_tools": db_tools,
    }


@router.post("/sync", summary="Discover and sync tools from all active connectors")
async def sync_tools(
    service: ToolRegistryService = Depends(get_tool_service),
) -> dict[str, Any]:
    synced = await service.sync_all_tools()
    return {
        "success": True,
        "count": len(synced),
        "message": f"Successfully synchronized {len(synced)} tools to registry.",
    }


@router.get("/{tool_id:path}", summary="Get tool detail and schema")
async def get_tool(
    tool_id: str,
    repo: ToolRepository = Depends(get_tool_repo),
) -> dict[str, Any]:
    tool = await repo.get_tool(tool_id)
    if not tool:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tool '{tool_id}' not found in registry",
        )
    return tool


@router.post("/{tool_id:path}/execute", summary="Execute tool through 9-stage Gateway Security Pipeline")
async def execute_tool(
    tool_id: str,
    body: ExecuteToolBody,
    gw_service: GatewayExecutionService = Depends(get_gateway_service),
    current_user: Optional[AuthUser] = Depends(get_current_user),
) -> GatewayExecuteResponse:
    user_id = current_user.id if current_user else "operator@sentinel.internal"
    user_role = current_user.role.value if current_user else "OPERATOR"

    req = GatewayExecuteRequest(
        tool_id=tool_id,
        parameters=body.parameters,
        user_id=user_id,
        user_role=user_role,
        agent_id=body.agent_id or "sentinel-agent-v1",
        agent_name=body.agent_name or "Sentinel Core Agent",
        approval_ticket_id=body.approval_ticket_id,
        reason=body.reason,
    )

    response = await gw_service.execute(req)

    # If blocked by policy or auth, return 403 or 400
    if response.status == "BLOCKED":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=response.error or "Action blocked by security policy",
        )
    elif response.status == "PENDING_APPROVAL":
        # 202 Accepted: Action paused, human approval required
        return response

    return response
