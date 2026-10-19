"""
Pydantic Schemas and Cryptographic Hashing for Approval Workflows in MCP-Sentinel.
Complies with:
- Deterministic canonical parameter hashing (recursive sorting & compact JSON).
- Strongly typed approval states.
- Separation of concerns between requester, approver, and agent.
- Complete lifecycle tracking fields for audit and concurrency safety.
"""

import hashlib
import json
from datetime import datetime
from enum import Enum
from typing import Any, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class ApprovalStatusEnum(str, Enum):
    """Lifecycle states for human approval requests."""

    PENDING = "PENDING"
    APPROVED = "APPROVED"
    DENIED = "DENIED"
    EXPIRED = "EXPIRED"
    CANCELLED = "CANCELLED"
    EXECUTING = "EXECUTING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


def _canonicalize_value(val: Any) -> Any:
    """Recursively canonicalizes dictionary keys and collections for deterministic hashing."""
    if isinstance(val, dict):
        return {str(k): _canonicalize_value(v) for k, v in sorted(val.items())}
    elif isinstance(val, (list, tuple)):
        return [_canonicalize_value(v) for v in val]
    elif isinstance(val, (int, float, str, bool)) or val is None:
        return val
    else:
        return str(val)


def compute_parameter_hash(parameters: Optional[dict[str, Any]]) -> str:
    """
    Computes a canonical SHA-256 hash of the execution arguments.
    Keys are sorted recursively and serialized compactly to ensure deterministic hashing.
    An approval granted for parameters A cannot authorize modified parameters B.
    """
    if not parameters:
        serialized = "{}"
    else:
        canonical = _canonicalize_value(parameters)
        serialized = json.dumps(
            canonical, sort_keys=True, separators=(",", ":"), ensure_ascii=True, default=str
        )
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def compute_approval_hmac(
    ticket_id: str,
    action: str,
    target_id: str,
    parameter_hash: str,
    approver_id: Optional[str] = None,
    secret: Optional[str] = None,
) -> str:
    """
    Computes an HMAC-SHA256 signature for an approval ticket or decision.
    Binds ticket_id, action, target_id, parameter_hash, and approver_id with the server secret.
    """
    import hmac

    from mcp_sentinel.config.settings import get_settings

    key = (secret or get_settings().APPROVAL_HMAC_SECRET).encode("utf-8")
    approver_part = approver_id.strip() if approver_id else ""
    payload = f"{ticket_id.strip()}:{action.strip()}:{str(target_id).strip()}:{parameter_hash.strip()}:{approver_part}".encode(
        "utf-8"
    )
    return hmac.new(key, payload, hashlib.sha256).hexdigest()


class ApprovalRequestCreate(BaseModel):
    """Payload to create a new human approval request ticket."""

    request_id: Optional[str] = Field(default=None, max_length=64)
    agent_id: str = Field(default="gemini-agent-v1", max_length=64)
    requester_id: Optional[str] = Field(default=None, max_length=64)
    tool_name: str = Field(..., min_length=1, max_length=100)
    target_id: str = Field(..., min_length=1, max_length=64)
    action: str = Field(..., min_length=1, max_length=50)
    parameters: dict[str, Any] = Field(default_factory=dict)
    environment: str = Field(default="development", max_length=32)
    policy_id: str = Field(default="sentinel-core-policy", max_length=64)
    policy_version: str = Field(default="1.0.0", max_length=32)
    risk_level: str = Field(default="HIGH", max_length=20)
    risk_score: int = Field(default=75, ge=0, le=100)
    reason: str = Field(..., min_length=3, max_length=1000)
    ttl_seconds: int = Field(default=3600, ge=60, le=86400)
    correlation_id: Optional[str] = Field(default=None, max_length=64)


class ApprovalDecisionInput(BaseModel):
    """Payload to approve or deny a pending ticket."""

    decision: Optional[Literal["APPROVED", "DENIED"]] = None
    decision_notes: Optional[str] = Field(default=None, max_length=1000)


class ApprovalResponse(BaseModel):
    """Structured response representing an approval request record."""

    id: Optional[UUID] = None
    ticket_id: str
    request_id: str
    agent_id: str
    requester_id: str
    approver_id: Optional[str] = None
    tool_name: str
    target_id: str
    action: str
    parameters: dict[str, Any]
    parameter_hash: str
    environment: str
    policy_id: str
    policy_version: str
    risk_level: str
    risk_score: int
    status: ApprovalStatusEnum
    reason: str
    decision_notes: Optional[str] = None
    created_at: datetime
    expires_at: datetime
    decided_at: Optional[datetime] = None
    executed_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    denied_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    execution_started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    failure_reason: Optional[str] = None
    approval_token_hash: Optional[str] = None
    approval_token: Optional[str] = None
    execution_id: Optional[str] = None
    correlation_id: Optional[str] = None
    signature: Optional[str] = None

    @field_validator(
        "created_at",
        "expires_at",
        "decided_at",
        "executed_at",
        "approved_at",
        "denied_at",
        "cancelled_at",
        "execution_started_at",
        "completed_at",
        mode="before",
    )
    @classmethod
    def parse_datetime(cls, v: Any) -> Any:
        if isinstance(v, str):
            return datetime.fromisoformat(v)
        return v


class ApprovalFilter(BaseModel):
    """Filters for querying approval tickets."""

    status: Optional[ApprovalStatusEnum] = None
    tool_name: Optional[str] = None
    limit: int = Field(default=50, ge=1, le=100)
    offset: int = Field(default=0, ge=0)


class ApprovalExecutionRequest(BaseModel):
    """Structured payload for executing an approved operation."""

    ticket_id: str
    tool_name: str
    action: str
    target_id: str
    environment: Optional[str] = "development"
    parameters: dict[str, Any] = Field(default_factory=dict)
    approval_token: Optional[str] = None
