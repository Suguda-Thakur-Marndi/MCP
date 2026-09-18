"""
Category F: Safe Error Handling & Information Leakage Defense Tests.
Complies with:
- Security Rule #9: Do not expose stack traces or secrets to users.
- Information disclosure prevention (no table names, SQL syntax, DSNs in errors).
"""

import pytest

from mcp_sentinel.security.exceptions import (
    AuthorizationDeniedError,
    DatabaseOperationError,
)
from mcp_sentinel.tools.query_tools import handle_query_customer_records


def test_database_operation_error_safe_client_message():
    """Verifies DatabaseOperationError masks internal driver details."""
    internal = "asyncpg.exceptions.UndefinedTableError: relation 'secret_table' does not exist"
    err = DatabaseOperationError(internal_details=internal)

    # Safe message for caller
    assert err.safe_message == "Unable to complete the requested database operation."
    assert "secret_table" not in err.safe_message
    assert "asyncpg" not in err.safe_message

    # Internal details retained
    assert err.internal_details == internal

    payload = err.to_dict()
    assert payload["status"] == "error"
    assert "secret_table" not in payload["message"]


def test_authorization_denied_error_safe_message():
    """Verifies AuthorizationDeniedError presents clean refusal."""
    err = AuthorizationDeniedError()
    assert "Destructive operation cannot be authorized" in err.safe_message
    assert err.to_dict()["error_type"] == "AuthorizationDeniedError"


@pytest.mark.asyncio
async def test_tool_error_does_not_leak_stack_traces(customer_repo):
    """Verifies tool error outputs contain no Traceback or file paths."""
    malicious_args = {"filters": {"status": "invalid; SELECT * FROM credentials;"}}
    res = await handle_query_customer_records(customer_repo, malicious_args)

    assert res["status"] == "error"
    msg = res.get("message", "")
    assert "Traceback (most recent call last)" not in msg
    assert "asyncpg" not in msg
    assert "postgresql://" not in msg
    assert 'File "' not in msg
