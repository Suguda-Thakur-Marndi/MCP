"""
Idempotency Repository for MCP-Sentinel Gateway.
Provides durable, database-backed idempotency protection across
multiple Uvicorn workers, container replicas, and process restarts.
"""

from __future__ import annotations

import datetime
import json
import logging
from typing import Any, Optional

import asyncpg

from mcp_sentinel.database.connection import get_db_pool

logger = logging.getLogger(__name__)


class IdempotencyRepository:
    """
    Data access repository for durable idempotency records in PostgreSQL.
    """

    def __init__(self, pool: Optional[asyncpg.Pool] = None) -> None:
        self._pool = pool

    async def _get_pool(self) -> asyncpg.Pool:
        if self._pool is not None:
            return self._pool
        return await get_db_pool()

    async def get_response(self, idempotency_key: str) -> Optional[dict[str, Any]]:
        """
        Retrieves a non-expired cached response by idempotency key.
        Returns None on cache miss, expiration, or database failure.
        """
        clean_key = (idempotency_key or "").strip()
        if not clean_key:
            return None

        try:
            pool = await self._get_pool()
            async with pool.acquire() as conn:
                row = await conn.fetchrow(
                    """
                    SELECT response_payload
                    FROM idempotency_records
                    WHERE idempotency_key = $1 AND expires_at > NOW()
                    """,
                    clean_key,
                )
                if not row:
                    return None
                payload = row["response_payload"]
                if isinstance(payload, str):
                    return json.loads(payload)
                return dict(payload) if isinstance(payload, dict) else None
        except Exception as exc:
            logger.debug("Durable idempotency lookup failed for key '%s': %s", clean_key, exc)
            return None

    async def save_response(
        self,
        idempotency_key: str,
        tool_id: str,
        user_id: str,
        response_payload: dict[str, Any],
        ttl_seconds: int = 86400,
    ) -> bool:
        """
        Stores an executed tool response under the idempotency key.
        Defaults to 24-hour expiration.
        """
        clean_key = (idempotency_key or "").strip()
        if not clean_key:
            return False

        try:
            pool = await self._get_pool()
            payload_json = json.dumps(response_payload)
            expires_at = datetime.datetime.now(datetime.UTC) + datetime.timedelta(seconds=ttl_seconds)

            async with pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO idempotency_records (idempotency_key, tool_id, user_id, response_payload, expires_at)
                    VALUES ($1, $2, $3, $4::jsonb, $5)
                    ON CONFLICT (idempotency_key)
                    DO UPDATE SET response_payload = EXCLUDED.response_payload,
                                  expires_at = EXCLUDED.expires_at
                    """,
                    clean_key,
                    tool_id,
                    user_id,
                    payload_json,
                    expires_at,
                )
            return True
        except Exception as exc:
            logger.debug("Durable idempotency persist failed for key '%s': %s", clean_key, exc)
            return False

    async def cleanup_expired(self) -> int:
        """
        Purges expired idempotency records.
        """
        try:
            pool = await self._get_pool()
            async with pool.acquire() as conn:
                res = await conn.execute(
                    "DELETE FROM idempotency_records WHERE expires_at <= NOW()"
                )
                # Format: "DELETE <count>"
                parts = res.split()
                return int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else 0
        except Exception as exc:
            logger.debug("Idempotency cleanup failed: %s", exc)
            return 0
