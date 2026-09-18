"""
Audit Repository for MCP-Sentinel Phase 2.
Manages persistent audit notes and structured security/tool audit events.
Complies with:
- Treating audit notes as untrusted data.
- Strict parameterization and correlation tracking with request IDs.
- Fail-safe recording of audit events.
"""

import json
from typing import Any, Optional

import asyncpg

from mcp_sentinel.database.connection import get_db_pool
from mcp_sentinel.security.audit_logger import (
    DATABASE_ERROR,
    log_security_event,
)
from mcp_sentinel.security.correlation import get_request_id
from mcp_sentinel.security.exceptions import (
    DatabaseOperationError,
    SecurityValidationError,
)


class AuditRepository:
    """
    Data access repository for customer audit notes and security audit events.
    """

    def __init__(self, pool: Optional[asyncpg.Pool] = None):
        self._pool = pool

    async def _get_pool(self) -> asyncpg.Pool:
        if self._pool is not None and not self._pool._closed:
            return self._pool
        return await get_db_pool()

    async def customer_exists(self, customer_id: int) -> bool:
        """
        Verifies customer existence before appending notes.
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

    async def append_audit_note(
        self,
        customer_id: int,
        author_id: str,
        note_text: str,
    ) -> dict[str, Any]:
        """
        Appends an administrative audit note for a customer.
        Validates customer existence and strictly parameterizes all input.
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

    async def record_audit_event(
        self,
        event_type: str,
        tool_name: str,
        decision: str,
        actor_type: str = "agent",
        actor_id: Optional[str] = None,
        request_id: Optional[str] = None,
        details: Optional[dict[str, Any]] = None,
    ) -> Optional[int]:
        """
        Persists a structured security or tool invocation event to audit_events.
        """
        req_id = request_id or get_request_id() or "unknown_req"
        details_json = json.dumps(details or {})

        insert_sql = """
            INSERT INTO audit_events (
                event_type, actor_type, actor_id, tool_name, decision, request_id, details, created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW())
            RETURNING id
        """
        pool = await self._get_pool()
        try:
            async with pool.acquire() as conn:
                event_id = await conn.fetchval(
                    insert_sql,
                    event_type,
                    actor_type,
                    actor_id,
                    tool_name,
                    decision,
                    req_id,
                    details_json,
                )
                return event_id
        except Exception as exc:
            # Fall back to logging without crashing main request path
            log_security_event(
                event_type=DATABASE_ERROR,
                action="record_audit_event",
                decision="ERROR",
                tool_name="audit_repository",
                success=False,
                error_code="AUDIT_EVENT_INSERT_FAILED",
                details={"error": str(exc)},
            )
            return None
