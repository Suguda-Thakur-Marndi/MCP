"""
Strongly typed Security Decision Models for MCP-Sentinel Phase 4.
Defines authoritative decisions, risk levels, and decision result structures.
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class SecurityDecisionEnum(str, Enum):
    """
    Authoritative security decisions produced by the Policy Engine.
    Precedence order: DENY > REQUIRE_MFA > REQUIRE_APPROVAL > ALLOW.
    """

    ALLOW = "ALLOW"
    DENY = "DENY"
    REQUIRE_APPROVAL = "REQUIRE_APPROVAL"
    REQUIRE_MFA = "REQUIRE_MFA"


class RiskLevelEnum(str, Enum):
    """
    Categorical risk level classification based on deterministic risk scoring.
    """

    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class SecurityDecision(BaseModel):
    """
    Complete security decision produced by the Policy Engine.
    Contains authoritative decision, risk assessment, policy lineage, and audit details.
    """

    model_config = ConfigDict(frozen=True, extra="forbid")

    decision: SecurityDecisionEnum = Field(
        ...,
        description="Authoritative security decision (ALLOW, DENY, REQUIRE_APPROVAL, REQUIRE_MFA).",
    )
    reason: str = Field(
        ...,
        description="Human-readable explanation of the security decision.",
    )
    risk_score: int = Field(
        ...,
        ge=0,
        le=100,
        description="Deterministic risk score clamped to 0–100.",
    )
    risk_level: RiskLevelEnum = Field(
        ...,
        description="Categorical risk level (LOW, MEDIUM, HIGH, CRITICAL).",
    )
    policy_id: str = Field(
        ...,
        description="Identifier of the policy that evaluated the request.",
    )
    policy_version: str = Field(
        ...,
        description="Version of the evaluating policy for audit traceability.",
    )
    matched_rules: list[str] = Field(
        default_factory=list,
        description="List of rule IDs triggered during evaluation.",
    )
    request_id: str = Field(
        ...,
        description="Correlation ID for end-to-end request tracing.",
    )
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="UTC timestamp when the decision was rendered.",
    )
    factors: dict[str, Any] = Field(
        default_factory=dict,
        description="Internal breakdown of scoring factors for debugging and auditing.",
    )

    def to_external_dict(self) -> dict[str, Any]:
        """
        Returns a sanitized dictionary safe for external callers (AI agent, client).
        Omits internal scoring mechanisms and sensitive infrastructure factors.
        """
        return {
            "decision": self.decision.value,
            "reason": self.reason,
            "risk_score": self.risk_score,
            "risk_level": self.risk_level.value,
            "policy_id": self.policy_id,
            "policy_version": self.policy_version,
            "matched_rules": self.matched_rules,
            "request_id": self.request_id,
        }

    def to_audit_dict(self) -> dict[str, Any]:
        """
        Returns the complete decision structure for secure internal audit logging.
        """
        return {
            "decision": self.decision.value,
            "reason": self.reason,
            "risk_score": self.risk_score,
            "risk_level": self.risk_level.value,
            "policy_id": self.policy_id,
            "policy_version": self.policy_version,
            "matched_rules": self.matched_rules,
            "request_id": self.request_id,
            "timestamp": self.timestamp.isoformat(),
            "factors": self.factors,
        }
