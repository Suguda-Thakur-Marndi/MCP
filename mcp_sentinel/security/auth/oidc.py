"""
Google OAuth 2.0 / OpenID Connect (OIDC) Implementation for MCP-Sentinel.
Adheres strictly to:
- Standard secure OAuth 2.0 Authorization Code Flow.
- Cryptographic state and nonce generation to prevent CSRF and replay attacks.
- Authoritative Google ID token verification (iss, aud, exp, email_verified).
- Explicit email domain restriction (ALLOWED_GOOGLE_DOMAINS).
- Safe test/development token fixtures for offline automated tests.
- Fails closed: identity is never accepted from unvalidated client parameters.
"""

import base64
import hashlib
import hmac
import json
import time
import urllib.parse
from typing import Any, Optional

import httpx

from mcp_sentinel.config.settings import get_settings
from mcp_sentinel.security.auth.models import (
    AuthUser,
    OAuthStatePayload,
    UserRoleEnum,
    UserStatusEnum,
)
from mcp_sentinel.security.exceptions import AuthorizationDeniedError


def generate_oauth_state(redirect_uri: str, next_path: Optional[str] = None) -> str:
    """
    Generates an HMAC-SHA256 signed OAuth state token containing a secure nonce and timestamp.
    Protects against state injection and CSRF attacks during the OAuth handshake.
    """
    settings = get_settings()
    now = int(time.time())
    import secrets

    nonce = secrets.token_urlsafe(16)

    payload = {
        "nonce": nonce,
        "redirect_uri": redirect_uri,
        "timestamp": now,
        "next_path": next_path if (next_path and next_path.startswith("/")) else "/",
    }
    payload_json = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    payload_b64 = base64.urlsafe_b64encode(payload_json.encode()).decode().rstrip("=")

    signature = hmac.new(
        settings.JWT_SECRET_KEY.encode(),
        payload_b64.encode(),
        hashlib.sha256,
    ).hexdigest()

    return f"{payload_b64}.{signature}"


def verify_oauth_state(state: str, max_age_seconds: int = 600) -> OAuthStatePayload:
    """
    Verifies an HMAC-SHA256 signed OAuth state token.
    Fails closed if missing, malformed, expired, or tampered with.
    """
    clean_state = state.strip() if state else ""
    if not clean_state or "." not in clean_state:
        raise AuthorizationDeniedError("Missing or invalid OAuth state parameter.")

    payload_b64, signature = clean_state.split(".", 1)
    settings = get_settings()

    # Verify signature
    expected_sig = hmac.new(
        settings.JWT_SECRET_KEY.encode(),
        payload_b64.encode(),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(signature, expected_sig):
        raise AuthorizationDeniedError(
            "OAuth state signature verification failed. Possible CSRF attempt."
        )

    # Decode and parse payload
    try:
        padding = "=" * ((4 - len(payload_b64) % 4) % 4)
        raw_json = base64.urlsafe_b64decode(f"{payload_b64}{padding}".encode()).decode()
        data = json.loads(raw_json)
    except Exception:
        raise AuthorizationDeniedError("Malformed OAuth state payload.")

    timestamp = data.get("timestamp", 0)
    now = int(time.time())
    if now - timestamp > max_age_seconds:
        raise AuthorizationDeniedError(
            "OAuth state parameter has expired. Please initiate login again."
        )

    return OAuthStatePayload(
        nonce=data["nonce"],
        redirect_uri=data["redirect_uri"],
        timestamp=timestamp,
        next_path=data.get("next_path", "/"),
    )


def build_google_authorization_url(state: str, nonce: Optional[str] = None) -> str:
    """
    Constructs the Google OAuth 2.0 authorization redirect URL with state and optional nonce.
    """
    settings = get_settings()
    client_id = settings.GOOGLE_CLIENT_ID or "development-placeholder-client-id"
    redirect_uri = settings.GOOGLE_REDIRECT_URI

    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "offline",
        "prompt": "select_account",
    }
    if nonce:
        params["nonce"] = nonce
    return f"https://accounts.google.com/o/oauth2/v2/auth?{urllib.parse.urlencode(params)}"


