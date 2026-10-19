"""
Risk Engine for MCP-Sentinel Phase 4.
Evaluates risk profiles, computes deterministic factor breakdowns, and determines risk levels.
"""

from typing import Optional

from mcp_sentinel.config.settings import Settings, get_settings
from mcp_sentinel.security.risk.factors import get_tool_profile
from mcp_sentinel.security.risk.models import (
    DataSensitivityEnum,
    RiskExplanation,
    ToolRiskProfile,
)
from mcp_sentinel.security.risk.scoring import calculate_risk


class RiskEngine:
    """
    Server-authoritative Risk Engine.
    Computes deterministic risk assessments independent of client claims.
    """

    def __init__(self, settings: Optional[Settings] = None):
        self._settings = settings or get_settings()

    def assess_risk(
        self,
        tool_name: str,
        record_count: int = 1,
        environment: Optional[str] = None,
        override_destructive: Optional[bool] = None,
        override_sensitivity: Optional[DataSensitivityEnum] = None,
    ) -> RiskExplanation:
        """
        Assesses risk for a tool execution request.
        Loads the trusted server-side profile.
        If override_destructive is provided, it is combined safely (cannot mark a destructive tool as non-destructive).
        """
        profile: Optional[ToolRiskProfile] = get_tool_profile(tool_name)

        # Destructive status: trusted profile takes precedence; cannot be downgraded by agent
        is_destructive = profile.destructive if profile else False
        if override_destructive is True:
            is_destructive = True

        # Data sensitivity: cannot be downgraded below profile level
        sensitivity = profile.data_sensitivity if profile else DataSensitivityEnum.CONFIDENTIAL
        if override_sensitivity is not None:
            # Pick highest sensitivity
            if (
                override_sensitivity == DataSensitivityEnum.RESTRICTED
                or sensitivity != DataSensitivityEnum.RESTRICTED
            ):
                sensitivity = override_sensitivity

        has_external_effects = profile.external_side_effect if profile else True
        env = environment or self._settings.APP_ENV

        return calculate_risk(
            profile=profile,
            destructive=is_destructive,
            data_sensitivity=sensitivity,
            environment=env,
            record_count=record_count,
            external_side_effect=has_external_effects,
            settings=self._settings,
        )
