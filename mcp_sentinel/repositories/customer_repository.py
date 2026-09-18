"""
Customer Repository for MCP-Sentinel Phase 2.
Isolates database operations from MCP tool handlers.
Adheres to:
- Parameterized queries only (zero string interpolation).
- Read-only transactions for read operations.
- Explicit column projection (data minimization).
- Safe error handling without leaking technical details.
- Fail-closed destructive operations with atomic transactions.
"""

from typing import Any, Optional

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
from mcp_sentinel.security.filters import SecureQueryBuilder


class CustomerRepository:
    """
    Data access repository for customer records, updates, deletions, and audit notes.
    """

    def __init__(self, pool: Optional[asyncpg.Pool] = None):
        self._pool = pool

    async def _get_pool(self) -> asyncpg.Pool:
        if self._pool is not None and not self._pool._closed:
            return self._pool
        return await get_db_pool()

    async def query_customers(
        self,
        filters: Optional[dict[str, Any]] = None,
        limit: int = 50,
        offset: int = 0,
        sort_by: Optional[str] = None,
        sort_order: Optional[str] = None,
        max_limit: int = 100,
    ) -> list[dict[str, Any]]:
        """
        Executes a secure read-only customer query.
        Guaranteed parameterized SQL with approved projection columns.
        """
        sql, params = SecureQueryBuilder.build_customer_query(
            filters=filters,
            limit=limit,
            offset=offset,
            sort_by=sort_by,
            sort_order=sort_order,
            max_limit=max_limit,
        )

        pool = await self._get_pool()
        try:
            async with pool.acquire() as conn, conn.transaction(readonly=True):
                records = await conn.fetch(sql, *params)
                return [
                    {
                        "id": r["id"],
                        "name": r["name"],
                        "email": r["email"],
                        "tier": r["tier"],
                        "status": r["status"],
                        "country": r["country"],
                        "created_at": r["created_at"].isoformat() if r["created_at"] else None,
                    }
                    for r in records
                ]
        except (SecurityValidationError, Exception) as exc:
            if isinstance(exc, SecurityValidationError):
                raise
            log_security_event(
                event_type=DATABASE_ERROR,
                action="query_customers",
                decision="ERROR",
                tool_name="query_customer_records",
                success=False,
                error_code="QUERY_FAILED",
                details={"error": str(exc)},
            )
            raise DatabaseOperationError(internal_details=f"Customer query error: {exc!s}")

    async def get_customer_by_id(self, customer_id: int) -> Optional[dict[str, Any]]:
        """
        Retrieves a single customer by internal ID with controlled projection fields.
        """
        sql = """
            SELECT id, customer_code, name, email, country, status, tier, created_at, updated_at
            FROM customers
            WHERE id = $1
            LIMIT 1
        """
        pool = await self._get_pool()
        try:
            async with pool.acquire() as conn, conn.transaction(readonly=True):
                row = await conn.fetchrow(sql, customer_id)
                if not row:
                    return None
                return {
                    "id": row["id"],
                    "customer_code": row["customer_code"] or f"CUST-{row['id']:06d}",
                    "name": row["name"],
                    "email": row["email"],
                    "country": row["country"],
                    "status": row["status"],
                    "tier": row["tier"],
                    "created_at": row["created_at"].isoformat() if row["created_at"] else None,
                    "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
                }
        except Exception as exc:
            log_security_event(
                event_type=DATABASE_ERROR,
                action="get_customer",
                decision="ERROR",
                tool_name="get_customer",
                success=False,
                error_code="CUSTOMER_LOOKUP_FAILED",
                details={"error": str(exc)},
            )
            raise DatabaseOperationError(internal_details=f"Customer lookup error: {exc!s}")

    async def customer_exists(self, customer_id: int) -> bool:
        """
        Verifies if a customer record exists.
        """
        pool = await self._get_pool()
        try:
            async with pool.acquire() as conn:
                val = await conn.fetchval(
                    "SELECT 1 FROM customers WHERE id = $1",
                    customer_id,
                )
                return val == 1
        except Exception as exc:
            raise DatabaseOperationError(internal_details=f"Customer check error: {exc!s}")

    async def update_customer(
        self,
        customer_id: int,
        status: Optional[str] = None,
        country: Optional[str] = None,
    ) -> Optional[dict[str, Any]]:
        """
        Updates approved customer fields (status, country) using parameterized SQL.
        """
        updates: list[str] = []
        params: list[Any] = []
        idx = 1

        if status is not None:
            updates.append(f"status = ${idx}")
            params.append(status.strip().lower())
            idx += 1

        if country is not None:
            updates.append(f"country = ${idx}")
            params.append(country.strip().upper())
            idx += 1

        if not updates:
            return await self.get_customer_by_id(customer_id)

        updates.append("updated_at = NOW()")
        set_clause = ", ".join(updates)
        params.append(customer_id)
        sql = f"""
            UPDATE customers
            SET {set_clause}
            WHERE id = ${idx}
            RETURNING id, customer_code, name, email, country, status, tier, created_at, updated_at
        """

        pool = await self._get_pool()
        try:
            async with pool.acquire() as conn, conn.transaction():
                row = await conn.fetchrow(sql, *params)
                if not row:
                    return None
                return {
                    "id": row["id"],
                    "customer_code": row["customer_code"] or f"CUST-{row['id']:06d}",
                    "name": row["name"],
                    "email": row["email"],
                    "country": row["country"],
                    "status": row["status"],
                    "tier": row["tier"],
                    "created_at": row["created_at"].isoformat() if row["created_at"] else None,
                    "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
                }
        except Exception as exc:
            log_security_event(
                event_type=DATABASE_ERROR,
                action="update_customer",
                decision="ERROR",
                tool_name="update_customer",
                success=False,
                error_code="UPDATE_CUSTOMER_FAILED",
                details={"error": str(exc)},
            )
            raise DatabaseOperationError(internal_details=f"Customer update error: {exc!s}")

    async def delete_customer(self, customer_id: int) -> int:
        """
        Deletes a customer record by ID (cascading to orders and notes).
        Must only be executed after server-side authorization gating passes.
        """
        delete_sql = "DELETE FROM customers WHERE id = $1"
        pool = await self._get_pool()
        try:
            async with pool.acquire() as conn, conn.transaction():
                result_tag = await conn.execute(delete_sql, customer_id)
                deleted_count = 0
                if result_tag and "DELETE" in result_tag:
                    try:
                        deleted_count = int(result_tag.split()[-1])
                    except (ValueError, IndexError):
                        deleted_count = 0
                return deleted_count
        except Exception as exc:
            log_security_event(
                event_type=DATABASE_ERROR,
                action="delete_customer",
                decision="ERROR",
                tool_name="delete_customer",
                success=False,
                error_code="DELETE_CUSTOMER_FAILED",
                details={"error": str(exc)},
            )
            raise DatabaseOperationError(internal_details=f"Delete customer error: {exc!s}")

    async def purge_inactive_customer(self, customer_id: int) -> int:
        """
        Phase 1 destructive purge of an inactive customer record.
        """
        delete_sql = """
            DELETE FROM customers
            WHERE id = $1 AND status = 'inactive'
        """
        pool = await self._get_pool()
        try:
            async with pool.acquire() as conn, conn.transaction():
                result_tag = await conn.execute(delete_sql, customer_id)
                deleted_count = 0
                if result_tag and "DELETE" in result_tag:
                    try:
                        deleted_count = int(result_tag.split()[-1])
                    except (ValueError, IndexError):
                        deleted_count = 0
                return deleted_count
        except Exception as exc:
            log_security_event(
                event_type=DATABASE_ERROR,
                action="purge_inactive_customer",
                decision="ERROR",
                tool_name="purge_inactive_customer_data",
                success=False,
                error_code="PURGE_DELETE_FAILED",
                details={"error": str(exc)},
            )
            raise DatabaseOperationError(internal_details=f"Purge customer error: {exc!s}")

    async def purge_inactive_by_days(
        self,
        inactivity_days: int,
        dry_run: bool = False,
    ) -> dict[str, int]:
        """
        Purges customers who have been inactive and not updated for at least inactivity_days.
        Supports safe dry-run preview.
        """
        pool = await self._get_pool()
        count_sql = """
            SELECT COUNT(*) FROM customers
            WHERE status = 'inactive'
              AND updated_at < NOW() - make_interval(days => $1)
        """
        delete_sql = """
            DELETE FROM customers
            WHERE status = 'inactive'
              AND updated_at < NOW() - make_interval(days => $1)
        """

        try:
            async with pool.acquire() as conn, conn.transaction():
                matched = await conn.fetchval(count_sql, inactivity_days) or 0
                if dry_run:
                    return {"matched_records": matched, "deleted_records": 0}

                result_tag = await conn.execute(delete_sql, inactivity_days)
                deleted_count = 0
                if result_tag and "DELETE" in result_tag:
                    try:
                        deleted_count = int(result_tag.split()[-1])
                    except (ValueError, IndexError):
                        deleted_count = 0
                return {"matched_records": matched, "deleted_records": deleted_count}
        except Exception as exc:
            log_security_event(
                event_type=DATABASE_ERROR,
                action="purge_inactive_by_days",
                decision="ERROR",
                tool_name="purge_inactive_customer_data",
                success=False,
                error_code="PURGE_DAYS_FAILED",
                details={"error": str(exc)},
            )
            raise DatabaseOperationError(internal_details=f"Purge by days error: {exc!s}")

    async def append_audit_note(
        self,
        customer_id: int,
        author_id: str,
        note_text: str,
    ) -> dict[str, Any]:
        """
        Appends an administrative audit note for a customer.
        Validates customer existence and parameterizes all values.
        """
        exists = await self.customer_exists(customer_id)
        if not exists:
            raise SecurityValidationError(f"Customer with ID {customer_id} does not exist.")

        insert_sql = """
            INSERT INTO customer_audit_notes (customer_id, author_id, note_text, created_at)
            VALUES ($1, $2, $3, NOW())
            RETURNING note_id, created_at
        """
        pool = await self._get_pool()
        try:
            async with pool.acquire() as conn, conn.transaction():
                row = await conn.fetchrow(
                    insert_sql,
                    customer_id,
                    author_id,
                    note_text,
                )
                if not row:
                    raise DatabaseOperationError(internal_details="Insert failed to return record.")
                return {
                    "status": "success",
                    "note_id": row["note_id"],
                    "customer_id": customer_id,
                    "created_at": row["created_at"].isoformat(),
                }
        except (SecurityValidationError, Exception) as exc:
            if isinstance(exc, SecurityValidationError):
                raise
            log_security_event(
                event_type=DATABASE_ERROR,
                action="append_audit_note",
                decision="ERROR",
                tool_name="append_customer_audit_note",
                success=False,
                error_code="INSERT_NOTE_FAILED",
                details={"error": str(exc)},
            )
            raise DatabaseOperationError(internal_details=f"Append note error: {exc!s}")
