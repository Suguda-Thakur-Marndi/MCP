"""
Order Repository for MCP-Sentinel Phase 2.
Isolates database queries for orders using strictly parameterized SQL and controlled projection.
Complies with:
- Zero raw SQL execution or interpolation.
- Read-only transactions for queries.
- Bounded limits and pagination.
- Safe error handling without leaking technical details.
"""

from typing import Any, Optional, Union

import asyncpg

from mcp_sentinel.database.connection import get_db_pool
from mcp_sentinel.security.audit_logger import (
    DATABASE_ERROR,
    log_security_event,
)
from mcp_sentinel.security.exceptions import (
    DatabaseOperationError,
    SecurityValidationError,
)

APPROVED_ORDER_COLUMNS = [
    "id",
    "order_number",
    "customer_id",
    "status",
    "total_amount",
    "currency",
    "created_at",
]


class OrderRepository:
    """
    Data access repository for order records.
    """

    def __init__(self, pool: Optional[asyncpg.Pool] = None):
        self._pool = pool

    async def _get_pool(self) -> asyncpg.Pool:
        if self._pool is not None and not self._pool._closed:
            return self._pool
        return await get_db_pool()

    async def get_order_by_id_or_number(
        self,
        identifier: Union[int, str],
    ) -> Optional[dict[str, Any]]:
        """
        Retrieves an order by internal numeric ID or enterprise order_number ('ORD-XXXXXX').
        Uses strictly parameterized queries and explicit column projections.
        """
        pool = await self._get_pool()
        query_col = ", ".join(APPROVED_ORDER_COLUMNS)

        try:
            async with pool.acquire() as conn, conn.transaction(readonly=True):
                if isinstance(identifier, int) or (
                    isinstance(identifier, str) and identifier.isdigit()
                ):
                    num_id = int(identifier)
                    sql = f"SELECT {query_col} FROM orders WHERE id = $1 LIMIT 1"
                    row = await conn.fetchrow(sql, num_id)
                else:
                    code = str(identifier).strip()
                    sql = f"SELECT {query_col} FROM orders WHERE order_number = $1 LIMIT 1"
                    row = await conn.fetchrow(sql, code)

                if not row:
                    return None

                return {
                    "id": row["id"],
                    "order_number": row["order_number"],
                    "customer_id": row["customer_id"],
                    "status": row["status"],
                    "total_amount": float(row["total_amount"]),
                    "currency": row["currency"],
                    "created_at": row["created_at"].isoformat() if row["created_at"] else None,
                }
        except Exception as exc:
            log_security_event(
                event_type=DATABASE_ERROR,
                action="get_order",
                decision="ERROR",
                tool_name="get_order",
                success=False,
                error_code="ORDER_QUERY_FAILED",
                details={"error": str(exc)},
            )
            raise DatabaseOperationError(internal_details=f"Order lookup error: {exc!s}")

    async def get_orders_by_customer_id(
        self,
        customer_id: int,
        limit: int = 50,
        offset: int = 0,
        max_limit: int = 100,
    ) -> list[dict[str, Any]]:
        """
        Retrieves orders for a customer with bounded pagination.
        """
        if not isinstance(limit, int) or limit < 1:
            raise SecurityValidationError(f"Limit must be a positive integer, got: {limit}")
        if limit > max_limit:
            raise SecurityValidationError(f"Limit exceeds maximum of {max_limit}, got: {limit}")
        if not isinstance(offset, int) or offset < 0:
            raise SecurityValidationError(f"Offset must be non-negative, got: {offset}")

        pool = await self._get_pool()
        query_col = ", ".join(APPROVED_ORDER_COLUMNS)
        sql = f"""
            SELECT {query_col}
            FROM orders
            WHERE customer_id = $1
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
        """

        try:
            async with pool.acquire() as conn, conn.transaction(readonly=True):
                rows = await conn.fetch(sql, customer_id, limit, offset)
                return [
                    {
                        "id": r["id"],
                        "order_number": r["order_number"],
                        "customer_id": r["customer_id"],
                        "status": r["status"],
                        "total_amount": float(r["total_amount"]),
                        "currency": r["currency"],
                        "created_at": r["created_at"].isoformat() if r["created_at"] else None,
                    }
                    for r in rows
                ]
        except (SecurityValidationError, Exception) as exc:
            if isinstance(exc, SecurityValidationError):
                raise
            log_security_event(
                event_type=DATABASE_ERROR,
                action="get_customer_orders",
                decision="ERROR",
                tool_name="get_customer_orders",
                success=False,
                error_code="CUSTOMER_ORDERS_FAILED",
                details={"error": str(exc)},
            )
            raise DatabaseOperationError(internal_details=f"Customer orders query error: {exc!s}")
