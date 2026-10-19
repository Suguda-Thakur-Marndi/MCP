"""
Policy Models for MCP-Sentinel Phase 4.
Defines execution context, rule schemas, and policy definitions.
"""

from typing import Callable, Optional

from pydantic import BaseModel, ConfigDict, Field

from mcp_sentinel.security.decisions.models import SecurityDecisionEnum
from mcp_sentinel.security.risk.models import DataSensitivityEnum, RiskExplanation


class PolicyContext(BaseModel):
    """
    Server-authoritative context evaluated by the Policy Engine.
    All fields are constructed server-side; untrusted client/agent parameters are discarded.
    """

    model_config = ConfigDict(frozen=True, extra="forbid")

    request_id: str = Field(..., description="Unique correlation identifier for the request.")
    agent_id: str = Field(..., description="Identity of the AI agent making the request.")
    actor_type: str = Field(default="agent", description="Actor category (agent, user, system).")
    tool_name: str = Field(..., description="Requested tool name.")
    operation: str = Field(
        default="read", description="Operation type (read, create, update, delete, purge)."
    )
    resource: str = Field(default="customer", description="Target domain resource.")
    resource_id: Optional[str] = Field(
        default=None, description="Specific identifier of target record if applicable."
    )
    environment: str = Field(
        default="development", description="Runtime environment (development, staging, production)."
    )
    data_sensitivity: DataSensitivityEnum = Field(
        default=DataSensitivityEnum.CONFIDENTIAL,
        description="Sensitivity classification of the accessed resource.",
    )
    record_count: int = Field(
        default=1, ge=0, description="Estimated or verified record count affected."
    )
    destructive: bool = Field(
        default=False, description="Whether the requested action is destructive."
    )
    external_side_effect: bool = Field(
        default=False, description="Whether the operation has external side effects."
    )
    is_authorized: bool = Field(
        default=True, description="Whether the actor has base authorization to invoke the tool."
    )
    is_server_approved: bool = Field(
        default=False,
        description="Whether a valid, server-side approval ticket was verified against the database.",
    )
    actor_has_restricted_access: bool = Field(
        default=False,
        description="Whether the actor has explicit credentials for RESTRICTED level data.",
    )
    user_id: Optional[str] = Field(
        default=None,
        description="Authoritative authenticated human user ID from security context.",
    )
    user_role: Optional[str] = Field(
        default=None,
        description="Authoritative RBAC role of the human user (VIEWER, OPERATOR, APPROVER, ADMIN).",
    )
    user_permissions: list[str] = Field(
        default_factory=list,
        description="Resolved explicit permissions for the human user.",
    )
    user_organization: Optional[str] = Field(
        default=None,
        description="Tenant organization of the human user.",
    )


class PolicyRule(BaseModel):
    """
    Individual security policy rule evaluated against PolicyContext and RiskExplanation.
    """

    model_config = ConfigDict(arbitrary_types_allowed=True)

    rule_id: str = Field(..., description="Unique rule identifier (e.g. 'RULE-001').")
    name: str = Field(..., description="Short descriptive name.")
    description: str = Field(..., description="Explanation of the rule's security intent.")
    priority: int = Field(..., description="Evaluation priority. Higher number evaluates earlier.")
    target_decision: SecurityDecisionEnum = Field(
        ...,
        description="Decision yielded if the condition matches (ALLOW, DENY, REQUIRE_APPROVAL, REQUIRE_MFA).",
    )
    reason: str = Field(
        ..., description="Explanation attached to the decision when this rule triggers."
    )
    condition: Optional[Callable[[PolicyContext, RiskExplanation], bool]] = Field(
        default=None,
        description="Callable evaluating whether the rule condition is met.",
    )

    def matches(self, context: PolicyContext, risk: RiskExplanation) -> bool:
        if self.condition is None:
            return False
        return self.condition(context, risk)


class PolicyDefinition(BaseModel):
    """
    Versioned collection of policy rules defining the active security policy.
    """

    model_config = ConfigDict(arbitrary_types_allowed=True)

    policy_id: str = Field(..., description="Unique identifier for the policy.")
    policy_version: str = Field(..., description="Semantic version string for policy auditing.")
    description: str = Field(..., description="High-level description of this policy's posture.")
    rules: list[PolicyRule] = Field(
        default_factory=list, description="Rules comprising this policy."
    )
