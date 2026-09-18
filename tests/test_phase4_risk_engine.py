"""
Phase 4 Risk Engine Unit Tests.
Tests deterministic risk calculation, factor breakdowns, scope escalations, and level classifications.
Complies with:
- RISK-001: Read customer -> LOW
- RISK-002: Append audit note -> MEDIUM
- RISK-003: Update customer -> MEDIUM
- RISK-004: Delete one customer -> HIGH (dev)
- RISK-005: Mass deletion -> CRITICAL
- RISK-006: Production destructive action -> Higher risk than dev equivalent
"""

import pytest

from mcp_sentinel.config.settings import Settings
from mcp_sentinel.security.decisions.models import RiskLevelEnum
from mcp_sentinel.security.risk.engine import RiskEngine
from mcp_sentinel.security.risk.factors import TRUSTED_TOOL_REGISTRY, get_tool_profile
from mcp_sentinel.security.risk.models import DataSensitivityEnum


@pytest.fixture
def risk_engine():
    dev_settings = Settings(
        DATABASE_URL="postgresql://test:test@localhost:5432/testdb",
        APP_ENV="development",
    )
    return RiskEngine(settings=dev_settings)


# =============================================================================
# 1. BASELINE RISK PROFILE TESTS (RISK-001 to RISK-006)
# =============================================================================


def test_risk_001_read_customer(risk_engine):
    """RISK-001: Read single customer record must evaluate to LOW risk."""
    explanation = risk_engine.assess_risk("get_customer", record_count=1)
    assert explanation.risk_level == RiskLevelEnum.LOW
    assert explanation.clamped_score <= 24
    assert explanation.factors.destructive_factor == 0
    assert explanation.factors.external_side_effect_factor == 0


def test_risk_002_append_audit_note(risk_engine):
    """RISK-002: Append audit note must evaluate to MEDIUM risk."""
    explanation = risk_engine.assess_risk("append_customer_audit_note", record_count=1)
    assert explanation.risk_level == RiskLevelEnum.MEDIUM
    assert 25 <= explanation.clamped_score <= 49
    assert explanation.factors.external_side_effect_factor > 0
    assert explanation.factors.destructive_factor == 0


def test_risk_003_update_customer(risk_engine):
    """RISK-003: Update customer record must evaluate to MEDIUM risk."""
    explanation = risk_engine.assess_risk("update_customer", record_count=1)
    assert explanation.risk_level == RiskLevelEnum.MEDIUM
    assert 25 <= explanation.clamped_score <= 49
    assert explanation.factors.destructive_factor == 0


def test_risk_004_delete_one_customer(risk_engine):
    """RISK-004: Delete single customer in development must evaluate to HIGH risk."""
    explanation = risk_engine.assess_risk("delete_customer", record_count=1)
    assert explanation.risk_level == RiskLevelEnum.HIGH
    assert 50 <= explanation.clamped_score <= 74
    assert explanation.factors.destructive_factor > 0


def test_risk_005_mass_deletion(risk_engine):
    """RISK-005: Mass deletion (bulk scope >= 100) must escalate to CRITICAL risk."""
    explanation = risk_engine.assess_risk("purge_inactive_customer_data", record_count=150)
    assert explanation.risk_level == RiskLevelEnum.CRITICAL
    assert explanation.clamped_score >= 75
    assert explanation.factors.scale_factor > 0


def test_risk_006_production_destructive_action():
    """RISK-006: Production destructive action must have higher risk than dev equivalent."""
    dev_settings = Settings(
        DATABASE_URL="postgresql://test:test@localhost:5432/testdb",
        APP_ENV="development",
    )
    prod_settings = Settings(
        DATABASE_URL="postgresql://test:test@localhost:5432/testdb",
        APP_ENV="production",
    )

    dev_engine = RiskEngine(settings=dev_settings)
    prod_engine = RiskEngine(settings=prod_settings)

    dev_exp = dev_engine.assess_risk("delete_customer", record_count=1)
    prod_exp = prod_engine.assess_risk("delete_customer", record_count=1)

    assert prod_exp.clamped_score > dev_exp.clamped_score
    assert dev_exp.risk_level == RiskLevelEnum.HIGH
    assert prod_exp.risk_level == RiskLevelEnum.CRITICAL
    assert prod_exp.factors.environment_factor > dev_exp.factors.environment_factor


# =============================================================================
# 2. DETERMINISM & RANGE CLAMPING
# =============================================================================


def test_risk_scoring_is_strictly_deterministic(risk_engine):
    """Verifies that scoring identical parameters 100 times produces identical results."""
    baseline = risk_engine.assess_risk("update_customer", record_count=1)
    for _ in range(100):
        current = risk_engine.assess_risk("update_customer", record_count=1)
        assert current.clamped_score == baseline.clamped_score
        assert current.risk_level == baseline.risk_level
        assert current.factors == baseline.factors


def test_risk_score_is_clamped_to_100_maximum():
    """Verifies extreme bulk destructive production operation clamps cleanly at 100."""
    prod_settings = Settings(
        DATABASE_URL="postgresql://test:test@localhost:5432/testdb",
        APP_ENV="production",
    )
    engine = RiskEngine(settings=prod_settings)
    explanation = engine.assess_risk(
        "purge_inactive_customer_data",
        record_count=50000,
        override_destructive=True,
        override_sensitivity=DataSensitivityEnum.RESTRICTED,
    )
    assert explanation.raw_score > 100
    assert explanation.clamped_score == 100
    assert explanation.risk_level == RiskLevelEnum.CRITICAL


# =============================================================================
# 3. TOOL RISK REGISTRY INVARIANTS
# =============================================================================


def test_trusted_tool_registry_integrity():
    """Validates that all 8 core tools are registered with complete profiles."""
    expected_tools = {
        "query_customer_records",
        "get_customer",
        "get_customer_orders",
        "get_order",
        "append_customer_audit_note",
        "update_customer",
        "delete_customer",
        "purge_inactive_customer_data",
    }
    assert expected_tools.issubset(set(TRUSTED_TOOL_REGISTRY.keys()))

    for tool_name in expected_tools:
        profile = get_tool_profile(tool_name)
        assert profile is not None
        assert 0 <= profile.base_risk <= 100
        assert isinstance(profile.destructive, bool)
        assert isinstance(profile.read_only, bool)
        assert isinstance(profile.external_side_effect, bool)
        assert profile.data_sensitivity in DataSensitivityEnum


def test_factor_explanation_breakdown(risk_engine):
    """Verifies that factor breakdown values sum exactly to raw_score."""
    exp = risk_engine.assess_risk("append_customer_audit_note", record_count=1)
    factor_sum = exp.factors.total()
    assert factor_sum == exp.raw_score
    assert exp.clamped_score == min(100, max(0, factor_sum))
    assert "append_customer_audit_note" in exp.summary
