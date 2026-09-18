"""
Agent HTTP API for MCP-Sentinel.
Exposes secure POST /api/agent/chat endpoint.
Complies with:
- Security Rule #1: Never trust user/agent input.
- Security Rule #5: Never expose credentials or secrets.
- Security Rule #9: Do not expose stack traces or secrets to users.
"""

from typing import Optional

from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route

from mcp_sentinel.agent.service import AgentService
from mcp_sentinel.security.audit_logger import log_security_event
from mcp_sentinel.security.correlation import set_request_id


def create_agent_app(agent_service: Optional[AgentService] = None) -> Starlette:
    """
    Creates and configures the Starlette application exposing the Agent Chat API.
    """
    svc = agent_service or AgentService()

    async def chat_endpoint(request: Request) -> JSONResponse:
        # 1. Parse JSON payload
        try:
            body = await request.json()
        except Exception:
            return JSONResponse(
                {
                    "status": "error",
                    "error_type": "ValidationError",
                    "message": "Invalid JSON payload.",
                },
                status_code=400,
            )

        if not isinstance(body, dict):
            return JSONResponse(
                {
                    "status": "error",
                    "error_type": "ValidationError",
                    "message": "Request body must be a JSON object.",
                },
                status_code=400,
            )

        message = body.get("message")
        if not message or not isinstance(message, str) or not message.strip():
            return JSONResponse(
                {
                    "status": "error",
                    "error_type": "ValidationError",
                    "message": "Field 'message' is required and must be a non-empty string.",
                },
                status_code=400,
            )

        user_message = message.strip()
        conversation_id = body.get("conversation_id")
        request_id = body.get("request_id")

        rid = set_request_id(request_id)

        # 2. Execute chat through agent service
        try:
            result = await svc.run_chat(
                message=user_message,
                conversation_id=conversation_id,
                request_id=rid,
            )
            return JSONResponse(
                {
                    "request_id": result.request_id,
                    "conversation_id": result.conversation_id,
                    "response": result.response,
                    "status": result.status,
                    "tool_calls": result.tool_calls,
                },
                status_code=200,
            )
        except Exception as exc:
            log_security_event(
                event_type="AGENT_API_ERROR",
                action="chat_endpoint",
                decision="FAIL",
                risk_classification="HIGH",
                success=False,
                error_code="INTERNAL_SERVER_ERROR",
                details={"error_type": type(exc).__name__},
                request_id=rid,
            )
            # Fail closed: never leak stack trace or internal details
            return JSONResponse(
                {
                    "request_id": rid,
                    "status": "error",
                    "error_type": "ServerError",
                    "message": "An internal error occurred while processing the request.",
                },
                status_code=500,
            )

    async def health_endpoint(request: Request) -> JSONResponse:
        return JSONResponse(
            {
                "status": "healthy",
                "service": "mcp-sentinel-agent",
            },
            status_code=200,
        )

    routes = [
        Route("/api/agent/chat", chat_endpoint, methods=["POST"]),
        Route("/health", health_endpoint, methods=["GET"]),
    ]

    return Starlette(debug=False, routes=routes)
