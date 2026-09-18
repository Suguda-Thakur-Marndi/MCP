"""
Request and Trace correlation context management for MCP-Sentinel.
Ensures every agent request, MCP tool execution, security check, and database query
shares a single traceable request_id and trace_id across the lifecycle.
"""

import contextvars
import uuid

_request_id_ctx: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "request_id", default=None
)
_trace_id_ctx: contextvars.ContextVar[str | None] = contextvars.ContextVar("trace_id", default=None)


def get_request_id() -> str:
    """
    Returns the current correlation request_id.
    If none is set in the context, generates and binds a new identifier.
    """
    rid = _request_id_ctx.get()
    if not rid:
        rid = f"req-{uuid.uuid4().hex[:12]}"
        _request_id_ctx.set(rid)
    return rid


def set_request_id(request_id: str | None = None) -> str:
    """
    Explicitly sets or resets the current correlation request_id.
    """
    rid = request_id or f"req-{uuid.uuid4().hex[:12]}"
    _request_id_ctx.set(rid)
    return rid


def clear_request_id() -> None:
    """
    Clears the correlation request_id variable.
    """
    _request_id_ctx.set(None)


def get_trace_id() -> str:
    """
    Returns the current distributed trace_id.
    If none is set in the context, generates and binds a new 32-char hex string (W3C standard).
    """
    tid = _trace_id_ctx.get()
    if not tid:
        tid = f"tr-{uuid.uuid4().hex}"
        _trace_id_ctx.set(tid)
    return tid


def set_trace_id(trace_id: str | None = None) -> str:
    """
    Explicitly sets or resets the current distributed trace_id.
    """
    tid = trace_id or f"tr-{uuid.uuid4().hex}"
    _trace_id_ctx.set(tid)
    return tid


def clear_trace_id() -> None:
    """
    Clears the correlation trace_id variable.
    """
    _trace_id_ctx.set(None)


def clear_all_correlation() -> None:
    """
    Clears both request_id and trace_id correlation context.
    """
    _request_id_ctx.set(None)
    _trace_id_ctx.set(None)
