"""
Phase 5 Automated Tests: Authentication and RBAC/ABAC Authorization.
Tests:
- JWT creation, decoding, signature verification
- Expired and tampered token rejection
- Google OIDC verification flow
- RBAC permissions per role (ADMIN, APPROVER, SECURITY_ANALYST, OPERATOR, VIEWER)
- Least-privilege separation between operational and approval roles
"""

from datetime import timedelta

import pytest

from mcp_sentinel.security.auth.jwt_handler import create_access_token, decode_access_token
from mcp_sentinel.security.auth.models import AuthUser, UserRoleEnum
from mcp_sentinel.security.auth.oidc import verify_google_id_token
from mcp_sentinel.security.auth.rbac import (
    PERM_APPROVE_DESTRUCTIVE,
    can_approve_destructive,
    can_run_agent,
    can_run_security_eval,
    check_permission,
)
from mcp_sentinel.security.exceptions import AuthorizationDeniedError


def test_jwt_create_and_decode():
    """Verifies that signed JWT preserves claims and roundtrips accurately."""
    user = AuthUser(
        id="usr-123",
        email="operator@sentinel.test",
        name="Operator Alice",
        role=UserRoleEnum.OPERATOR,
        is_active=True,
    )
    token = create_access_token(user, expires_delta=timedelta(minutes=30))
    assert isinstance(token, str)
    assert len(token) > 20

    payload = decode_access_token(token)
    assert payload.sub == "usr-123"
    assert payload.email == "operator@sentinel.test"
    assert payload.role == UserRoleEnum.OPERATOR
    assert payload.name == "Operator Alice"


def test_jwt_tampered_token_rejected():
    """Any modification to the token payload or signature must fail decoding."""
    user = AuthUser(
        id="usr-123",
        email="operator@sentinel.test",
        name="Operator Alice",
        role=UserRoleEnum.OPERATOR,
        is_active=True,
    )
    token = create_access_token(user)
    tampered = token[:-4] + "abcd"

    with pytest.raises(AuthorizationDeniedError):
        decode_access_token(tampered)


def test_jwt_expired_token_rejected():
    """Expired tokens must fail validation and not authenticate."""
    user = AuthUser(
        id="usr-123",
        email="operator@sentinel.test",
        name="Operator Alice",
        role=UserRoleEnum.OPERATOR,
        is_active=True,
    )
    token = create_access_token(user, expires_delta=timedelta(seconds=-10))

    with pytest.raises(AuthorizationDeniedError) as excinfo:
        decode_access_token(token)
    assert "expired" in str(excinfo.value).lower()


@pytest.mark.asyncio
async def test_oidc_test_token_verification():
    """In test mode, valid mock Google tokens are decoded into user profiles."""
    user = await verify_google_id_token("mock-google-token:approver@sentinel.test:APPROVER")
    assert user.email == "approver@sentinel.test"
    assert user.role == UserRoleEnum.APPROVER

    default_user = await verify_google_id_token("mock-google-token:someone@sentinel.test")
    assert default_user.email == "someone@sentinel.test"
    assert default_user.role == UserRoleEnum.OPERATOR


def test_rbac_approval_privileges():
    """Only ADMIN and APPROVER may approve destructive operations."""
    admin = AuthUser(id="1", email="admin@test.com", name="Admin", role=UserRoleEnum.ADMIN)
    approver = AuthUser(id="2", email="appr@test.com", name="Approver", role=UserRoleEnum.APPROVER)
    sec_analyst = AuthUser(
        id="3", email="sec@test.com", name="Sec", role=UserRoleEnum.SECURITY_ANALYST
    )
    operator = AuthUser(id="4", email="op@test.com", name="Op", role=UserRoleEnum.OPERATOR)
    viewer = AuthUser(id="5", email="view@test.com", name="Viewer", role=UserRoleEnum.VIEWER)

    # Approver privilege
    assert can_approve_destructive(admin) is True
    assert can_approve_destructive(approver) is True
    assert can_approve_destructive(sec_analyst) is False
    assert can_approve_destructive(operator) is False
    assert can_approve_destructive(viewer) is False

    # Check permission raises for operator
    with pytest.raises(AuthorizationDeniedError):
        check_permission(operator, PERM_APPROVE_DESTRUCTIVE)


def test_rbac_agent_chat_privileges():
    """Viewer cannot interact directly with agent."""
    viewer = AuthUser(id="5", email="view@test.com", name="Viewer", role=UserRoleEnum.VIEWER)
    operator = AuthUser(id="4", email="op@test.com", name="Op", role=UserRoleEnum.OPERATOR)

    assert can_run_agent(viewer) is False
    assert can_run_agent(operator) is True


def test_rbac_security_eval_privileges():
    """Only ADMIN and SECURITY_ANALYST may run automated security evaluations."""
    admin = AuthUser(id="1", email="admin@test.com", name="Admin", role=UserRoleEnum.ADMIN)
    sec = AuthUser(id="3", email="sec@test.com", name="Sec", role=UserRoleEnum.SECURITY_ANALYST)
    approver = AuthUser(id="2", email="appr@test.com", name="Approver", role=UserRoleEnum.APPROVER)
    operator = AuthUser(id="4", email="op@test.com", name="Op", role=UserRoleEnum.OPERATOR)

    assert can_run_security_eval(admin) is True
    assert can_run_security_eval(sec) is True
    assert can_run_security_eval(approver) is False
    assert can_run_security_eval(operator) is False
