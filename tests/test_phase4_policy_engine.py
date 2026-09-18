"""
Phase 4 Policy Engine Unit Tests.
Tests authoritative rule evaluation, decision precedence, fail-closed handling, and policy versioning.
Complies with:
- POLICY-001: Safe read -> ALLOW
- POLICY-002: Destructive operation -> REQUIRE_APPROVAL
- POLICY-003: Unknown destructive tool -> DENY / Fail Closed
- POLICY-004: Critical production action -> REQUIRE_APPROVAL
- POLICY-005: Missing security context -> FAIL CLOSED
- Precedence: DENY > REQUIRE_MFA > REQUIRE_APPROVAL > ALLOW
"""

import pytest

from mcp_sentinel.config.settings import Settings
from mcp_sentinel.security.decisions.models import (
    RiskLevelEnum,
    SecurityDecisionEnum,
)
from mcp_sentinel.security.policy.defaults import (
    DEFAULT_POLICY_ID,
    DEFAULT_POLICY_VERSION,
)
from mcp_sentinel.security.policy.engine import PolicyEngine
from mcp_sentinel.security.policy.evaluator import RuleEvaluator
from mcp_sentinel.security.policy.models import (
    PolicyContext,
    PolicyDefinition,
    PolicyRule,
)
from mcp_sentinel.security.risk.models import RiskExplanation, RiskFactors


@pytest.fixture
def dev_policy_engine():
    settings = Settings(
        DATABASE_URL="postgresql://test:test@localhost:5432/testdb",
        APP_ENV="development",
    )
    return PolicyEngine(settings=settings)


@pytest.fixture
def prod_policy_engine():
    settings = Settings(
        DATABASE_URL="postgresql://test:test@localhost:5432/testdb",
        APP_ENV="production",
    )
    return PolicyEngine(settings=settings)


# =============================================================================
# 1. CORE POLICY EVALUATION TESTS (POLICY-001 to POLICY-005)
# =============================================================================


def test_policy_001_safe_read(dev_policy_engine):
    """POLICY-001: Safe read operation with LOW risk must be ALLOWed."""
    context = dev_policy_engine.build_context(
        tool_name="get_customer",
        arguments={"customer_id": "CUST-000001"},
    )
    decision = dev_policy_engine.evaluate(context)
    assert decision.decision == SecurityDecisionEnum.ALLOW
    assert decision.policy_id == DEFAULT_POLICY_ID
    assert decision.policy_version == DEFAULT_POLICY_VERSION
    assert "RULE-008" in decision.matched_rules


def test_policy_002_destructive_requires_approval(dev_policy_engine):
    """POLICY-002: Destructive operation without server approval yields REQUIRE_APPROVAL."""
    context = dev_policy_engine.build_context(
        tool_name="delete_customer",
        arguments={"customer_id": "CUST-000001"},
        is_server_approved=False,
    )
    decision = dev_policy_engine.evaluate(context)
    assert decision.decision == SecurityDecisionEnum.REQUIRE_APPROVAL
    assert "RULE-001" in decision.matched_rules
    assert decision.risk_level in (RiskLevelEnum.HIGH, RiskLevelEnum.CRITICAL)


def test_policy_003_unknown_destructive_tool(dev_policy_engine):
    """POLICY-003: Unknown tool marked destructive must FAIL CLOSED to DENY."""
    context = PolicyContext(
        request_id="req-test-unknown",
        agent_id="test-agent",
        actor_type="agent",
        tool_name="drop_table_users",
        operation="delete",
        resource="system",
        destructive=True,
        environment="development",
        record_count=1,
    )
    decision = dev_policy_engine.evaluate(context)
    assert decision.decision == SecurityDecisionEnum.DENY
    assert "RULE-007" in decision.matched_rules


def test_policy_004_critical_production_action(prod_policy_engine):
    """POLICY-004: Critical production action without approval yields REQUIRE_APPROVAL."""
    context = prod_policy_engine.build_context(
        tool_name="delete_customer",
        arguments={"customer_id": "CUST-000001"},
        is_server_approved=False,
    )
    decision = prod_policy_engine.evaluate(context)
    assert decision.decision == SecurityDecisionEnum.REQUIRE_APPROVAL
    assert decision.risk_level == RiskLevelEnum.CRITICAL
    assert "RULE-002" in decision.matched_rules or "RULE-001" in decision.matched_rules


def test_policy_005_missing_security_context(dev_policy_engine):
    """POLICY-005: Missing or empty tool name must FAIL CLOSED to DENY."""
    context = PolicyContext(
        request_id="req-empty",
        agent_id="test-agent",
        actor_type="agent",
        tool_name="",  # Empty tool name
        operation="read",
        resource="customer",
        environment="development",
    )
    decision = dev_policy_engine.evaluate(context)
    assert decision.decision == SecurityDecisionEnum.DENY
    assert "RULE-006" in decision.matched_rules


