"""
Strict Pydantic schemas for customer operations in MCP-Sentinel Phase 2.
Complies with:
- Zero raw SQL input.
- Forbidden extra fields.
- Strong type, boundary, and format validation.
"""

from typing import Optional, Union

from pydantic import BaseModel, ConfigDict, Field, field_validator

from mcp_sentinel.schemas.common import (
    CustomerStatusEnum,
    SortOrderEnum,
    parse_customer_id,
)


class CustomerFilter(BaseModel):
    """
    Structured search criteria for querying customers.
    """

    model_config = ConfigDict(extra="forbid")

    status: Optional[CustomerStatusEnum] = Field(
        default=None,
        description="Filter by customer account status (active, inactive, suspended).",
    )
    country: Optional[str] = Field(
        default=None,
        min_length=2,
        max_length=2,
        pattern=r"^[A-Za-z]{2}$",
        description="Filter by 2-letter ISO country code.",
    )
    customer_id: Optional[Union[int, str]] = Field(
        default=None,
        description="Filter by customer ID (integer or 'CUST-XXXXXX').",
    )
    tier: Optional[str] = Field(
        default=None,
        min_length=2,
        max_length=20,
        pattern=r"^[a-zA-Z0-9_\-]+$",
        description="Filter by customer tier (e.g. standard, enterprise).",
    )

    @field_validator("country")
    @classmethod
    def uppercase_country(cls, v: Optional[str]) -> Optional[str]:
        return v.upper() if v else None

    @field_validator("customer_id")
    @classmethod
    def validate_and_parse_customer_id(cls, v: Optional[Union[int, str]]) -> Optional[int]:
        if v is None:
            return None
        return parse_customer_id(v)


class QueryCustomerRecordsInput(BaseModel):
    """
    Input schema for query_customer_records tool.
    """

    model_config = ConfigDict(extra="forbid")

    filters: Optional[CustomerFilter] = Field(
        default=None,
        description="Structured criteria. Arbitrary SQL is rejected.",
    )
    limit: int = Field(
        default=50,
        ge=1,
        le=100,
        description="Record count limit (1-100).",
    )
    offset: int = Field(
        default=0,
        ge=0,
        description="Pagination offset.",
    )
    sort_by: Optional[str] = Field(
        default="created_at",
        pattern=r"^(created_at|name|id|tier|status)$",
        description="Allow-listed column to sort results by.",
    )
    sort_order: Optional[SortOrderEnum] = Field(
        default=SortOrderEnum.DESC,
        description="Sort direction: ASC or DESC.",
    )


class GetCustomerInput(BaseModel):
    """
    Input schema for get_customer tool.
    """

    model_config = ConfigDict(extra="forbid")

    customer_id: Union[int, str] = Field(
        ...,
        description="Customer identifier (integer or formatted 'CUST-XXXXXX').",
    )

    @field_validator("customer_id")
    @classmethod
    def validate_customer_id(cls, v: Union[int, str]) -> int:
        return parse_customer_id(v)


class UpdateCustomerInput(BaseModel):
    """
    Input schema for update_customer tool.
    Restricted to allow-listed updatable fields only.
    """

    model_config = ConfigDict(extra="forbid")

    customer_id: Union[int, str] = Field(
        ...,
        description="Customer identifier (integer or formatted 'CUST-XXXXXX').",
    )
    status: Optional[CustomerStatusEnum] = Field(
        default=None,
        description="Updated lifecycle status.",
    )
    country: Optional[str] = Field(
        default=None,
        min_length=2,
        max_length=2,
        pattern=r"^[A-Za-z]{2}$",
        description="Updated 2-letter ISO country code.",
    )

    @field_validator("customer_id")
    @classmethod
    def validate_customer_id(cls, v: Union[int, str]) -> int:
        return parse_customer_id(v)

    @field_validator("country")
    @classmethod
    def uppercase_country(cls, v: Optional[str]) -> Optional[str]:
        return v.upper() if v else None


class DeleteCustomerInput(BaseModel):
    """
    Input schema for delete_customer tool.
    DESTRUCTIVE operation requiring server-validated approval ticket.
    """

    model_config = ConfigDict(extra="forbid")

    customer_id: Union[int, str] = Field(
        ...,
        description="Customer identifier to permanently delete.",
    )
    approval_ticket: Optional[str] = Field(
        default=None,
        description="Server-validated authorization ticket for DELETE_CUSTOMER action.",
    )
    reason: str = Field(
        ...,
        min_length=5,
        max_length=500,
        description="Administrative justification.",
    )

    @field_validator("approval_ticket")
    @classmethod
    def validate_approval_ticket(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        cleaned = v.strip()
        if not cleaned:
            return None
        if len(cleaned) < 8 or len(cleaned) > 64:
            raise ValueError("Approval ticket length must be between 8 and 64 characters.")
        import re

        if not re.match(r"^[a-zA-Z0-9_\-]+$", cleaned):
            raise ValueError("Approval ticket contains invalid characters.")
        return cleaned

    @field_validator("customer_id")
    @classmethod
    def validate_customer_id(cls, v: Union[int, str]) -> int:
        return parse_customer_id(v)

    @field_validator("reason")
    @classmethod
    def validate_reason(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Reason cannot be empty.")
        return cleaned


class PurgeInactiveCustomerDataInput(BaseModel):
    """
    Input schema for purge_inactive_customer_data tool.
    HIGH-RISK DESTRUCTIVE operation requiring server-validated approval ticket.
    Supports either bulk inactivity_days or specific customer_id.
    """

    model_config = ConfigDict(extra="forbid")

    customer_id: Optional[Union[int, str]] = Field(
        default=None,
        description="Specific inactive customer ID to purge, if targeting single customer.",
    )
    inactivity_days: Optional[int] = Field(
        default=None,
        ge=1,
        le=3650,
        description="Purge customers inactive for at least this number of days (1-3650).",
    )
    approval_ticket: Optional[str] = Field(
        default=None,
        description="Server-validated authorization ticket for PURGE action.",
    )
    reason: Optional[str] = Field(
        default="Dormant account compliance purge",
        min_length=5,
        max_length=500,
        description="Administrative justification for purge.",
    )
    dry_run: bool = Field(
        default=False,
        description="If True, returns count of matched records without deleting.",
    )

    @field_validator("approval_ticket")
    @classmethod
    def validate_approval_ticket(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        cleaned = v.strip()
        if not cleaned:
            return None
        if len(cleaned) < 8 or len(cleaned) > 64:
            raise ValueError("Approval ticket length must be between 8 and 64 characters.")
        import re

        if not re.match(r"^[a-zA-Z0-9_\-]+$", cleaned):
            raise ValueError("Approval ticket contains invalid characters.")
        return cleaned

    @field_validator("customer_id")
    @classmethod
    def validate_customer_id(cls, v: Optional[Union[int, str]]) -> Optional[int]:
        if v is None:
            return None
        return parse_customer_id(v)
