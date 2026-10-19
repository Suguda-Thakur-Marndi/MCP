"""
Strict Pydantic schemas for audit operations and notes in MCP-Sentinel Phase 2.
Complies with:
- Treating audit notes as untrusted data (no instruction execution).
- Strong input validation and bounded text lengths.
- Request correlation and audit event recording.
"""

from datetime import datetime
from typing import Any, Optional, Union

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from mcp_sentinel.schemas.common import parse_customer_id


class AppendCustomerAuditNoteInput(BaseModel):
    """
    Input schema for append_customer_audit_note tool.
    Accepts customer_id (integer or 'CUST-XXXXXX') and note content.
    Maintains backward compatibility with Phase 1 fields (note_text, author_id).
    """

    model_config = ConfigDict(extra="forbid")

    customer_id: Union[int, str] = Field(
        ...,
        description="Target customer identifier (integer or 'CUST-XXXXXX').",
    )
    note: Optional[str] = Field(
        default=None,
        max_length=2000,
        description="Audit note text. Untrusted content treated strictly as passive data.",
    )
    # Phase 1 backward compatibility fields
    note_text: Optional[str] = Field(
        default=None,
        max_length=2000,
        description="Alternative field name for audit note content (Phase 1 compat).",
    )
    author_id: Optional[str] = Field(
        default="agent",
        max_length=64,
        description="Identifier of the actor or agent creating the note.",
    )

    @field_validator("customer_id")
    @classmethod
    def validate_customer_id(cls, v: Union[int, str]) -> int:
        return parse_customer_id(v)

    @model_validator(mode="after")
    def resolve_note_text(self) -> "AppendCustomerAuditNoteInput":
        content = self.note or self.note_text
        if not content or not content.strip():
            raise ValueError("Audit note text cannot be empty.")
        if len(content.strip()) > 2000:
            raise ValueError("Audit note exceeds maximum length of 2000 characters.")
        # Normalize both fields to the resolved text
        self.note = content.strip()
        self.note_text = content.strip()
        if not self.author_id or not self.author_id.strip():
            self.author_id = "agent"
        return self


class AuditEventRecord(BaseModel):
    """
    Structured record representing a security or tool audit event.
    """

    model_config = ConfigDict(extra="forbid")

    id: Optional[int] = None
    event_type: str = Field(..., max_length=64)
    actor_type: str = Field(default="mcp_client", max_length=32)
    actor_id: Optional[str] = Field(default=None, max_length=128)
    tool_name: str = Field(..., max_length=64)
    decision: str = Field(..., max_length=32)
    request_id: Optional[str] = Field(default=None, max_length=64)
    details: Optional[dict[str, Any]] = None
    created_at: Optional[datetime] = None
