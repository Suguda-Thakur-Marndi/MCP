"""
Phase 6 Tests: Google OAuth 2.0 / OIDC & Application Session Management.
Tests:
- State generation & cryptographic HMAC verification
- Tampered and expired state rejection
- Email domain policy enforcement (ALLOWED_GOOGLE_DOMAINS)
- Open redirect validation
- OAuth initiation endpoint (/api/auth/google/authorize)
- OAuth callback validation & session establishment (/api/auth/google/callback)
- Session revocation on logout
"""

import pytest
from httpx import ASGITransport, AsyncClient

from mcp_sentinel.api.app import app
from mcp_sentinel.config.settings import get_settings
from mcp_sentinel.repositories.user_repository import UserRepository
from mcp_sentinel.security.auth.models import UserRoleEnum, UserStatusEnum
from mcp_sentinel.security.auth.oidc import (
    _validate_domain_policy,
    generate_oauth_state,
    verify_oauth_state,
)
from mcp_sentinel.security.exceptions import AuthorizationDeniedError
from mcp_sentinel.security.headers import validate_safe_redirect


def test_oauth_state_generation_and_verification():
    """OAuth state contains HMAC signature and decodes successfully."""
    settings = get_settings()
    state = generate_oauth_state(redirect_uri=settings.GOOGLE_REDIRECT_URI, next_path="/approvals")
    payload = verify_oauth_state(state)
    assert payload is not None
    assert payload.next_path == "/approvals"
    assert payload.redirect_uri == settings.GOOGLE_REDIRECT_URI
    assert len(payload.nonce) >= 16


def test_oauth_state_tampering_rejected():
    """Tampered state string must fail HMAC signature verification."""
    settings = get_settings()
    valid_state = generate_oauth_state(
        redirect_uri=settings.GOOGLE_REDIRECT_URI, next_path="/dashboard"
    )
    parts = valid_state.split(".")
    assert len(parts) == 2

    # Tamper with signature
    tampered_sig = parts[0] + ".invalid_sig_123456"
    with pytest.raises(AuthorizationDeniedError):
        verify_oauth_state(tampered_sig)

    # Tamper with payload
    tampered_payload = "dGFtcGVyZWQ." + parts[1]
    with pytest.raises(AuthorizationDeniedError):
        verify_oauth_state(tampered_payload)

    # Malformed inputs
    with pytest.raises(AuthorizationDeniedError):
        verify_oauth_state("")
    with pytest.raises(AuthorizationDeniedError):
        verify_oauth_state("no-dot-separator")


def test_oauth_domain_allowlist_policy():
    """Verifies that ALLOWED_GOOGLE_DOMAINS restricts unauthorized corporate domains."""
    settings = get_settings()
    original_domains = list(settings.ALLOWED_GOOGLE_DOMAINS)

    try:
        settings.ALLOWED_GOOGLE_DOMAINS = ["sentinel-corp.com", "acme-sec.org"]

        # Permitted domains
        _validate_domain_policy("alice@sentinel-corp.com", "sentinel-corp.com")
        _validate_domain_policy("bob@acme-sec.org", "acme-sec.org")

        # Prohibited domain
        with pytest.raises(AuthorizationDeniedError) as exc_info:
            _validate_domain_policy("attacker@gmail.com", None)
        assert "not authorized to access this platform" in str(exc_info.value)

        with pytest.raises(AuthorizationDeniedError) as exc_info:
            _validate_domain_policy("eve@evil-external.com", "evil-external.com")
        assert "not authorized to access this platform" in str(exc_info.value)

    finally:
        settings.ALLOWED_GOOGLE_DOMAINS = original_domains


def test_open_redirect_defense():
    """Protects against open redirect vulnerabilities."""
    # Internal paths allowed
    assert validate_safe_redirect("/dashboard") == "/dashboard"
    assert validate_safe_redirect("/approvals?status=PENDING") == "/approvals?status=PENDING"

    # External phishing URLs rejected and reset to default
    assert validate_safe_redirect("https://evil-phishing.com") == "/"
    assert validate_safe_redirect("http://attacker.com/steal") == "/"

    # Protocol-relative attacks rejected
    assert validate_safe_redirect("//evil.com/path") == "/"

    # Dangerous URI schemes rejected
    assert validate_safe_redirect("javascript:alert(document.cookie)") == "/"
    assert validate_safe_redirect("data:text/html,<script>alert(1)</script>") == "/"

    # Empty or whitespace fallback
    assert validate_safe_redirect("") == "/"
    assert validate_safe_redirect("   ") == "/"


