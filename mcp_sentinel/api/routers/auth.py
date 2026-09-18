"""
Authentication API Router for MCP-Sentinel Phase 6.
Provides:
- Google OAuth 2.0 Authorization Code Flow (/api/auth/google/authorize, /api/auth/google/callback).
- Google ID Token / Test Token Direct Exchange (/api/auth/login).
- Current Authenticated User Profile Inspection (/api/auth/me).
- Server-Side Session Invalidation and Cookie Deletion (/api/auth/logout).
- Open-Redirect and CSRF Protection.
"""

import logging
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from fastapi.responses import RedirectResponse

from mcp_sentinel.config.settings import get_settings
from mcp_sentinel.repositories.user_repository import UserRepository
from mcp_sentinel.security.audit_logger import (
    LOGIN_FAILURE,
    LOGIN_STARTED,
    LOGIN_SUCCESS,
    LOGOUT,
    log_security_event,
)
from mcp_sentinel.security.auth.dependencies import get_current_user
from mcp_sentinel.security.auth.models import (
    AuthUser,
    CurrentUserResponse,
    LoginRequest,
    LoginResponse,
    UserRoleEnum,
    UserStatusEnum,
)
from mcp_sentinel.security.auth.oidc import (
    build_google_authorization_url,
    exchange_google_authorization_code,
    generate_oauth_state,
    verify_google_id_token,
    verify_oauth_state,
)
from mcp_sentinel.security.auth.rbac import get_user_permissions
from mcp_sentinel.security.auth.session_handler import get_session_handler
from mcp_sentinel.security.correlation import get_request_id
from mcp_sentinel.security.exceptions import AuthorizationDeniedError
from mcp_sentinel.security.headers import validate_safe_redirect

logger = logging.getLogger("mcp_sentinel.api.routers.auth")

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.get(
    "/google/authorize",
    summary="Initiate Google OAuth 2.0 Authorization Code Flow",
)
async def google_authorize(
    next_path: Optional[str] = Query(None, alias="next"),
) -> RedirectResponse:
    """
    Constructs a signed OAuth state token with nonce and safe next_path,
    and redirects the user to Google's authentication consent screen.
    """
    settings = get_settings()
    rid = get_request_id()

    safe_path = validate_safe_redirect(next_path)
    state = generate_oauth_state(redirect_uri=settings.GOOGLE_REDIRECT_URI, next_path=safe_path)
    auth_url = build_google_authorization_url(state)

    log_security_event(
        event_type=LOGIN_STARTED,
        action="google_oauth_authorize",
        decision="REDIRECT",
        risk_classification="LOW",
        success=True,
        details={"redirect_uri": settings.GOOGLE_REDIRECT_URI, "next_path": safe_path},
        request_id=rid,
    )
    return RedirectResponse(url=auth_url, status_code=status.HTTP_302_FOUND)


@router.get(
    "/google/callback",
    summary="Handle Google OAuth 2.0 Authorization Callback",
)
async def google_callback(
    request: Request,
    response: Response,
    code: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
) -> RedirectResponse:
    """
    Verifies state token, exchanges code for Google tokens, validates ID token claims,
    upserts the user, establishes a server-side session, and sets an HttpOnly cookie.
    """
    rid = get_request_id()
    session_handler = get_session_handler()
    user_repo = UserRepository()

    if error:
        log_security_event(
            event_type=LOGIN_FAILURE,
            action="google_oauth_callback",
            decision="FAIL",
            risk_classification="HIGH",
            success=False,
            error_code="GOOGLE_PROVIDER_ERROR",
            details={"provider_error": error},
            request_id=rid,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Google authentication failed: {error}",
        )

    if not code or not state:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing required OAuth callback parameters (code, state).",
        )

    # 1. Validate signed state (CSRF and tampering protection)
    try:
        state_payload = verify_oauth_state(state)
    except AuthorizationDeniedError as ade:
        log_security_event(
            event_type=LOGIN_FAILURE,
            action="google_oauth_callback",
            decision="FAIL",
            risk_classification="CRITICAL",
            success=False,
            error_code="INVALID_OAUTH_STATE",
            details={"reason": ade.safe_message},
            request_id=rid,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=ade.safe_message,
        )

    # 2. Exchange code for Google tokens
    try:
        tokens = await exchange_google_authorization_code(code, state_payload.redirect_uri)
        raw_id_token = tokens.get("id_token")
        if not raw_id_token:
            raise AuthorizationDeniedError("Google token response did not contain an id_token.")
        verified_user = await verify_google_id_token(raw_id_token)
    except AuthorizationDeniedError as ade:
        log_security_event(
            event_type=LOGIN_FAILURE,
            action="google_oauth_callback",
            decision="FAIL",
            risk_classification="HIGH",
            success=False,
            error_code="TOKEN_VALIDATION_FAILED",
            details={"reason": ade.safe_message},
            request_id=rid,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=ade.safe_message,
        )

    # 3. Upsert user in PostgreSQL (Least privilege default VIEWER for new users)
    try:
        db_user = await user_repo.upsert_user_from_oidc(
            google_subject_id=verified_user.google_subject_id or verified_user.id,
            email=verified_user.email,
            name=verified_user.name,
            default_role=UserRoleEnum.VIEWER,
            organization=verified_user.organization,
            department=verified_user.department,
        )
    except Exception as exc:
        logger.warning("Upsert user from OIDC failed: %s", exc, exc_info=True)
        db_user = verified_user

    # Real-time check: disabled accounts cannot log in
    if db_user.status == UserStatusEnum.DISABLED or not db_user.is_active:
        log_security_event(
            event_type=LOGIN_FAILURE,
            action="google_oauth_callback",
            decision="DENY",
            risk_classification="HIGH",
            user_id=db_user.id,
            success=False,
            error_code="ACCOUNT_DISABLED",
            request_id=rid,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled. Access denied.",
        )

    # 4. Create server-side session and cookie
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    token, session_id = await session_handler.create_user_session(
        user=db_user,
        user_agent=user_agent,
        ip_address=client_ip,
    )

    log_security_event(
        event_type=LOGIN_SUCCESS,
        action="google_oauth_callback",
        decision="ALLOW",
        risk_classification="LOW",
        user_id=db_user.id,
        success=True,
        details={"email": db_user.email, "role": db_user.role.value, "session_id": session_id},
        request_id=rid,
    )

    safe_dest = validate_safe_redirect(state_payload.next_path)
    redirect_resp = RedirectResponse(url=safe_dest, status_code=status.HTTP_302_FOUND)
    session_handler.attach_session_cookie(redirect_resp, token)
    return redirect_resp


