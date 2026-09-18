"""
JWT Session Token Issuance and Verification for MCP-Sentinel.
Adheres to:
- Secure symmetric signature verification (HS256).
- Strict expiration bounds.
- Cryptographic payload typing.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt

from mcp_sentinel.config.settings import get_settings
from mcp_sentinel.security.auth.models import AuthUser, TokenPayload, UserRoleEnum
from mcp_sentinel.security.exceptions import AuthorizationDeniedError


def create_access_token(
    user: AuthUser,
    expires_delta: Optional[timedelta] = None,
    session_id: Optional[str] = None,
) -> str:
    """
    Creates a signed JWT access token for an authenticated user.
    Optionally binds a stateful session_id for server-side revocation tracking.
    """
    settings = get_settings()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.JWT_EXPIRATION_MINUTES)

    payload = {
        "sub": user.id,
        "email": user.email,
        "name": user.name,
        "role": user.role.value,
        "session_id": session_id,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
        "iss": "mcp-sentinel-auth",
    }

    token = jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )
    return token


def decode_access_token(token: str) -> TokenPayload:
    """
    Decodes and validates a signed Sentinel JWT session token.
    Fails closed if expired, signature invalid, or malformed.
    """
    settings = get_settings()
    try:
        data = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
            issuer="mcp-sentinel-auth",
        )
        return TokenPayload(
            sub=data["sub"],
            email=data["email"],
            name=data["name"],
            role=UserRoleEnum(data["role"]),
            session_id=data.get("session_id"),
            exp=data["exp"],
            iat=data["iat"],
            iss=data.get("iss", "mcp-sentinel-auth"),
        )
    except jwt.ExpiredSignatureError:
        raise AuthorizationDeniedError("Authentication session has expired. Please log in again.")
    except (jwt.InvalidTokenError, Exception):
        raise AuthorizationDeniedError("Invalid authentication token.")