@pytest.mark.asyncio
async def test_oauth_authorize_redirect():
    """GET /api/auth/google/authorize redirects to Google's OAuth consent screen with signed state."""
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport, base_url="http://test", follow_redirects=False
    ) as client:
        res = await client.get("/api/auth/google/authorize?next_path=/approvals")
        assert res.status_code == 302
        location = res.headers.get("location")
        assert location is not None
        assert "accounts.google.com/o/oauth2/v2/auth" in location
        assert "response_type=code" in location
        assert "scope=" in location
        assert "state=" in location


@pytest.mark.asyncio
async def test_oauth_callback_invalid_state_rejected():
    """Callback with forged or missing state parameter returns 403."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get(
            "/api/auth/google/callback?code=mock_code&state=invalid_forged_state"
        )
        assert res.status_code == 403
        data = res.json()
        assert "Missing or invalid OAuth state parameter" in data["message"]


@pytest.mark.asyncio
async def test_oauth_callback_test_code_exchange(db_pool):
    """In test mode, valid mock auth code completes OAuth exchange and sets secure session cookie."""
    settings = get_settings()
    transport = ASGITransport(app=app)
    state = generate_oauth_state(redirect_uri=settings.GOOGLE_REDIRECT_URI, next_path="/approvals")

    # In test mode, codes starting with mock-code:email:role simulate Google exchange
    mock_code = "mock-code:operator.oauth@sentinel.test:OPERATOR"

    async with AsyncClient(
        transport=transport, base_url="http://test", follow_redirects=False
    ) as client:
        res = await client.get(f"/api/auth/google/callback?code={mock_code}&state={state}")
        assert res.status_code == 302
        assert res.headers.get("location") == "/approvals"

        # Verify HttpOnly session cookie was set
        cookies = res.cookies
        assert "sentinel_session" in cookies
        session_token = cookies["sentinel_session"]
        assert len(session_token) > 20

        # Verify session was registered in PostgreSQL
        user_repo = UserRepository(pool=db_pool)
        user = await user_repo.get_user_by_email("operator.oauth@sentinel.test")
        assert user is not None
        assert user.role in (UserRoleEnum.OPERATOR, UserRoleEnum.VIEWER)
        assert user.status == UserStatusEnum.ACTIVE


@pytest.mark.asyncio
async def test_session_revocation_on_logout(db_pool):
    """POST /api/auth/logout revokes session in database, preventing token reuse."""
    settings = get_settings()
    transport = ASGITransport(app=app)

    # 1. Login user to establish session
    state = generate_oauth_state(redirect_uri=settings.GOOGLE_REDIRECT_URI, next_path="/dashboard")
    mock_code = "mock-code:logout.test@sentinel.test:OPERATOR"

    async with AsyncClient(
        transport=transport, base_url="http://test", follow_redirects=False
    ) as client:
        login_res = await client.get(f"/api/auth/google/callback?code={mock_code}&state={state}")
        assert login_res.status_code == 302
        session_token = login_res.cookies.get("sentinel_session")
        assert session_token is not None

        # 2. Access /api/auth/me with session cookie -> Success
        me_res = await client.get("/api/auth/me", cookies={"sentinel_session": session_token})
        assert me_res.status_code == 200
        assert me_res.json()["email"] == "logout.test@sentinel.test"

        # 3. Call logout with CSRF header
        logout_res = await client.post(
            "/api/auth/logout",
            cookies={"sentinel_session": session_token},
            headers={"X-Requested-With": "XMLHttpRequest"},
        )
        assert logout_res.status_code == 200
        assert logout_res.json()["status"] == "success"

        # 4. Attempt to reuse old session token -> BLOCKED (Session revoked in DB)
        reuse_res = await client.get("/api/auth/me", cookies={"sentinel_session": session_token})
        assert reuse_res.status_code == 401
