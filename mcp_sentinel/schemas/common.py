"""
Common schemas, enums, and identifier parsing for MCP-Sentinel.
"""

import re
from enum import Enum
from typing import Union


class CustomerStatusEnum(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
    PENDING = "pending"
    CLOSED = "closed"
    BANNED = "banned"


HIGH_IMPACT_CUSTOMER_STATUSES = frozenset({"suspended", "closed", "banned"})


class OrderStatusEnum(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"


class SortOrderEnum(str, Enum):
    ASC = "ASC"
    DESC = "DESC"


def parse_customer_id(customer_id: Union[int, str]) -> int:
    """
    Parses either an integer customer ID (e.g. 1) or formatted code ('CUST-000001')
    into the underlying integer identifier.
    """
    if isinstance(customer_id, int):
        if customer_id <= 0:
            raise ValueError("customer_id must be a positive integer.")
        return customer_id

    val = str(customer_id).strip()
    if not val:
        raise ValueError("customer_id cannot be empty.")

    # Match CUST-XXXXXX
    m = re.match(r"^CUST-(\d+)$", val, re.IGNORECASE)
    if m:
        return int(m.group(1))

    # Match pure integer string
    if val.isdigit():
        parsed = int(val)
        if parsed <= 0:
            raise ValueError("customer_id must be a positive integer.")
        return parsed

    raise ValueError(
        f"Invalid customer identifier format: '{customer_id}'. Expected integer or 'CUST-XXXXXX'."
    )
