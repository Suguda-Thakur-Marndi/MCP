"""
Unit tests for SentinelCore Risk Engine and Risk Scoring.
Verifies:
- Deterministic risk assessment by tool name
- Risk tier boundaries (LOW, MEDIUM, HIGH, CRITICAL)
- Client downgrade prevention (destructive tools cannot be marked non-destructive)
"""

from mcp_sentinel.security.decisions.models import RiskLevelEnum
from mcp_sentinel.security.risk.engine import RiskEngine


def test_read_tool_risk_assessment():
    """Verifies read tools produce LOW risk score."""
    engine = RiskEngine()
    assessment = engine.assess_risk("get_customer", record_count=1)

    assert assessment.risk_level == RiskLevelEnum.LOW
    assert assessment.clamped_score <= 24
    assert assessment.factors.destructive_factor == 0


def test_destructive_tool_risk_assessment():
    """Verifies delete_customer produces HIGH or CRITICAL risk score."""
    engine = RiskEngine()
    assessment = engine.assess_risk("delete_customer", record_count=1)

    assert assessment.risk_level in (RiskLevelEnum.HIGH, RiskLevelEnum.CRITICAL)
    assert assessment.clamped_score >= 70
    assert assessment.factors.destructive_factor > 0


def test_destructive_cannot_be_downgraded_by_override():
    """Verifies that an agent cannot downgrade a destructive tool's risk."""
    engine = RiskEngine()
    # Attempt to override destructive=False
    assessment = engine.assess_risk("delete_customer", override_destructive=False)

    # Must still register destructive factor and high risk
    assert assessment.clamped_score >= 70
    assert assessment.factors.destructive_factor > 0


def test_large_record_count_increases_risk():
    """Verifies that large scale operations increase the scale factor."""
    engine = RiskEngine()
    single_res = engine.assess_risk("query_customer_records", record_count=1)
    bulk_res = engine.assess_risk("query_customer_records", record_count=500)

    assert bulk_res.clamped_score > single_res.clamped_score
