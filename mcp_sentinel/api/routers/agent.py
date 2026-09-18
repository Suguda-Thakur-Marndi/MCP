"""
Agent API Router for MCP-Sentinel.
Exposes secure AI agent reasoning endpoint orchestrating Gemini, LangGraph, and FastMCP tools.
"""

import json
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from mcp_sentinel.agent.service import AgentService
from mcp_sentinel.config.settings import get_settings
from mcp_sentinel.database.connection import get_db_pool
from mcp_sentinel.security.audit_logger import IDENTITY_SPOOFING_BLOCKED, log_security_event
from mcp_sentinel.security.auth.dependencies import get_current_user, require_permission
from mcp_sentinel.security.auth.models import AuthUser
from mcp_sentinel.security.auth.rbac import PERM_CHAT_AGENT
from mcp_sentinel.security.correlation import set_request_id

router = APIRouter(prefix="/api/agent", tags=["Agent"])


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=10000)
    conversation_id: Optional[str] = Field(default=None, max_length=64)
    request_id: Optional[str] = Field(default=None, max_length=64)
    user_id: Optional[str] = Field(
        default=None, max_length=64, description="Untrusted client-supplied identity claim."
    )


class ChatResponse(BaseModel):
    request_id: str
    conversation_id: str
    response: str
    status: str
    tool_calls: list[dict[str, Any]] = []
    iteration_count: int = 0


_agent_service: Optional[AgentService] = None


def get_agent_service() -> AgentService:
    global _agent_service
    if _agent_service is None:
        settings = get_settings()
        if not settings.GEMINI_API_KEY and settings.ENABLE_TEST_AUTH:
            from mcp_sentinel.agent.providers.mock import MockLLMProvider

            _agent_service = AgentService(provider=MockLLMProvider())
        else:
            _agent_service = AgentService()
    return _agent_service


@router.post(
    "/chat",
    response_model=ChatResponse,
    summary="Execute conversational AI turn with LangGraph and MCP tools",
)
async def chat_endpoint(
    req: ChatRequest,
    current_user: AuthUser = Depends(require_permission(PERM_CHAT_AGENT)),
) -> ChatResponse:
    """
    Executes an AI agent reasoning turn over FastMCP enterprise tools.
    Authenticated with authoritative user context and correlated with request_id.
    Actively discards client-supplied user_id to prevent identity spoofing.
    """
    rid = set_request_id(req.request_id)

    # Mandatory Test 41: Detect and neutralize identity spoofing attempt
    if req.user_id and req.user_id != current_user.id:
        log_security_event(
            event_type=IDENTITY_SPOOFING_BLOCKED,
            action="chat_endpoint",
            decision="BLOCK",
            risk_classification="CRITICAL",
            user_id=current_user.id,
            success=False,
            error_code="IDENTITY_SPOOFING_ATTEMPT",
            details={
                "attempted_spoofed_user_id": req.user_id,
                "authoritative_user_id": current_user.id,
            },
            request_id=rid,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Identity spoofing detected: You cannot select or override the user identity.",
        )

    svc = get_agent_service()

    try:
        result = await svc.run_chat(
            message=req.message,
            conversation_id=req.conversation_id,
            request_id=rid,
            user=current_user,
        )
        return ChatResponse(
            request_id=result.request_id,
            conversation_id=result.conversation_id,
            response=result.response,
            status=result.status,
            tool_calls=result.tool_calls,
            iteration_count=result.iteration_count,
        )
    except Exception as exc:
        log_security_event(
            event_type="AGENT_API_ERROR",
            action="chat_endpoint",
            decision="FAIL",
            risk_classification="HIGH",
            user_id=current_user.id,
            success=False,
            error_code="INTERNAL_SERVER_ERROR",
            details={"error_type": type(exc).__name__},
            request_id=rid,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal error occurred while processing the agent request.",
        )


@router.get(
    "/status",
    summary="Get Agent configuration and status",
)
async def agent_status(current_user: AuthUser = Depends(get_current_user)) -> dict[str, Any]:
    settings = get_settings()
    return {
        "status": "ready",
        "agent_id": settings.AGENT_ID,
        "model": settings.GEMINI_MODEL,
        "max_iterations": settings.MAX_AGENT_ITERATIONS,
        "max_tool_calls": settings.MAX_TOOL_CALLS,
        "tool_timeout_seconds": settings.TOOL_TIMEOUT_SECONDS,
        "tools_registered": 4,
    }


@router.get(
    "/executions",
    summary="Get recent agent tool execution history",
)
async def get_agent_executions(
    limit: int = Query(default=20, ge=1, le=100),
    current_user: AuthUser = Depends(get_current_user),
) -> dict[str, Any]:
    """
    Returns real agent tool executions and security decisions from PostgreSQL audit_events.
    """
    pool = await get_db_pool()
    query = """
        SELECT id, event_type, actor_type, actor_id, tool_name, decision, request_id, details, created_at
        FROM audit_events
        WHERE actor_type = 'agent' OR tool_name IS NOT NULL
        ORDER BY created_at DESC
        LIMIT $1
    """
    async with pool.acquire() as conn:
        rows = await conn.fetch(query, limit)

    executions = []
    for r in rows:
        item = dict(r)
        if item.get("created_at"):
            item["created_at"] = item["created_at"].isoformat()
        if isinstance(item.get("details"), str):
            try:
                item["details"] = json.loads(item["details"])
            except Exception:
                pass
        executions.append(item)

    return {
        "status": "success",
        "count": len(executions),
        "executions": executions,
    }
