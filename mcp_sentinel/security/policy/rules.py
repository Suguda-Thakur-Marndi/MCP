"""
Rule condition evaluators for MCP-Sentinel Phase 4 Policy Engine.
"""

from mcp_sentinel.security.decisions.models import RiskLevelEnum, SecurityDecisionEnum
from mcp_sentinel.security.policy.models import PolicyContext, PolicyRule
from mcp_sentinel.security.risk.factors import TRUSTED_TOOL_REGISTRY
from mcp_sentinel.security.risk.models import DataSensitivityEnum, RiskExplanation

# --- Rule Conditions ---


def cond_rule_003_unauthorized(ctx: PolicyContext, risk: RiskExplanation) -> bool:
    """RULE-003: Operation is unauthorized."""
    return not ctx.is_authorized


def cond_rule_004_restricted_resource(ctx: PolicyContext, risk: RiskExplanation) -> bool:
    """RULE-004: Tool requests restricted resource without explicit credentials."""
    return (
        ctx.data_sensitivity == DataSensitivityEnum.RESTRICTED
        and not ctx.actor_has_restricted_access
    )


def cond_rule_006_missing_context(ctx: PolicyContext, risk: RiskExplanation) -> bool:
    """RULE-006: Security context is missing or invalid (Fail Closed)."""
    return not ctx.tool_name or not ctx.tool_name.strip() or not ctx.request_id


def cond_rule_007_unknown_high_risk_tool(ctx: PolicyContext, risk: RiskExplanation) -> bool:
    """RULE-007: Unknown tool marked destructive or high risk fails closed."""
    if ctx.is_server_approved:
        return False
    is_unknown = ctx.tool_name not in TRUSTED_TOOL_REGISTRY
    return is_unknown and (ctx.destructive or risk.clamped_score >= 50)


def cond_rule_001_destructive_requires_approval(ctx: PolicyContext, risk: RiskExplanation) -> bool:
    """RULE-001: Destructive operation requires server-verified approval."""
    return ctx.destructive and not ctx.is_server_approved


def cond_rule_002_production_critical_requires_approval(
    ctx: PolicyContext, risk: RiskExplanation
) -> bool:
    """RULE-002: Production operation with CRITICAL risk requires approval."""
    return (
        ctx.environment.lower() == "production"
        and risk.risk_level == RiskLevelEnum.CRITICAL
        and not ctx.is_server_approved
    )


def cond_rule_005_bulk_critical_operation(ctx: PolicyContext, risk: RiskExplanation) -> bool:
    """RULE-005: Bulk operation exceeds critical threshold without approval."""
    return ctx.record_count >= 1000 and not ctx.is_server_approved


def cond_rule_010_approved_destructive(ctx: PolicyContext, risk: RiskExplanation) -> bool:
    """RULE-010: High-risk or destructive operation with verified server-side approval ticket."""
    return ctx.is_server_approved


def cond_rule_008_safe_read_allow(ctx: PolicyContext, risk: RiskExplanation) -> bool:
    """RULE-008: Safe read operation with acceptable risk."""
    return (
        not ctx.destructive
        and not ctx.external_side_effect
        and risk.risk_level in (RiskLevelEnum.LOW, RiskLevelEnum.MEDIUM)
    )


def cond_rule_009_controlled_write_allow(ctx: PolicyContext, risk: RiskExplanation) -> bool:
    """RULE-009: Controlled non-destructive mutation in dev/staging with acceptable risk."""
    return (
        not ctx.destructive
        and ctx.external_side_effect
        and risk.risk_level in (RiskLevelEnum.LOW, RiskLevelEnum.MEDIUM)
        and ctx.environment.lower() in ("development", "test", "staging")
    )


# --- Standard Rule Definitions ---

RULE_006 = PolicyRule(
    rule_id="RULE-006",
    name="fail_closed_missing_context",
    description="Fails closed when security context is incomplete, missing, or malformed.",
    priority=1100,
    target_decision=SecurityDecisionEnum.DENY,
    reason="Security context is missing or invalid. Failing closed.",
    condition=cond_rule_006_missing_context,
)

RULE_003 = PolicyRule(
    rule_id="RULE-003",
    name="deny_unauthorized_operation",
    description="Denies operations where the actor lacks authorization.",
    priority=1000,
    target_decision=SecurityDecisionEnum.DENY,
    reason="Actor is not authorized for this operation.",
    condition=cond_rule_003_unauthorized,
)

RULE_004 = PolicyRule(
    rule_id="RULE-004",
    name="deny_unauthorized_restricted_resource",
    description="Denies access to RESTRICTED resources when actor lacks specific credentials.",
    priority=950,
    target_decision=SecurityDecisionEnum.DENY,
    reason="Actor lacks authorized credentials for RESTRICTED data.",
    condition=cond_rule_004_restricted_resource,
)

RULE_007 = PolicyRule(
    rule_id="RULE-007",
    name="fail_closed_unknown_high_risk_tool",
    description="Denies unknown tools that are marked destructive or have high risk.",
    priority=900,
    target_decision=SecurityDecisionEnum.DENY,
    reason="Unknown tool cannot be executed safely. Fails closed.",
    condition=cond_rule_007_unknown_high_risk_tool,
)

RULE_005 = PolicyRule(
    rule_id="RULE-005",
    name="bulk_critical_operation_requires_approval",
    description="Requires human approval when operation scope exceeds critical bulk threshold.",
    priority=850,
    target_decision=SecurityDecisionEnum.REQUIRE_APPROVAL,
    reason="Operation affects critical bulk record volume; requires human approval.",
    condition=cond_rule_005_bulk_critical_operation,
)

RULE_001 = PolicyRule(
    rule_id="RULE-001",
    name="destructive_requires_approval",
    description="High-risk destructive operations strictly require verified server-side approval.",
    priority=800,
    target_decision=SecurityDecisionEnum.REQUIRE_APPROVAL,
    reason="Access Denied: Destructive operations require verified human-in-the-loop approval.",
    condition=cond_rule_001_destructive_requires_approval,
)

RULE_002 = PolicyRule(
    rule_id="RULE-002",
    name="production_critical_requires_approval",
    description="Critical-risk operations in production require approval gating.",
    priority=750,
    target_decision=SecurityDecisionEnum.REQUIRE_APPROVAL,
    reason="Production operation classified as CRITICAL risk requires approval.",
    condition=cond_rule_002_production_critical_requires_approval,
)

RULE_010 = PolicyRule(
    rule_id="RULE-010",
    name="allow_verified_approved_destructive",
    description="Allows destructive operation when server has verified an authentic approval ticket.",
    priority=300,
    target_decision=SecurityDecisionEnum.ALLOW,
    reason="Destructive operation verified with authentic server approval ticket.",
    condition=cond_rule_010_approved_destructive,
)

RULE_008 = PolicyRule(
    rule_id="RULE-008",
    name="allow_safe_low_risk_read",
    description="Allows read-only queries with low risk scores.",
    priority=200,
    target_decision=SecurityDecisionEnum.ALLOW,
    reason="Read-only operation with LOW risk is permitted.",
    condition=cond_rule_008_safe_read_allow,
)

RULE_009 = PolicyRule(
    rule_id="RULE-009",
    name="allow_controlled_write_dev",
    description="Allows non-destructive mutations with low/medium risk in non-production.",
    priority=100,
    target_decision=SecurityDecisionEnum.ALLOW,
    reason="Controlled non-destructive update permitted in current environment.",
    condition=cond_rule_009_controlled_write_allow,
)