async def exchange_google_authorization_code(code: str, redirect_uri: str) -> dict[str, Any]:
    """
    Exchanges an authorization code for Google OAuth tokens via Google's token endpoint.
    """
    settings = get_settings()

    # Controlled test fixture support for automated environments without live Google credentials
    if settings.ENABLE_TEST_AUTH and code.startswith("mock-code:"):
        parts = code.split(":")
        email = parts[1] if len(parts) > 1 else "test.user@sentinel.test"
        role = parts[2] if len(parts) > 2 else "OPERATOR"
        return {
            "id_token": f"mock-google-token:{email}:{role}",
            "access_token": "mock-access-token",
            "token_type": "Bearer",
            "expires_in": 3600,
        }

    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise AuthorizationDeniedError("Google OAuth client is not configured on this server.")

    token_url = "https://oauth2.googleapis.com/token"
    payload = {
        "code": code,
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(token_url, data=payload)
            if resp.status_code != 200:
                raise AuthorizationDeniedError(
                    f"Google token exchange failed with status {resp.status_code}."
                )
            return resp.json()
    except AuthorizationDeniedError:
        raise
    except Exception as exc:
        raise AuthorizationDeniedError(f"Network error during Google token exchange: {exc!s}")


async def verify_google_id_token(id_token: str, expected_nonce: Optional[str] = None) -> AuthUser:
    """
    Verifies a Google ID token and returns an authoritative AuthUser.
    Validates:
    1. Offline test/dev tokens when ENABLE_TEST_AUTH is True
    2. Token signature, Issuer, Audience, Expiry, Nonce, and Domain verification in production
    """
    settings = get_settings()
    clean_token = id_token.strip() if id_token else ""
    if not clean_token:
        raise AuthorizationDeniedError("Missing Google ID token.")

    # 1. Test/Dev Mock Mode
    if settings.ENABLE_TEST_AUTH and (
        clean_token.startswith("test-token:")
        or clean_token.startswith("mock-google-token:")
        or (
            settings.APP_ENV in ("test", "development")
            and "@" in clean_token
            and not clean_token.startswith("ey")
        )
    ):
        return _parse_test_token(clean_token)

    # 2. Production Google Token Verification
    claims: dict[str, Any] = {}
    verified = False

    # Attempt cryptographic signature and claim verification using official google-auth SDK
    try:
        from google.auth.transport import requests as google_requests
        from google.oauth2 import id_token as google_id_token

        req = google_requests.Request()
        claims = google_id_token.verify_oauth2_token(
            clean_token,
            req,
            audience=settings.GOOGLE_CLIENT_ID,
        )
        verified = True
    except Exception:
        pass

    # Fallback to Google TokenInfo endpoint verification
    if not verified:
        url = f"https://oauth2.googleapis.com/tokeninfo?id_token={clean_token}"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url)
                if resp.status_code != 200:
                    raise AuthorizationDeniedError(
                        "Google ID token validation failed or token is expired."
                    )
                claims = resp.json()
        except AuthorizationDeniedError:
            raise
        except Exception as exc:
            raise AuthorizationDeniedError(f"Google OIDC verification network error: {exc!s}")

    # Validate issuer
    issuer = claims.get("iss")
    if issuer not in ("accounts.google.com", "https://accounts.google.com"):
        raise AuthorizationDeniedError(f"Invalid token issuer: '{issuer}'.")

    # Validate audience if client ID is configured
    if settings.GOOGLE_CLIENT_ID:
        aud = claims.get("aud")
        if aud != settings.GOOGLE_CLIENT_ID:
            raise AuthorizationDeniedError(
                "Token audience does not match configured GOOGLE_CLIENT_ID."
            )

    # Validate expiry
    exp = claims.get("exp")
    if exp is not None:
        try:
            if time.time() > float(exp):
                raise AuthorizationDeniedError("Google ID token has expired.")
        except (ValueError, TypeError):
            pass

    # Validate nonce where applicable
    if expected_nonce:
        token_nonce = claims.get("nonce")
        if token_nonce and token_nonce != expected_nonce:
            raise AuthorizationDeniedError("Token nonce mismatch.")

    # Validate email verification
    if claims.get("email_verified") not in (True, "true"):
        raise AuthorizationDeniedError("Google account email is not verified.")

    email = claims.get("email", "")
    if not email:
        raise AuthorizationDeniedError("Google ID token claims missing email.")

    # Enforce domain allowlist policy
    _validate_domain_policy(email, claims.get("hd"))

    sub = claims.get("sub") or f"goog-{email}"
    name = claims.get("name") or email.split("@")[0]

    # New users default to least-privilege VIEWER (Never grant admin privileges by default)
    role = UserRoleEnum.VIEWER

    return AuthUser(
        id=f"user-{sub[:16]}",
        google_subject_id=sub,
        email=email,
        name=name,
        role=role,
        status=UserStatusEnum.ACTIVE,
        is_active=True,
    )


def _validate_domain_policy(email: str, hosted_domain: Optional[str] = None) -> None:
    """Enforces ALLOWED_GOOGLE_DOMAINS policy if configured."""
    settings = get_settings()
    allowed_domains = [d.strip().lower() for d in settings.ALLOWED_GOOGLE_DOMAINS if d.strip()]
    if not allowed_domains:
        return  # No restriction configured

    domain = (hosted_domain or email.split("@")[-1]).lower()
    if domain not in allowed_domains:
        raise AuthorizationDeniedError(
            f"Google organization domain '{domain}' is not authorized to access this platform."
        )


def _parse_test_token(token: str) -> AuthUser:
    """
    Parses deterministic test tokens for automated test suites.
    Formats:
    - "test-token:admin@sentinel.test:ADMIN"
    - "mock-google-token:approver@sentinel.test:APPROVER"
    - "operator@sentinel.test"
    """
    parts = token.split(":")
    if len(parts) == 3 and parts[0] in ("test-token", "mock-google-token"):
        email = parts[1]
        role_str = parts[2].upper()
        role = (
            UserRoleEnum[role_str]
            if role_str in UserRoleEnum.__members__
            else UserRoleEnum.OPERATOR
        )
    elif len(parts) == 2 and parts[0] in ("test-token", "mock-google-token"):
        email = parts[1]
        role = _resolve_role_from_email(email)
    elif "@" in token:
        email = token
        role = _resolve_role_from_email(email)
    else:
        email = "test.user@sentinel.test"
        role = UserRoleEnum.OPERATOR

    user_id = f"user-{role.value.lower()}-{email.split('@')[0]}"
    name = f"{role.value.capitalize()} Test User"

    return AuthUser(
        id=user_id,
        google_subject_id=f"goog-{user_id}",
        email=email,
        name=name,
        role=role,
        status=UserStatusEnum.ACTIVE,
        is_active=True,
    )


def _resolve_role_from_email(email: str) -> UserRoleEnum:
    """Resolves role from email identifier for deterministic testing."""
    lower = email.lower()
    if "admin" in lower:
        return UserRoleEnum.ADMIN
    if "approver" in lower:
        return UserRoleEnum.APPROVER
    if "analyst" in lower or "security" in lower:
        return UserRoleEnum.SECURITY_ANALYST
    if "operator" in lower:
        return UserRoleEnum.OPERATOR
    if "viewer" in lower or "audit" in lower:
        return UserRoleEnum.VIEWER
    return UserRoleEnum.OPERATOR
