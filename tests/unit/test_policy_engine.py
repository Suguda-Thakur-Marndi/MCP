"""
Unit tests for MCP-Sentinel Policy Engine.
Verifies:
- Read-only queries evaluate to ALLOW with LOW risk
- Destructive operations evaluate to REQUIRE_APPROVAL with HIGH/CRITICAL risk
- Stripping of untrusted security claims from input parameters
- Strict enforcement of RBAC roles (VIEWER blocked from destructive tools)
"""

from mcp_sentinel.security.decisions.models import RiskLevelEnum, SecurityDecisionEnum
from mcp_sentinel.security.policy.engine import PolicyEngine


def test_read_tool_evaluated_as_allow(policy_engine: PolicyEngine):
    """Verifies that read tools evaluate to ALLOW with low risk."""
    ctx = policy_engine.build_context(
        tool_name="get_customer",
        arguments={"customer_id": "CUST-000001"},
    )
    decision = policy_engine.evaluate(ctx)

    assert decision.decision == SecurityDecisionEnum.ALLOW
    assert decision.risk_level == RiskLevelEnum.LOW
    assert decision.risk_score < 25


def test_destructive_delete_customer_requires_approval(policy_engine: PolicyEngine):
    """Verifies that delete_customer evaluates to REQUIRE_APPROVAL with high/critical risk."""
    ctx = policy_engine.build_context(
        tool_name="delete_customer",
        arguments={"customer_id": "CUST-000001", "reason": "GDPR deletion"},
    )
    decision = policy_engine.evaluate(ctx)

    assert decision.decision == SecurityDecisionEnum.REQUIRE_APPROVAL
    assert decision.risk_score >= 70
    assert decision.risk_level in (RiskLevelEnum.HIGH, RiskLevelEnum.CRITICAL)


def test_notion_archive_page_requires_approval(policy_engine: PolicyEngine):
    """Verifies that notion.archive_page evaluates to REQUIRE_APPROVAL."""
    ctx = policy_engine.build_context(
        tool_name="notion.archive_page",
        arguments={"page_id": "11799527-bfef-800d-8b77-fd72411ca920", "archive": True},
    )
    decision = policy_engine.evaluate(ctx)

    assert decision.decision == SecurityDecisionEnum.REQUIRE_APPROVAL
    assert decision.risk_score >= 70


def test_untrusted_security_fields_are_stripped(policy_engine: PolicyEngine):
    """Verifies that client-supplied claims (e.g. is_admin=True, risk_score=0) are stripped."""
    ctx = policy_engine.build_context(
        tool_name="delete_customer",
        arguments={
            "customer_id": "CUST-000001",
            "is_admin": True,
            "bypass_policy": True,
            "decision": "ALLOW",
            "risk_score": 0,
            "risk_level": "LOW",
        },
    )
    decision = policy_engine.evaluate(ctx)

    # Must still REQUIRE_APPROVAL regardless of spoofed security claims
    assert decision.decision == SecurityDecisionEnum.REQUIRE_APPROVAL
    assert decision.risk_score >= 70


def test_viewer_role_blocked_from_destructive_actions(policy_engine: PolicyEngine, viewer_user):
    """Verifies that a VIEWER user is unauthorized for destructive actions."""
    ctx = policy_engine.build_context(
        tool_name="delete_customer",
        arguments={"customer_id": "CUST-000001"},
        user=viewer_user,
    )
    decision = policy_engine.evaluate(ctx)

    # VIEWER cannot execute destructive tools -> DENY or REQUIRE_APPROVAL with unauthorized status
    assert ctx.is_authorized is False
    assert decision.decision in (SecurityDecisionEnum.DENY, SecurityDecisionEnum.REQUIRE_APPROVAL)
