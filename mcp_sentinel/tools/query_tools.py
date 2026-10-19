"""
Safe Read-Only Customer Query Tool for MCP-Sentinel.
Complies with:
- Section 7: Safe Read Tool.
- Read-only database operation.
- Structured filters & parameterized SQL.
- Approved projection columns only.
"""

from typing import Any, Optional

from mcp_sentinel.repositories.customer_repository import CustomerRepository
from mcp_sentinel.services.customer_service import CustomerService
from mcp_sentinel.tools.customer_tools import handle_query_customer_records as _handle_query


async def handle_query_customer_records(
    repo_or_args: Any = None,
    raw_args: Optional[dict[str, Any]] = None,
    repo: Optional[CustomerRepository] = None,
    service: Optional[CustomerService] = None,
) -> dict[str, Any]:
    """
    Executes customer querying with strict schema validation and error sanitization.
    Supports both Phase 1 and Phase 2 invocation signatures.
    """
    if isinstance(repo_or_args, dict) and raw_args is None:
        actual_raw_args = repo_or_args
    elif raw_args is not None:
        actual_raw_args = raw_args
        if repo_or_args is not None and not isinstance(repo_or_args, dict) and repo is None:
            repo = repo_or_args
    else:
        actual_raw_args = {}

    return await _handle_query(
        raw_args=actual_raw_args,
        service=service,
        repo=repo,
    )
