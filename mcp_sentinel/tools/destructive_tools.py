"""
Destructive Customer Purge Tool for MCP-Sentinel.
Complies with:
- Section 9: Destructive Tool Protection.
- Section 10: Fail-Closed Security.
- Server-side authorization verification via gating tickets.
- Zero reliance on client-provided assertions.
"""

from typing import Any, Optional

from mcp_sentinel.repositories.approval_repository import ApprovalRepository
from mcp_sentinel.repositories.customer_repository import CustomerRepository
from mcp_sentinel.services.customer_service import CustomerService
from mcp_sentinel.tools.customer_tools import handle_purge_inactive_customer_data as _handle_purge


async def handle_purge_inactive_customer_data(
    customer_repo_or_args: Any = None,
    approval_repo: Optional[ApprovalRepository] = None,
    raw_args: Optional[dict[str, Any]] = None,
    customer_repo: Optional[CustomerRepository] = None,
    service: Optional[CustomerService] = None,
) -> dict[str, Any]:
    """
    Executes permanent customer data purge only after strict server-side authorization check.
    Supports both Phase 1 and Phase 2 invocation signatures.
    """
    if isinstance(customer_repo_or_args, dict) and raw_args is None:
        actual_raw_args = customer_repo_or_args
    elif raw_args is not None:
        actual_raw_args = raw_args
        if (
            customer_repo_or_args is not None
            and not isinstance(customer_repo_or_args, dict)
            and customer_repo is None
        ):
            customer_repo = customer_repo_or_args
    else:
        actual_raw_args = {}

    return await _handle_purge(
        raw_args=actual_raw_args,
        service=service,
        customer_repo=customer_repo,
        approval_repo=approval_repo,
    )
