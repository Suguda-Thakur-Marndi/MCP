"""
Strict Pydantic Input Schemas for MCP-Sentinel Tools.
Complies with:
- Section 6: MCP Tool Input Validation (strict schemas, forbidden extras, range bounds).
- Security Rule #6: Validate every external/tool input.
"""

from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, field_validator


class CustomerStatusEnum(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
    PENDING = "pending"


class SortOrderEnum(str, Enum):
    ASC = "ASC"
    DESC = "DESC"


class CustomerFilter(BaseModel):
    """
    Structured criteria for querying customer records.
    Arbitrary SQL fragments or unexpected keys are forbidden.
    """

    model_config = ConfigDict(extra="forbid")

    status: CustomerStatusEnum | None = Field(
        default=None,
        description="Filter by customer account lifecycle status.",
    )
    country: str | None = Field(
        default=None,
        min_length=2,
        max_length=2,
        pattern=r"^[A-Za-z]{2}$",
        description="Filter by 2-letter ISO country code (e.g. 'US', 'IN', 'DE').",
    )
    customer_id: int | None = Field(
        default=None,
        ge=1,
        description="Filter by specific integer customer identifier.",
    )
    tier: str | None = Field(
        default=None,
        min_length=2,
        max_length=20,
        pattern=r"^[a-zA-Z0-9_\-]+$",
        description="Filter by customer tier (e.g. 'standard', 'enterprise').",
    )

    @field_validator("country")
    @classmethod
    def uppercase_country(cls, v: str | None) -> str | None:
        return v.upper() if v else None


class QueryCustomerRecordsInput(BaseModel):
    """
    Input schema for the read-only query_customer_records tool.
    """

    model_config = ConfigDict(extra="forbid")

    filters: CustomerFilter | None = Field(
        default=None,
        description="Structured, allow-listed filters. Arbitrary SQL is rejected.",
    )
    limit: int = Field(
        default=50,
        ge=1,
        le=100,
        description="Maximum number of customer records to return (1-100).",
    )
    offset: int = Field(
        default=0,
        ge=0,
        description="Number of records to skip for pagination.",
    )
    sort_by: str | None = Field(
        default="created_at",
        pattern=r"^(created_at|name|id|tier|status)$",
        description="Allow-listed column to sort results by.",
    )
    sort_order: SortOrderEnum | None = Field(
        default=SortOrderEnum.DESC,
        description="Sort direction: ASC or DESC.",
    )


class AppendCustomerAuditNoteInput(BaseModel):
    """
    Input schema for the append_customer_audit_note tool.
    """

    model_config = ConfigDict(extra="forbid")

    customer_id: int = Field(
        ...,
        ge=1,
        description="Target customer identifier.",
    )
    author_id: str = Field(
        ...,
        min_length=2,
        max_length=50,
        pattern=r"^[a-zA-Z0-9_\-\.]+$",
        description="Identifier of administrator or system creating the note.",
    )
    note_text: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="Audit note content (1-2000 characters).",
    )

    @field_validator("note_text")
    @classmethod
    def strip_and_validate_note(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Audit note text cannot be empty or solely whitespace.")
        return cleaned


class PurgeInactiveCustomerDataInput(BaseModel):
    """
    Input schema for the destructive purge_inactive_customer_data tool.
    """

    model_config = ConfigDict(extra="forbid")

    customer_id: int = Field(
        ...,
        ge=1,
        description="Identifier of the inactive customer to permanently delete.",
    )
    approval_ticket: str = Field(
        ...,
        min_length=8,
        max_length=64,
        pattern=r"^[a-zA-Z0-9_\-]+$",
        description="Server-validated Human-in-the-Loop authorization ticket.",
    )
    reason: str = Field(
        ...,
        min_length=5,
        max_length=500,
        description="Administrative justification for the destructive purge.",
    )

    @field_validator("reason")
    @classmethod
    def strip_and_validate_reason(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Purge justification reason cannot be empty.")
        return cleaned
