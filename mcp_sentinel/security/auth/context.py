"""
Security Principal Context for MCP-Sentinel Phase 6.
Provides thread-safe and asyncio-safe context variable propagation for the
authenticated human user across FastAPI, LangGraph, FastMCP, and PostgreSQL layers.
Adheres strictly to:
- The AI model is NOT trusted to provide or select user identity.
- User-supplied identity in request bodies or tool parameters is NOT trusted.
- The authenticated identity bound at the API boundary remains the sole authoritative principal.
"""

import contextvars
from typing import Optional

from mcp_sentinel.security.auth.models import AuthUser

_current_user_ctx: contextvars.ContextVar[Optional[AuthUser]] = contextvars.ContextVar(
    "current_user", default=None
)


def get_current_user_context() -> Optional[AuthUser]:
    """
    Retrieves the authoritative authenticated AuthUser security principal
    from the current execution context.
    Returns None if unauthenticated.
    """
    return _current_user_ctx.get()


def set_current_user_context(user: Optional[AuthUser]) -> None:
    """
    Binds the authoritative authenticated user to the current asyncio task.
    Must only be invoked by trusted authentication dependencies or middleware.
    """
    _current_user_ctx.set(user)


def clear_current_user_context() -> None:
    """
    Clears the security principal context variable.
    """
    _current_user_ctx.set(None)
