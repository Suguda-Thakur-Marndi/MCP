"""
Policies and Tools API Router for MCP-Sentinel.
Exposes live policy definitions, rule precedences, and trusted MCP tool registry metadata.
"""

from typing import Any

from fastapi import APIRouter, Depends

from mcp_sentinel.security.auth.dependencies import get_current_user
from mcp_sentinel.security.auth.models import AuthUser
from mcp_sentinel.security.policy.engine import get_policy_engine
from mcp_sentinel.security.risk.factors import TRUSTED_TOOL_REGISTRY

router = APIRouter(prefix="/api", tags=["Policies and Tools"])


@router.get(
    "/policies",
    summary="Get active security policy definitions and rules",
)
async def get_policies(current_user: AuthUser = Depends(get_current_user)) -> dict[str, Any]:
    engine = get_policy_engine()
    policy = engine._policy

    rules_data = [
        {
            "rule_id": r.rule_id,
            "name": r.name,
            "description": r.description,
            "priority": r.priority,
            "target_decision": r.target_decision.value,
            "reason": r.reason,
        }
        for r in policy.rules
    ]

    return {
        "status": "success",
        "policy_id": policy.policy_id,
        "policy_version": policy.policy_version,
        "precedence": ["DENY", "REQUIRE_MFA", "REQUIRE_APPROVAL", "ALLOW"],
        "rule_count": len(rules_data),
        "rules": rules_data,
    }


@router.get(
    "/tools",
    summary="Get registered MCP tools with authoritative security risk profiles",
)
async def get_tools(current_user: AuthUser = Depends(get_current_user)) -> dict[str, Any]:
    tools_data = []
    for tool_name, profile in TRUSTED_TOOL_REGISTRY.items():
        tools_data.append(
            {
                "tool_name": tool_name,
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
    }
