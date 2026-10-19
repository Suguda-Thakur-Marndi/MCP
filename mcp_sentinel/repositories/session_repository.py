"""
Session Repository for MCP-Sentinel Phase 6.
Manages server-side session tracking in PostgreSQL, supporting immediate
session revocation on logout, account disablement, and expiration enforcement.
"""

from datetime import datetime, timezone
from typing import Optional

import asyncpg

from mcp_sentinel.database.connection import get_db_pool
from mcp_sentinel.security.auth.models import SessionRecord
from mcp_sentinel.security.exceptions import DatabaseOperationError


class SessionRepository:
    """
    PostgreSQL data access for application sessions.
    """

    def __init__(self, pool: Optional[asyncpg.Pool] = None):
        self._pool = pool

    async def _get_pool(self) -> asyncpg.Pool:
        if self._pool is not None and not self._pool._closed:
            return self._pool
        return await get_db_pool()

    def _row_to_session(self, row: asyncpg.Record) -> SessionRecord:
        data = dict(row)
        return SessionRecord(
            session_id=data["session_id"],
            user_id=data["user_id"],
            created_at=data["created_at"],
            expires_at=data["expires_at"],
            is_revoked=data.get("is_revoked", False),
            revoked_at=data.get("revoked_at"),
            user_agent=data.get("user_agent"),
            ip_address=data.get("ip_address"),
        )

    async def create_session(
        self,
        session_id: str,
        user_id: str,
        expires_at: datetime,
        user_agent: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> SessionRecord:
        """Stores a newly generated application session."""
        pool = await self._get_pool()
        query = """
            INSERT INTO sessions (session_id, user_id, expires_at, is_revoked, user_agent, ip_address, created_at)
            VALUES ($1, $2, $3, FALSE, $4, $5, NOW())
            RETURNING *
        """
        try:
            async with pool.acquire() as conn:
                row = await conn.fetchrow(
                    query, session_id, user_id, expires_at, user_agent, ip_address
                )
                if not row:
                    raise DatabaseOperationError("Failed to insert session record.")
                return self._row_to_session(row)
        except Exception as exc:
            raise DatabaseOperationError(internal_details=f"Create session error: {exc!s}")

    async def get_valid_session(self, session_id: str) -> Optional[SessionRecord]:
        """
        Retrieves a session only if it exists, is NOT revoked, and has NOT expired.
        Fails closed otherwise.
        """
        clean_sid = session_id.strip() if session_id else ""
        if not clean_sid:
            return None

        pool = await self._get_pool()
        now = datetime.now(timezone.utc)
        query = """
            SELECT * FROM sessions
            WHERE session_id = $1 AND is_revoked = FALSE AND expires_at > $2
        """
        try:
            async with pool.acquire() as conn:
                row = await conn.fetchrow(query, clean_sid, now)
                return self._row_to_session(row) if row else None
        except Exception as exc:
            raise DatabaseOperationError(internal_details=f"Get valid session error: {exc!s}")

    async def revoke_session(self, session_id: str) -> bool:
        """Explicitly revokes a session (used upon logout)."""
        clean_sid = session_id.strip() if session_id else ""
        if not clean_sid:
            return False

        pool = await self._get_pool()
        query = """
            UPDATE sessions
            SET is_revoked = TRUE, revoked_at = NOW()
            WHERE session_id = $1 AND is_revoked = FALSE
            RETURNING session_id
        """
        try:
            async with pool.acquire() as conn:
                res = await conn.fetchval(query, clean_sid)
                return res is not None
        except Exception as exc:
            raise DatabaseOperationError(internal_details=f"Revoke session error: {exc!s}")

    async def revoke_all_user_sessions(self, user_id: str) -> int:
        """Revokes all active sessions for a user (e.g. when disabled or security incident)."""
        pool = await self._get_pool()
        query = """
            UPDATE sessions
            SET is_revoked = TRUE, revoked_at = NOW()
            WHERE user_id = $1 AND is_revoked = FALSE
            RETURNING session_id
        """
        try:
            async with pool.acquire() as conn:
                rows = await conn.fetch(query, user_id)
                return len(rows)
        except Exception as exc:
            raise DatabaseOperationError(
                internal_details=f"Revoke all user sessions error: {exc!s}"
            )
