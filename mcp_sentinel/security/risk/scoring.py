"""
Deterministic Risk Scoring Logic for MCP-Sentinel Phase 4.
Calculates factor-weighted scores, clamps to 0–100, and maps to categorical risk levels.
"""

from typing import Optional

from mcp_sentinel.config.settings import Settings, get_settings
from mcp_sentinel.security.decisions.models import RiskLevelEnum
from mcp_sentinel.security.risk.factors import (
    DATA_SENSITIVITY_WEIGHTS,
    DESTRUCTIVE_FACTOR_WEIGHT,
    ENVIRONMENT_WEIGHTS,
    EXTERNAL_SIDE_EFFECT_WEIGHT,
    calculate_scale_factor,
)
from mcp_sentinel.security.risk.models import (
    DataSensitivityEnum,
    RiskExplanation,
    RiskFactors,
    ToolRiskProfile,
)


def score_to_risk_level(
    score: int,
    low_max: Optional[int] = None,
    medium_max: Optional[int] = None,
    high_max: Optional[int] = None,
    settings: Optional[Settings] = None,
) -> RiskLevelEnum:
    """
    Maps a numerical risk score (0-100) to RiskLevelEnum using configurable thresholds.
    Thresholds are configuration-driven, not scattered magic numbers.
    """
    cfg = settings or get_settings()
    l_max = low_max if low_max is not None else cfg.RISK_LOW_MAX
    m_max = medium_max if medium_max is not None else cfg.RISK_MEDIUM_MAX
    h_max = high_max if high_max is not None else cfg.RISK_HIGH_MAX

    if score <= l_max:
        return RiskLevelEnum.LOW
    if score <= m_max:
        return RiskLevelEnum.MEDIUM
    if score <= h_max:
        return RiskLevelEnum.HIGH
    return RiskLevelEnum.CRITICAL


def calculate_risk(
    profile: Optional[ToolRiskProfile],
    destructive: bool,
    data_sensitivity: DataSensitivityEnum,
    environment: str,
    record_count: int = 1,
    external_side_effect: bool = False,
    settings: Optional[Settings] = None,
) -> RiskExplanation:
    """
    Computes deterministic risk score and factor breakdown for an operation.
    Guarantees:
    1. Determinism: Identical inputs yield identical scores.
    2. Range clamping: Output score is strictly within [0, 100].
    3. Fail-closed on unknown profile: Unknown profiles are assigned base risk 50.
    """
    cfg = settings or get_settings()

    # Base tool risk (defaults to 50 for unknown tools to fail conservative)
    base_risk = profile.base_risk if profile is not None else 50

    # Destructive factor
    destructive_factor = DESTRUCTIVE_FACTOR_WEIGHT if destructive else 0

    # Data sensitivity factor
    data_sensitivity_factor = DATA_SENSITIVITY_WEIGHTS.get(data_sensitivity, 5)

    # Environment factor (default to 0 for unknown environment)
    env_clean = (environment or cfg.APP_ENV).lower()
    environment_factor = ENVIRONMENT_WEIGHTS.get(env_clean, 0)

    # Scale factor
    scale_factor = calculate_scale_factor(
        record_count=record_count,
        bulk_threshold=cfg.BULK_OPERATION_THRESHOLD,
        critical_threshold=cfg.CRITICAL_OPERATION_THRESHOLD,
    )

    # External side effect factor
    side_effect_factor = EXTERNAL_SIDE_EFFECT_WEIGHT if external_side_effect else 0

    factors = RiskFactors(
        tool_base_risk=base_risk,
        destructive_factor=destructive_factor,
        data_sensitivity_factor=data_sensitivity_factor,
        environment_factor=environment_factor,
        scale_factor=scale_factor,
        external_side_effect_factor=side_effect_factor,
    )

    raw_score = factors.total()
    clamped_score = max(0, min(100, raw_score))
    level = score_to_risk_level(clamped_score, settings=cfg)

    tool_name = profile.tool_name if profile else "unknown_tool"
    summary = (
        f"Tool '{tool_name}' evaluated to risk score {clamped_score} ({level.value}) "
        f"[base={base_risk}, dest={destructive_factor}, sens={data_sensitivity_factor}, "
        f"env={environment_factor}, scale={scale_factor}, side_effects={side_effect_factor}]"
    )

    return RiskExplanation(
        raw_score=raw_score,
        clamped_score=clamped_score,
        risk_level=level,
        factors=factors,
        summary=summary,
    )
