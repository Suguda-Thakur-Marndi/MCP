"""
Strict Pydantic schemas for order operations in MCP-Sentinel Phase 2.
"""

from typing import Union

from pydantic import BaseModel, ConfigDict, Field, field_validator

from mcp_sentinel.schemas.common import parse_customer_id


class GetCustomerOrdersInput(BaseModel):
    """
    Input schema for get_customer_orders tool.
    """

    model_config = ConfigDict(extra="forbid")

    customer_id: Union[int, str] = Field(
        ...,
        description="Customer identifier (integer or formatted 'CUST-XXXXXX').",
    )
    limit: int = Field(
        default=50,
        ge=1,
        le=100,
        description="Maximum orders to retrieve (1-100).",
    )
    offset: int = Field(
        default=0,
        ge=0,
        description="Pagination offset.",
    )

    @field_validator("customer_id")
    @classmethod
    def validate_customer_id(cls, v: Union[int, str]) -> int:
        return parse_customer_id(v)


class GetOrderInput(BaseModel):
    """
    Input schema for get_order tool.
    """

    model_config = ConfigDict(extra="forbid")

    order_id: Union[int, str] = Field(
        ...,
        description="Order identifier (e.g. 'ORD-000001' or integer ID).",
    )

    @field_validator("order_id")
    @classmethod
    def validate_order_id(cls, v: Union[int, str]) -> str:
        s = str(v).strip()
        if not s:
            raise ValueError("order_id cannot be empty.")
        if s.isdigit():
            return f"ORD-{int(s):06d}"
        import re

        if not re.match(r"^ORD-[A-Za-z0-9_\-]+$", s, re.IGNORECASE):
            raise ValueError(f"Invalid order identifier format: '{s}'. Expected 'ORD-XXXXXX'.")
        return s.upper()
