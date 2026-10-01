"""
Policies and Tools API Router for MCP-Sentinel.
Exposes live policy definitions, rule precedences, and trusted MCP tool registry metadata.
"""

from typing import Any, Optional

from fastapi import APIRouter, Depends

from mcp_sentinel.security.auth.dependencies import get_current_user_optional
from mcp_sentinel.security.auth.models import AuthUser
from mcp_sentinel.security.policy.engine import get_policy_engine
from mcp_sentinel.security.risk.factors import TRUSTED_TOOL_REGISTRY

router = APIRouter(prefix="/api/policies", tags=["Policies"])


@router.get(
    "",
    summary="Get active security policy definitions and rules",
)
async def get_policies(current_user: Optional[AuthUser] = Depends(get_current_user_optional)) -> dict[str, Any]:
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
