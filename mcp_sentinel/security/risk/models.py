"""
Risk models and data sensitivity definitions for MCP-Sentinel Phase 4.
"""

from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from mcp_sentinel.security.decisions.models import RiskLevelEnum


class DataSensitivityEnum(str, Enum):
    """
    Data sensitivity classification for resources and operations.
    Controls data sensitivity scoring factor and access gating.
    """

    PUBLIC = "PUBLIC"
    INTERNAL = "INTERNAL"
    CONFIDENTIAL = "CONFIDENTIAL"
    SENSITIVE = "SENSITIVE"
    RESTRICTED = "RESTRICTED"


class ToolRiskProfile(BaseModel):
    """
    Server-authoritative risk profile for an MCP tool.
    Never trusts annotations or parameters provided by the client or agent.
    """

    model_config = ConfigDict(frozen=True, extra="forbid")

    tool_name: str = Field(..., description="Unique name of the MCP tool.")
    base_risk: int = Field(..., ge=0, le=100, description="Baseline risk score (0-100).")
    read_only: bool = Field(..., description="Whether the tool only performs read operations.")
    destructive: bool = Field(
        ..., description="Whether the tool alters or deletes data irreversibly."
    )
    external_side_effect: bool = Field(
        ..., description="Whether the tool produces persistent side effects outside reads."
    )
    data_sensitivity: DataSensitivityEnum = Field(
        default=DataSensitivityEnum.CONFIDENTIAL,
        description="Highest sensitivity of data accessed by this tool.",
    )
    operation_type: str = Field(
        default="read",
        description="Type of operation performed: read, create, update, delete, purge.",
    )
    resource_type: str = Field(
        default="customer",
        description="Target resource domain: customer, order, audit_note, system.",
    )
    max_allowed_scope: Optional[int] = Field(
        default=None,
        description="Maximum permissible records in a single execution scope.",
    )


class RiskFactors(BaseModel):
    """
    Breakdown of deterministic factors contributing to the final risk score.
    """

    model_config = ConfigDict(frozen=True)

    tool_base_risk: int = Field(..., description="Base risk from trusted tool profile.")
    destructive_factor: int = Field(..., description="Factor added for destructive operations.")
    data_sensitivity_factor: int = Field(
        ..., description="Factor added for data sensitivity level."
    )
    environment_factor: int = Field(..., description="Factor added for runtime environment.")
    scale_factor: int = Field(..., description="Factor added based on record count / scope.")
    external_side_effect_factor: int = Field(
        ..., description="Factor added for external mutations and side effects."
    )

    def total(self) -> int:
        return (
            self.tool_base_risk
            + self.destructive_factor
            + self.data_sensitivity_factor
            + self.environment_factor
            + self.scale_factor
            + self.external_side_effect_factor
        )

    def to_dict(self) -> dict[str, int]:
        return {
            "tool_base_risk": self.tool_base_risk,
            "destructive_factor": self.destructive_factor,
            "data_sensitivity_factor": self.data_sensitivity_factor,
            "environment_factor": self.environment_factor,
            "scale_factor": self.scale_factor,
            "external_side_effect_factor": self.external_side_effect_factor,
        }


class RiskExplanation(BaseModel):
    """
    Deterministic risk calculation outcome with factor breakdown.
    """

    model_config = ConfigDict(frozen=True)

    raw_score: int = Field(..., description="Calculated sum of all risk factors.")
    clamped_score: int = Field(..., ge=0, le=100, description="Score clamped to 0–100.")
    risk_level: RiskLevelEnum = Field(..., description="Categorical risk level classification.")
    factors: RiskFactors = Field(..., description="Breakdown of individual contributing factors.")
    summary: str = Field(..., description="Concise text explanation of the risk score.")