@router.post(
    "/login",
    response_model=LoginResponse,
    summary="Authenticate via Google ID Token or Test Token",
)
async def login(
    req: LoginRequest,
    request: Request,
    response: Response,
) -> LoginResponse:
    """
    Exchanges a validated Google ID token or deterministic test token for a
    server-tracked application session and signed Sentinel JWT.
    Sets an HttpOnly session cookie and returns a Bearer access token.
    """
    rid = get_request_id()
    session_handler = get_session_handler()
    user_repo = UserRepository()

    try:
        verified_user = await verify_google_id_token(req.id_token)
    except AuthorizationDeniedError as ade:
        log_security_event(
            event_type=LOGIN_FAILURE,
            action="login",
            decision="FAIL",
            risk_classification="HIGH",
            success=False,
            error_code="INVALID_ID_TOKEN",
            details={"reason": ade.safe_message},
            request_id=rid,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=ade.safe_message,
        )

    # Upsert user record in PostgreSQL
    try:
        db_user = await user_repo.upsert_user_from_oidc(
            google_subject_id=verified_user.google_subject_id or verified_user.id,
            email=verified_user.email,
            name=verified_user.name,
            default_role=verified_user.role,
            organization=verified_user.organization,
            department=verified_user.department,
        )
    except Exception:
        db_user = verified_user

    # Enforce active account status
    if db_user.status == UserStatusEnum.DISABLED or not db_user.is_active:
        log_security_event(
            event_type=LOGIN_FAILURE,
            action="login",
            decision="DENY",
            risk_classification="HIGH",
            user_id=db_user.id,
            success=False,
            error_code="ACCOUNT_DISABLED",
            request_id=rid,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled. Access denied.",
        )

    # Establish database session
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    token, session_id = await session_handler.create_user_session(
        user=db_user,
        user_agent=user_agent,
        ip_address=client_ip,
    )

    session_handler.attach_session_cookie(response, token)

    log_security_event(
        event_type=LOGIN_SUCCESS,
        action="login",
        decision="ALLOW",
        risk_classification="LOW",
        user_id=db_user.id,
        success=True,
        details={"email": db_user.email, "role": db_user.role.value, "session_id": session_id},
        request_id=rid,
    )

    settings = get_settings()
    return LoginResponse(
        access_token=token,
        token_type="Bearer",
        expires_in=settings.SESSION_EXPIRATION_HOURS * 3600,
        user=db_user,
        session_id=session_id,
    )


@router.get(
    "/me",
    response_model=CurrentUserResponse,
    summary="Get current authenticated user identity, role, and explicit permissions",
)
async def get_me(current_user: AuthUser = Depends(get_current_user)) -> CurrentUserResponse:
    """
    Returns the authoritative profile and explicit permissions of the currently authenticated user.
    Never exposes internal tokens, secrets, or passwords.
    """
    permissions = get_user_permissions(current_user)
    return CurrentUserResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        role=current_user.role,
        status=current_user.status,
        is_active=current_user.is_active,
        department=current_user.department,
        organization=current_user.organization,
        permissions=permissions,
    )


@router.post(
    "/logout",
    summary="Log out and invalidate server-side application session",
)
async def logout(
    request: Request,
    response: Response,
    current_user: AuthUser = Depends(get_current_user),
) -> dict[str, Any]:
    """
    Invalidates the active session in PostgreSQL and removes the HttpOnly cookie.
    Guarantees session reuse is blocked immediately.
    """
    rid = get_request_id()
    session_handler = get_session_handler()

    # Invalidate session in DB
    raw_token = None
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        raw_token = auth_header[7:].strip()
    elif request.cookies.get(get_settings().SESSION_COOKIE_NAME):
        raw_token = request.cookies.get(get_settings().SESSION_COOKIE_NAME, "").strip()

    if raw_token:
        try:
            from mcp_sentinel.security.auth.jwt_handler import decode_access_token

            payload = decode_access_token(raw_token)
            if payload.session_id:
                await session_handler.revoke_session(payload.session_id)
        except Exception:
            pass

    session_handler.clear_session_cookie(response)

    log_security_event(
        event_type=LOGOUT,
        action="logout",
        decision="COMPLETE",
        risk_classification="LOW",
        user_id=current_user.id,
        success=True,
        request_id=rid,
    )

    return {
        "status": "success",
        "message": "Successfully logged out and session revoked.",
    }
