"""
Tools package for MCP-Sentinel Phase 2.
"""

from mcp_sentinel.tools.audit_tools import handle_append_customer_audit_note
from mcp_sentinel.tools.customer_tools import (
    handle_delete_customer,
    handle_get_customer,
    handle_purge_inactive_customer_data,
    handle_query_customer_records,
    handle_update_customer,
)
from mcp_sentinel.tools.order_tools import (
    handle_get_customer_orders,
    handle_get_order,
)
from mcp_sentinel.tools.schemas import (
    AppendCustomerAuditNoteInput,
    CustomerFilter,
    CustomerStatusEnum,
    PurgeInactiveCustomerDataInput,
    QueryCustomerRecordsInput,
    SortOrderEnum,
)

__all__ = [
    "AppendCustomerAuditNoteInput",
    "CustomerFilter",
    "CustomerStatusEnum",
    "PurgeInactiveCustomerDataInput",
    "QueryCustomerRecordsInput",
    "SortOrderEnum",
    "handle_append_customer_audit_note",
    "handle_delete_customer",
    "handle_get_customer",
    "handle_get_customer_orders",
    "handle_get_order",
    "handle_purge_inactive_customer_data",
    "handle_query_customer_records",
    "handle_update_customer",
]
