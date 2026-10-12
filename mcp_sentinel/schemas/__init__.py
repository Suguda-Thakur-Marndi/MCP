"""
Schemas package for MCP-Sentinel.
Contains strongly typed Pydantic request and response models across all domains.
"""

from mcp_sentinel.schemas.approval import (
    ApprovalDecisionInput,
    ApprovalExecutionRequest,
    ApprovalFilter,
    ApprovalRequestCreate,
    ApprovalResponse,
    ApprovalStatusEnum,
    compute_approval_hmac,
    compute_parameter_hash,
)
from mcp_sentinel.schemas.audit import (
    AppendCustomerAuditNoteInput,
    AuditEventRecord,
)
from mcp_sentinel.schemas.common import (
    CustomerStatusEnum,
    OrderStatusEnum,
    SortOrderEnum,
    parse_customer_id,
)
from mcp_sentinel.schemas.customer import (
    CustomerFilter,
    DeleteCustomerInput,
    GetCustomerInput,
    PurgeInactiveCustomerDataInput,
    QueryCustomerRecordsInput,
    UpdateCustomerInput,
)
from mcp_sentinel.schemas.order import (
    GetCustomerOrdersInput,
    GetOrderInput,
)

__all__ = [
    "AppendCustomerAuditNoteInput",
    "ApprovalDecisionInput",
    "ApprovalExecutionRequest",
    "ApprovalFilter",
    "ApprovalRequestCreate",
    "ApprovalResponse",
    "ApprovalStatusEnum",
    "AuditEventRecord",
    "CustomerFilter",
    "CustomerStatusEnum",
    "DeleteCustomerInput",
    "GetCustomerInput",
    "GetCustomerOrdersInput",
    "GetOrderInput",
    "OrderStatusEnum",
    "PurgeInactiveCustomerDataInput",
    "QueryCustomerRecordsInput",
    "SortOrderEnum",
    "UpdateCustomerInput",
    "compute_approval_hmac",
    "compute_parameter_hash",
    "parse_customer_id",
]
