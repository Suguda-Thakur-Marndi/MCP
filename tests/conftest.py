"""
Pytest configuration and shared test fixtures for SentinelCore test suite.
"""

import os

import pytest

# Ensure isolated test environment configuration before any settings are loaded
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault(
    "DATABASE_URL", "postgresql://postgres:ci_test_password@localhost:5432/mcp_sentinel_test"
)
os.environ.setdefault("ENABLE_TEST_AUTH", "true")
os.environ.setdefault("JWT_SECRET_KEY", "ci-test-jwt-secret-key-at-least-32-chars-long-sentinel")
os.environ.setdefault("APPROVAL_HMAC_SECRET", "ci-test-hmac-secret-at-least-32-chars-long-sentinel")
os.environ.setdefault("SESSION_SECRET", "ci-test-session-secret-at-least-32-chars-long-sentinel")

from mcp_sentinel.security.auth.models import AuthUser, UserRoleEnum, UserStatusEnum
from mcp_sentinel.security.policy.engine import PolicyEngine, get_policy_engine
from mcp_sentinel.server.app import create_app


@pytest.fixture
def policy_engine() -> PolicyEngine:
    """Provides a fresh PolicyEngine instance."""
    return get_policy_engine()


@pytest.fixture
def admin_user() -> AuthUser:
    """Fixture providing an active administrator user."""
    return AuthUser(
        id="usr-admin-test-01",
        email="admin@sentinel.test",
        name="Admin Test",
        display_name="Admin Test",
        role=UserRoleEnum.ADMIN,
        status=UserStatusEnum.ACTIVE,
        is_active=True,
    )


@pytest.fixture
def operator_user() -> AuthUser:
    """Fixture providing an active operator user."""
    return AuthUser(
        id="usr-operator-test-01",
        email="operator@sentinel.test",
        name="Operator Test",
        display_name="Operator Test",
        role=UserRoleEnum.OPERATOR,
        status=UserStatusEnum.ACTIVE,
        is_active=True,
    )


@pytest.fixture
def viewer_user() -> AuthUser:
    """Fixture providing a read-only viewer user."""
    return AuthUser(
        id="usr-viewer-test-01",
        email="viewer@sentinel.test",
        name="Viewer Test",
        display_name="Viewer Test",
        role=UserRoleEnum.VIEWER,
        status=UserStatusEnum.ACTIVE,
        is_active=True,
    )


@pytest.fixture
def fastmcp_server():
    """Fixture providing an active FastMCP server instance."""
    return create_app()