# =============================================================================
# 2. DECISION PRECEDENCE TESTS
# =============================================================================


def test_decision_precedence_deny_overrides_allow():
    """Verifies that if a DENY rule matches, it completely overrides any ALLOW rule."""
    deny_rule = PolicyRule(
        rule_id="RULE-FORCE-DENY",
        name="force_deny",
        description="Explicit test deny rule",
        priority=900,
        target_decision=SecurityDecisionEnum.DENY,
        reason="Security test denial",
        condition=lambda ctx, risk: True,
    )
    allow_rule = PolicyRule(
        rule_id="RULE-FORCE-ALLOW",
        name="force_allow",
        description="Explicit test allow rule",
        priority=100,
        target_decision=SecurityDecisionEnum.ALLOW,
        reason="Security test allow",
        condition=lambda ctx, risk: True,
    )

    policy = PolicyDefinition(
        policy_id="test-precedence-policy",
        policy_version="1.0.0",
        description="Testing precedence",
        rules=[allow_rule, deny_rule],
    )
    evaluator = RuleEvaluator(policy)

    context = PolicyContext(
        request_id="req-test-prec",
        agent_id="agent-1",
        tool_name="get_customer",
    )
    dummy_risk = RiskExplanation(
        raw_score=10,
        clamped_score=10,
        risk_level=RiskLevelEnum.LOW,
        factors=RiskFactors(
            tool_base_risk=10,
            destructive_factor=0,
            data_sensitivity_factor=0,
            environment_factor=0,
            scale_factor=0,
            external_side_effect_factor=0,
        ),
        summary="Test risk",
    )

    decision = evaluator.evaluate(context, dummy_risk)
    assert decision.decision == SecurityDecisionEnum.DENY
    assert "RULE-FORCE-DENY" in decision.matched_rules


def test_decision_precedence_require_approval_overrides_allow():
    """Verifies that REQUIRE_APPROVAL takes precedence over ALLOW."""
    appr_rule = PolicyRule(
        rule_id="RULE-FORCE-APPR",
        name="force_appr",
        description="Explicit approval rule",
        priority=800,
        target_decision=SecurityDecisionEnum.REQUIRE_APPROVAL,
        reason="Approval required",
        condition=lambda ctx, risk: True,
    )
    allow_rule = PolicyRule(
        rule_id="RULE-FORCE-ALLOW",
        name="force_allow",
        description="Explicit allow rule",
        priority=100,
        target_decision=SecurityDecisionEnum.ALLOW,
        reason="Allow",
        condition=lambda ctx, risk: True,
    )

    policy = PolicyDefinition(
        policy_id="test-precedence-policy-2",
        policy_version="1.0.0",
        description="Testing precedence",
        rules=[allow_rule, appr_rule],
    )
    evaluator = RuleEvaluator(policy)

    context = PolicyContext(
        request_id="req-test-prec-2",
        agent_id="agent-1",
        tool_name="delete_customer",
        destructive=True,
    )
    dummy_risk = RiskExplanation(
        raw_score=60,
        clamped_score=60,
        risk_level=RiskLevelEnum.HIGH,
        factors=RiskFactors(
            tool_base_risk=30,
            destructive_factor=25,
            data_sensitivity_factor=5,
            environment_factor=0,
            scale_factor=0,
            external_side_effect_factor=0,
        ),
        summary="Test risk",
    )

    decision = evaluator.evaluate(context, dummy_risk)
    assert decision.decision == SecurityDecisionEnum.REQUIRE_APPROVAL


# =============================================================================
# 3. EXTERNAL VS AUDIT PROJECTION
# =============================================================================


def test_external_decision_dict_sanitization(dev_policy_engine):
    """Verifies that to_external_dict() never leaks internal scoring factors."""
    context = dev_policy_engine.build_context(
        tool_name="get_customer",
        arguments={"customer_id": "CUST-000001"},
    )
    decision = dev_policy_engine.evaluate(context)
    ext = decision.to_external_dict()
    assert "decision" in ext
    assert "risk_score" in ext
    assert "risk_level" in ext
    assert "policy_id" in ext
    assert "policy_version" in ext
    assert "request_id" in ext
    # Internal factors and raw timestamps must NOT be in external dict
    assert "factors" not in ext
    assert "timestamp" not in ext

    aud = decision.to_audit_dict()
    assert "factors" in aud
    assert "timestamp" in aud
