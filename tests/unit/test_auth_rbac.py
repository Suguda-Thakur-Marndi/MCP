"""
Unit tests for MCP-Sentinel Authentication, RBAC, and JWT tokens.
Verifies:
- Role permission mapping (ADMIN, OPERATOR, AUDITOR, VIEWER)
- Permission validation checks
- JWT token creation and decoding
- Tampered token signature rejection
- Request-scoped user context propagation
"""

import pytest

from mcp_sentinel.security.auth.context import (
    clear_current_user_context,
    get_current_user_context,
    set_current_user_context,
)
from mcp_sentinel.security.auth.jwt_handler import create_access_token, decode_access_token
from mcp_sentinel.security.auth.models import AuthUser, UserRoleEnum
from mcp_sentinel.security.auth.rbac import (
    PERM_CUSTOMER_DELETE,
    PERM_CUSTOMER_READ,
    PERM_VIEW_AUDIT,
    check_permission,
    has_permission,
)
from mcp_sentinel.security.exceptions import AuthorizationDeniedError


def test_admin_has_all_key_permissions(admin_user: AuthUser):
    """Verifies ADMIN role possesses destructive, read, and audit permissions."""
    assert has_permission(admin_user, PERM_CUSTOMER_DELETE) is True
    assert has_permission(admin_user, PERM_CUSTOMER_READ) is True
    assert has_permission(admin_user, PERM_VIEW_AUDIT) is True


def test_viewer_is_strictly_read_only(viewer_user: AuthUser):
    """Verifies VIEWER role has read permission but is denied destructive actions."""
    assert has_permission(viewer_user, PERM_CUSTOMER_READ) is True
    assert has_permission(viewer_user, PERM_CUSTOMER_DELETE) is False

    with pytest.raises(AuthorizationDeniedError):
        check_permission(viewer_user, PERM_CUSTOMER_DELETE)


def test_jwt_issuance_and_decoding(admin_user: AuthUser):
    """Verifies JWT issuance and accurate payload decoding."""
    token = create_access_token(admin_user, session_id="sess-test-123")
    assert isinstance(token, str)

    payload = decode_access_token(token)
    assert payload.sub == admin_user.id
    assert payload.email == admin_user.email
    assert payload.role == UserRoleEnum.ADMIN
    assert payload.session_id == "sess-test-123"


def test_tampered_jwt_is_rejected(admin_user: AuthUser):
    """Verifies that tampering with a JWT token fails verification."""
    token = create_access_token(admin_user)
    tampered = token[:-4] + "xxxx"

    with pytest.raises(AuthorizationDeniedError):
        decode_access_token(tampered)


def test_user_context_lifecycle(operator_user: AuthUser):
    """Verifies setting, retrieving, and clearing request-scoped user context."""
    clear_current_user_context()
    assert get_current_user_context() is None

    set_current_user_context(operator_user)
    assert get_current_user_context() == operator_user

    clear_current_user_context()
    assert get_current_user_context() is None
