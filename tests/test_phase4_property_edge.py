"""
Phase 4 Property-Based and Edge Boundary Tests.
Validates boundary values for record counts, score thresholds, clamping, and data sensitivity.
"""

import pytest

from mcp_sentinel.config.settings import Settings
from mcp_sentinel.security.decisions.models import RiskLevelEnum
from mcp_sentinel.security.risk.factors import calculate_scale_factor
from mcp_sentinel.security.risk.models import DataSensitivityEnum
from mcp_sentinel.security.risk.scoring import calculate_risk, score_to_risk_level

# =============================================================================
# 1. RECORD COUNT SCOPE BOUNDARY TESTS
# =============================================================================


@pytest.mark.parametrize(
    "count,expected_scale",
    [
        (0, 0),
        (1, 0),
        (2, 5),
        (99, 5),  # BULK_THRESHOLD - 1
        (100, 15),  # BULK_THRESHOLD
        (101, 15),  # BULK_THRESHOLD + 1
        (999, 15),  # CRITICAL_THRESHOLD - 1
        (1000, 30),  # CRITICAL_THRESHOLD
        (1001, 30),  # CRITICAL_THRESHOLD + 1
        (50000, 30),  # Extreme bulk
    ],
)
def test_scale_factor_boundaries(count, expected_scale):
    scale = calculate_scale_factor(record_count=count, bulk_threshold=100, critical_threshold=1000)
    assert scale == expected_scale, (
        f"Scale factor for count={count} expected {expected_scale}, got {scale}"
    )


# =============================================================================
# 2. RISK SCORE THRESHOLD BOUNDARY TESTS
# =============================================================================


@pytest.mark.parametrize(
    "score,expected_level",
    [
        (0, RiskLevelEnum.LOW),
        (1, RiskLevelEnum.LOW),
        (23, RiskLevelEnum.LOW),
        (24, RiskLevelEnum.LOW),  # RISK_LOW_MAX
        (25, RiskLevelEnum.MEDIUM),  # RISK_LOW_MAX + 1
        (48, RiskLevelEnum.MEDIUM),
        (49, RiskLevelEnum.MEDIUM),  # RISK_MEDIUM_MAX
        (50, RiskLevelEnum.HIGH),  # RISK_MEDIUM_MAX + 1
        (73, RiskLevelEnum.HIGH),
        (74, RiskLevelEnum.HIGH),  # RISK_HIGH_MAX
        (75, RiskLevelEnum.CRITICAL),  # RISK_HIGH_MAX + 1
        (99, RiskLevelEnum.CRITICAL),
        (100, RiskLevelEnum.CRITICAL),
    ],
)
def test_score_to_risk_level_boundaries(score, expected_level):
    settings = Settings(
        DATABASE_URL="postgresql://test:test@localhost:5432/testdb",
        RISK_LOW_MAX=24,
        RISK_MEDIUM_MAX=49,
        RISK_HIGH_MAX=74,
        RISK_CRITICAL_MAX=100,
    )
    level = score_to_risk_level(score, settings=settings)
    assert level == expected_level, (
        f"Score {score} expected {expected_level.value}, got {level.value}"
    )


# =============================================================================
# 3. RANGE CLAMPING EDGE TESTS
# =============================================================================


def test_negative_or_extreme_scores_clamp_correctly():
    """Validates that scores cannot escape [0, 100]."""
    # Negative factors simulation (e.g. if custom negative factor introduced)
    # calculate_risk clamps raw_score min 0, max 100
    res_zero = calculate_risk(
        profile=None,
        destructive=False,
        data_sensitivity=DataSensitivityEnum.PUBLIC,
        environment="development",
        record_count=0,
        external_side_effect=False,
    )
    assert 0 <= res_zero.clamped_score <= 100

    # Over 100 raw score
    res_high = calculate_risk(
        profile=None,
        destructive=True,
        data_sensitivity=DataSensitivityEnum.RESTRICTED,
        environment="production",
        record_count=10000,
        external_side_effect=True,
    )
    assert res_high.raw_score > 100
    assert res_high.clamped_score == 100
