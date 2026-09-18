"""
Pytest configuration and fixtures for MCP-Sentinel test suite.
"""

import pathlib
import sys

import asyncpg
import pytest
import pytest_asyncio

# Ensure project root is in sys.path
sys.path.insert(0, str(pathlib.Path(__file__).parent.parent))

from mcp_sentinel.config.settings import get_settings
from mcp_sentinel.database.repositories.approval_repository import ApprovalRepository
from mcp_sentinel.database.repositories.customer_repository import CustomerRepository


@pytest_asyncio.fixture
async def db_pool():
    """
    Function-scoped asyncpg pool attached to the test's active event loop.
    Resets seed data before yielding to ensure deterministic test isolation.
    """
    settings = get_settings()
    pool = await asyncpg.create_pool(
        dsn=settings.DATABASE_URL,
        min_size=1,
        max_size=5,
        timeout=settings.DB_POOL_TIMEOUT_SECONDS,
        command_timeout=settings.DB_COMMAND_TIMEOUT_SECONDS,
    )

    # Reset synthetic seed data before each test that uses the database
    seed_path = (
        pathlib.Path(__file__).parent.parent
        / "mcp_sentinel"
        / "database"
        / "seed"
        / "seed_synthetic_data.sql"
    )
    if seed_path.exists():
        sql = seed_path.read_text(encoding="utf-8")
        async with pool.acquire() as conn:
            await conn.execute(sql)

    yield pool

    await pool.close()


@pytest.fixture
def customer_repo(db_pool):
    return CustomerRepository(pool=db_pool)


@pytest.fixture
def approval_repo(db_pool):
    return ApprovalRepository(pool=db_pool)
