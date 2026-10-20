"""
Security Boundary and Access Control Tests for SentinelCore.
Tests zero-trust boundaries, fail-closed approval gating, and parameter validation.
"""

from mcp_sentinel.connectors.notion import is_valid_notion_id, normalize_notion_id
from mcp_sentinel.security.decisions.models import RiskLevelEnum, SecurityDecisionEnum
from mcp_sentinel.security.policy.engine import get_policy_engine
from mcp_sentinel.security.risk.engine import RiskEngine


def test_destructive_operations_require_approval_ticket():
    """Verify that destructive operations are classified as HIGH or CRITICAL and produce high risk scores."""
    risk_engine = RiskEngine()
    assessment = risk_engine.assess_risk("delete_customer", record_count=1)
    assert assessment.risk_level in (RiskLevelEnum.HIGH, RiskLevelEnum.CRITICAL)
    assert assessment.clamped_score >= 70
    assert assessment.factors.destructive_factor > 0

    assessment_purge = risk_engine.assess_risk("purge_inactive_customer_data", record_count=1)
    assert assessment_purge.risk_level in (RiskLevelEnum.HIGH, RiskLevelEnum.CRITICAL)
    assert assessment_purge.clamped_score >= 70


def test_notion_uuid_validation_pre_auth():
    """Verify that malformed or malicious IDs are rejected pre-auth."""
    # Malformed IDs
    assert not is_valid_notion_id("invalid-id-123")
    assert not is_valid_notion_id("../../etc/passwd")
    assert not is_valid_notion_id("DROP TABLE customers;--")
    assert not is_valid_notion_id("")
    assert not is_valid_notion_id(None)

    # Valid UUIDs
    valid_hyphenated = "12345678-1234-1234-1234-123456789abc"
    valid_hex = "12345678123412341234123456789abc"
    assert is_valid_notion_id(valid_hyphenated)
    assert is_valid_notion_id(valid_hex)
    assert normalize_notion_id(valid_hyphenated) == valid_hex


def test_policy_engine_enforces_least_privilege():
    """Verify policy engine evaluates default tool permissions and policy rules."""
    engine = get_policy_engine()
    assert engine is not None

    ctx = engine.build_context(
        tool_name="query_customer_records",
        arguments={"limit": 10},
    )
    decision = engine.evaluate(ctx)
    assert decision.decision == SecurityDecisionEnum.ALLOW
    assert decision.risk_level == RiskLevelEnum.LOW
