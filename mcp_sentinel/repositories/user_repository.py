"""
User Repository for MCP-Sentinel Phase 6.
Handles secure database access for user identity, role assignments,
account status (ACTIVE / DISABLED), and ABAC attribute querying.
"""

import uuid
from typing import Optional

import asyncpg

from mcp_sentinel.database.connection import get_db_pool
from mcp_sentinel.security.auth.models import AuthUser, UserRoleEnum, UserStatusEnum
from mcp_sentinel.security.exceptions import DatabaseOperationError


class UserRepository:
    """
    Data access repository for users in PostgreSQL.
    """

    def __init__(self, pool: Optional[asyncpg.Pool] = None):
        self._pool = pool

    async def _get_pool(self) -> asyncpg.Pool:
        if self._pool is not None and not self._pool._closed:
            return self._pool
        return await get_db_pool()

    def _row_to_user(self, row: asyncpg.Record) -> AuthUser:
        data = dict(row)
        role_val = data.get("role", "VIEWER")
        role = (
            UserRoleEnum(role_val) if role_val in UserRoleEnum.__members__ else UserRoleEnum.VIEWER
        )

        status_val = data.get("status", "ACTIVE")
        status = (
            UserStatusEnum(status_val)
            if status_val in UserStatusEnum.__members__
            else UserStatusEnum.ACTIVE
        )

        is_active = data.get("is_active", True)
        if status == UserStatusEnum.DISABLED:
            is_active = False

        allowed_cust = data.get("allowed_customer_ids")
        if isinstance(allowed_cust, str):
            import json

            try:
                allowed_cust = json.loads(allowed_cust)
            except Exception:
                allowed_cust = None

        return AuthUser(
            id=data["id"],
            google_subject_id=data.get("google_subject_id"),
            email=data["email"],
            name=data["name"],
            role=role,
            status=status,
            is_active=is_active,
            department=data.get("department"),
            organization=data.get("organization"),
            allowed_customer_ids=allowed_cust if isinstance(allowed_cust, list) else None,
        )

    async def get_user_by_id(self, user_id: str) -> Optional[AuthUser]:
        """Look up user by internal user identifier."""
        pool = await self._get_pool()
        query = "SELECT * FROM users WHERE id = $1"
        try:
            async with pool.acquire() as conn:
                row = await conn.fetchrow(query, user_id)
                return self._row_to_user(row) if row else None
        except Exception as exc:
            raise DatabaseOperationError(internal_details=f"Get user by id error: {exc!s}")

    async def get_user_by_email(self, email: str) -> Optional[AuthUser]:
        """Look up user by unique email address."""
        pool = await self._get_pool()
        query = "SELECT * FROM users WHERE LOWER(email) = LOWER($1)"
        try:
            async with pool.acquire() as conn:
                row = await conn.fetchrow(query, email.strip())
                return self._row_to_user(row) if row else None
        except Exception as exc:
            raise DatabaseOperationError(internal_details=f"Get user by email error: {exc!s}")

    async def get_user_by_google_sub(self, google_subject_id: str) -> Optional[AuthUser]:
        """Look up user by stable Google OIDC subject identifier."""
        pool = await self._get_pool()
        query = "SELECT * FROM users WHERE google_subject_id = $1"
        try:
            async with pool.acquire() as conn:
                row = await conn.fetchrow(query, google_subject_id)
                return self._row_to_user(row) if row else None
        except Exception as exc:
            raise DatabaseOperationError(internal_details=f"Get user by google_sub error: {exc!s}")

    async def upsert_user_from_oidc(
        self,
        google_subject_id: str,
        email: str,
        name: str,
        default_role: UserRoleEnum = UserRoleEnum.VIEWER,
        organization: Optional[str] = None,
        department: Optional[str] = None,
    ) -> AuthUser:
        """
        Idempotently registers or updates a user from validated Google OIDC claims.
        Crucial rule: Existing assigned roles are NEVER overwritten by OIDC logins.
        New users default to least-privilege VIEWER.
        """
        pool = await self._get_pool()
        query = """
            INSERT INTO users (
                id, google_subject_id, email, name, role, status, is_active,
                organization, department, created_at, updated_at, last_login_at
            )
            VALUES (
                $1, $2, $3, $4, $5, 'ACTIVE', TRUE,
                $6, $7, NOW(), NOW(), NOW()
            )
            ON CONFLICT (email) DO UPDATE
            SET
                google_subject_id = COALESCE(users.google_subject_id, EXCLUDED.google_subject_id),
                name = EXCLUDED.name,
                organization = COALESCE(users.organization, EXCLUDED.organization),
                department = COALESCE(users.department, EXCLUDED.department),
                last_login_at = NOW(),
                updated_at = NOW()
            RETURNING *
        """
        # Check if user already exists by email to keep stable internal id
        clean_email = email.strip().lower()
        sub_id = google_subject_id.strip() if google_subject_id else None
        existing = await self.get_user_by_email(clean_email)
        user_id = existing.id if existing else f"user-{uuid.uuid4().hex[:12]}"

        try:
            async with pool.acquire() as conn:
                row = await conn.fetchrow(
                    query,
                    user_id,
                    sub_id,
                    clean_email,
                    name.strip(),
                    default_role.value,
                    organization,
                    department,
                )
                if not row:
                    raise DatabaseOperationError("Upsert user failed to return row.")
                return self._row_to_user(row)
        except Exception as exc:
            raise DatabaseOperationError(internal_details=f"Upsert user error: {exc!s}")

    async def set_user_status(self, user_id: str, status: UserStatusEnum) -> Optional[AuthUser]:
        """Updates account status to ACTIVE or DISABLED."""
        pool = await self._get_pool()
        is_active = status == UserStatusEnum.ACTIVE
        query = """
            UPDATE users
            SET status = $1, is_active = $2, updated_at = NOW()
            WHERE id = $3
            RETURNING *
        """
        try:
            async with pool.acquire() as conn:
                row = await conn.fetchrow(query, status.value, is_active, user_id)
                return self._row_to_user(row) if row else None
        except Exception as exc:
            raise DatabaseOperationError(internal_details=f"Set user status error: {exc!s}")

    async def update_user_role(self, user_id: str, role: UserRoleEnum) -> Optional[AuthUser]:
        """Admin operation to promote/demote user role."""
        pool = await self._get_pool()
        query = """
            UPDATE users
            SET role = $1, updated_at = NOW()
            WHERE id = $2
            RETURNING *
        """
        try:
            async with pool.acquire() as conn:
                row = await conn.fetchrow(query, role.value, user_id)
                return self._row_to_user(row) if row else None
        except Exception as exc:
            raise DatabaseOperationError(internal_details=f"Update user role error: {exc!s}")
