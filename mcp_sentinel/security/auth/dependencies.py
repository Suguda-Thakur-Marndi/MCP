"""
FastAPI Security Dependencies for Authentication and Authorization.
Extracts, authenticates, and validates identity from HttpOnly cookies,
Authorization Bearer tokens, or test headers (in dev/test mode).
Sets the active security principal context and enforces RBAC/ABAC boundaries.
"""

from typing import Callable, Optional

from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from mcp_sentinel.config.settings import get_settings
from mcp_sentinel.security.auth.abac import ABACEvaluator
from mcp_sentinel.security.auth.context import set_current_user_context
from mcp_sentinel.security.auth.models import AuthUser, UserRoleEnum, UserStatusEnum
from mcp_sentinel.security.auth.rbac import has_permission
from mcp_sentinel.security.auth.session_handler import get_session_handler
from mcp_sentinel.security.exceptions import AuthorizationDeniedError

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    x_test_role: Optional[str] = Header(None, alias="X-Test-User-Role"),
    x_test_email: Optional[str] = Header(None, alias="X-Test-User-Email"),
) -> AuthUser:
    """
    Authoritative identity extraction dependency.
    Extracts credentials from:
    1. HTTP-only session cookie (sentinel_session)
    2. Authorization: Bearer <token>
    3. Test headers (only active if ENABLE_TEST_AUTH is True)

    Validates session state in PostgreSQL, enforces account active status,
    and binds the user to the thread-safe security principal context.
    """
    settings = get_settings()
    session_handler = get_session_handler()

    # 1. Extract token from Bearer header or Session Cookie
    raw_token: Optional[str] = None
    if credentials and credentials.credentials:
        raw_token = credentials.credentials.strip()
    elif request.cookies.get(settings.SESSION_COOKIE_NAME):
        raw_token = request.cookies.get(settings.SESSION_COOKIE_NAME, "").strip()

    # 2. If session token or cookie is provided, authoritative session validation MUST take precedence
    if raw_token:
        try:
            user = await session_handler.validate_session(raw_token)
            ABACEvaluator.check_account_status(user)
            set_current_user_context(user)
            return user
        except AuthorizationDeniedError as ade:
            status_code = (
                status.HTTP_403_FORBIDDEN
                if "disabled" in ade.safe_message.lower()
                else status.HTTP_401_UNAUTHORIZED
            )
            raise HTTPException(
                status_code=status_code,
                detail=ade.safe_message,
                headers={"WWW-Authenticate": "Bearer"},
            )
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired authentication session.",
                headers={"WWW-Authenticate": "Bearer"},
            )

    # 3. Dev / Test Header Shortcut (Strictly fallback when no session token is present and ENABLE_TEST_AUTH is True)
    if settings.ENABLE_TEST_AUTH and (x_test_role or x_test_email):
        role_str = (x_test_role or "OPERATOR").upper()
        role = (
            UserRoleEnum[role_str]
            if role_str in UserRoleEnum.__members__
            else UserRoleEnum.OPERATOR
        )
        email = x_test_email or f"{role.value.lower()}@sentinel.test"
        user = AuthUser(
            id=f"user-{role.value.lower()}-{email.split('@')[0]}",
            google_subject_id=f"goog-{role.value.lower()}",
            email=email,
            name=f"{role.value.capitalize()} Test User",
            role=role,
            status=UserStatusEnum.ACTIVE,
            is_active=True,
        )
        set_current_user_context(user)
        return user

    # 4. Unauthenticated request rejection
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required. Missing session cookie or Bearer authorization header.",
        headers={"WWW-Authenticate": "Bearer"},
    )


def require_permission(permission: str) -> Callable[[AuthUser], AuthUser]:
    """
    Dependency factory checking that the authenticated user possesses a required permission.
    Fails closed with HTTP 403 Forbidden.
    """

    async def permission_checker(current_user: AuthUser = Depends(get_current_user)) -> AuthUser:
        if not has_permission(current_user, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access Denied: User role '{current_user.role.value}' lacks permission '{permission}'.",
            )
        return current_user

    return permission_checker


def require_roles(*allowed_roles: UserRoleEnum) -> Callable[[AuthUser], AuthUser]:
    """
    Dependency factory verifying that the authenticated user possesses one of the allowed roles.
    Fails closed with HTTP 403 Forbidden.
    """

    async def role_checker(current_user: AuthUser = Depends(get_current_user)) -> AuthUser:
        if current_user.role not in allowed_roles:
            role_names = [r.value for r in allowed_roles]
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access Denied: Role '{current_user.role.value}' not authorized. Required: {role_names}.",
            )
        return current_user

    return role_checker


async def get_current_user_optional(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    x_test_role: Optional[str] = Header(None, alias="X-Test-User-Role"),
    x_test_email: Optional[str] = Header(None, alias="X-Test-User-Email"),
) -> Optional[AuthUser]:
    """Extracts authenticated user if credentials present; returns None without raising 401."""
    try:
        return await get_current_user(request, credentials, x_test_role, x_test_email)
    except HTTPException:
        return None
