from mcp_sentinel.database.connection import (
    check_db_health,
    close_db_pool,
    get_db_pool,
    init_db_pool,
)


def __getattr__(name: str):
    if name == "ApprovalRepository":
        from mcp_sentinel.repositories.approval_repository import ApprovalRepository

        return ApprovalRepository
    if name == "CustomerRepository":
        from mcp_sentinel.repositories.customer_repository import CustomerRepository

        return CustomerRepository
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = [
    "ApprovalRepository",
    "CustomerRepository",
    "check_db_health",
    "close_db_pool",
    "get_db_pool",
    "init_db_pool",
]
