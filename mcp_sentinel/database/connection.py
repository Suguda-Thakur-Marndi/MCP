"""
Database Connection Pooling and Lifecycle Management for MCP-Sentinel.
Uses asyncpg for high-performance, asynchronous PostgreSQL access.
Adheres to:
- Section 4 Database Security (pooling, timeouts, clean shutdown, safe errors).
- Zero credential leakage in exceptions or logs.
"""

import asyncio
from typing import Optional

import asyncpg

from mcp_sentinel.config.settings import Settings, get_settings
from mcp_sentinel.security.audit_logger import (
    DATABASE_ERROR,
    log_security_event,
)
from mcp_sentinel.security.exceptions import DatabaseOperationError

_pool: Optional[asyncpg.Pool] = None
_pool_loop: Optional[asyncio.AbstractEventLoop] = None
_eval_pool: Optional[asyncpg.Pool] = None
_eval_pool_loop: Optional[asyncio.AbstractEventLoop] = None


def _is_pool_valid() -> bool:
    global _pool, _pool_loop
    if _pool is None or _pool._closed:
        return False
    try:
        current_loop = asyncio.get_running_loop()
    except RuntimeError:
        return False
    if _pool_loop is not None and _pool_loop != current_loop:
        return False
    return True


async def init_db_pool(custom_settings: Optional[Settings] = None) -> asyncpg.Pool:
    """
    Initializes and returns the singleton asyncpg Connection Pool.
    Thread-safe / async-safe per active event loop.
    """
    global _pool, _pool_loop
    if _is_pool_valid() and _pool is not None:
        return _pool

    settings = custom_settings or get_settings()
    try:
        current_loop = asyncio.get_running_loop()
        pool = await asyncpg.create_pool(
            dsn=settings.DATABASE_URL,
            min_size=settings.DB_POOL_MIN_SIZE,
            max_size=settings.DB_POOL_MAX_SIZE,
            timeout=settings.DB_POOL_TIMEOUT_SECONDS,
            command_timeout=settings.DB_COMMAND_TIMEOUT_SECONDS,
        )
        if pool is None:
            raise RuntimeError("Failed to allocate asyncpg pool.")
        _pool = pool
        _pool_loop = current_loop
        return _pool
    except Exception as exc:
        log_security_event(
            event_type=DATABASE_ERROR,
            action="init_pool",
            decision="ERROR",
            success=False,
            error_code="POOL_INIT_FAILED",
            details={"target": settings.masked_database_url},
        )
        raise DatabaseOperationError(internal_details=f"Database pool init failed: {exc!s}")


async def get_db_pool() -> asyncpg.Pool:
    """
    Returns the active database pool, initializing it if necessary.
    """
    global _pool
    if not _is_pool_valid():
        return await init_db_pool()
    assert _pool is not None
    return _pool


async def close_db_pool() -> None:
    """
    Gracefully terminates all pool connections during server shutdown.
    """
    global _pool, _pool_loop
    if _pool is not None and not _pool._closed:
        await _pool.close()
    _pool = None
    _pool_loop = None


async def get_eval_db_pool() -> asyncpg.Pool:
    """
    Returns the dedicated connection pool for the isolated evaluation database.
    Strictly isolated from development and production databases.
    """
    global _eval_pool, _eval_pool_loop
    try:
        current_loop = asyncio.get_running_loop()
    except RuntimeError:
        current_loop = None

    if (
        _eval_pool is not None
        and not _eval_pool._closed
        and _eval_pool_loop is not None
        and _eval_pool_loop == current_loop
    ):
        return _eval_pool

    settings = get_settings()
    pool = await asyncpg.create_pool(
        dsn=settings.evaluation_database_url,
        min_size=settings.DB_POOL_MIN_SIZE,
        max_size=settings.DB_POOL_MAX_SIZE,
        timeout=settings.DB_POOL_TIMEOUT_SECONDS,
        command_timeout=settings.DB_COMMAND_TIMEOUT_SECONDS,
    )
    if pool is None:
        raise RuntimeError("Failed to allocate evaluation asyncpg pool.")
    _eval_pool = pool
    _eval_pool_loop = current_loop
    return _eval_pool


async def close_eval_db_pool() -> None:
    """
    Terminates the isolated evaluation pool connections.
    """
    global _eval_pool, _eval_pool_loop
    if _eval_pool is not None and not _eval_pool._closed:
        await _eval_pool.close()
    _eval_pool = None
    _eval_pool_loop = None


async def check_db_health() -> bool:
    """
    Executes a lightweight query to verify connectivity and pool health.
    """
    try:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            val = await conn.fetchval("SELECT 1")
            return val == 1
    except Exception:
        return False


def get_pool_status() -> dict[str, int]:
    """
    Returns real database connection pool statistics.
    Safe for monitoring and metrics reporting.
    """
    global _pool
    if _pool is None or _pool._closed:
        return {
            "total": 0,
            "used": 0,
            "free": 0,
            "total_connections": 0,
            "used_connections": 0,
            "free_connections": 0,
        }
    try:
        total = _pool.get_size() if hasattr(_pool, "get_size") else getattr(_pool, "_size", 0)
        idle = (
            _pool.get_idle_size()
            if hasattr(_pool, "get_idle_size")
            else (_pool._free.qsize() if hasattr(_pool, "_free") else 0)
        )
        used = max(0, total - idle)
        return {
            "total": total,
            "used": used,
            "free": idle,
            "total_connections": total,
            "used_connections": used,
            "free_connections": idle,
        }
    except Exception:
        return {
            "total": 0,
            "used": 0,
            "free": 0,
            "total_connections": 0,
            "used_connections": 0,
            "free_connections": 0,
        }
