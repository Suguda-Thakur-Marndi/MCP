"""
Agent Service Orchestrator for MCP-Sentinel.
Coordinates conversation turns, correlation context, and graph execution.
"""

import uuid
from dataclasses import dataclass, field
from typing import Any, Optional

from mcp_sentinel.agent.graph import create_agent_graph
from mcp_sentinel.agent.mcp_client import SentinelMCPClient
from mcp_sentinel.agent.providers.base import AgentMessage, LLMProvider
from mcp_sentinel.agent.providers.gemini import GeminiProvider
from mcp_sentinel.agent.state import AgentState
from mcp_sentinel.config.settings import Settings, get_settings
from mcp_sentinel.security.correlation import clear_request_id, set_request_id


@dataclass
class AgentResponse:
    """Structured response returned by the Sentinel AI Agent."""

    request_id: str
    conversation_id: str
    agent_id: str
    response: str
    status: str  # "completed", "approval_required", "max_iterations_reached", "error"
    tool_calls: list[dict[str, Any]] = field(default_factory=list)
    iteration_count: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "request_id": self.request_id,
            "conversation_id": self.conversation_id,
            "agent_id": self.agent_id,
            "response": self.response,
            "status": self.status,
            "tool_calls": self.tool_calls,
            "iteration_count": self.iteration_count,
        }


class AgentService:
    """
    High-level service interface for running AI agent workflows.
    Ensures end-to-end request correlation, proper resource lifecycle,
    and safe structured output formatting.
    """

    def __init__(
        self,
        provider: Optional[LLMProvider] = None,
        mcp_client: Optional[SentinelMCPClient] = None,
        settings: Optional[Settings] = None,
    ):
        self._settings = settings or get_settings()
        self._provider = provider or GeminiProvider()
        self._mcp_client = mcp_client or SentinelMCPClient()
        self._graph = create_agent_graph(
            provider=self._provider,
            mcp_client=self._mcp_client,
            settings=self._settings,
        )

    async def run_chat(
        self,
        message: str,
        conversation_id: Optional[str] = None,
        request_id: Optional[str] = None,
        user: Optional[Any] = None,
    ) -> AgentResponse:
        """
        Executes a single conversational request through the LangGraph agent workflow.
        Binds request_id and authenticated human security principal context.
        """
        from mcp_sentinel.security.auth.context import (
            clear_current_user_context,
            set_current_user_context,
        )

        rid = request_id or f"req-{uuid.uuid4().hex[:12]}"
        cid = conversation_id or f"conv-{uuid.uuid4().hex[:12]}"
        set_request_id(rid)
        if user is not None:
            set_current_user_context(user)

        try:
            initial_state: AgentState = {
                "messages": [AgentMessage(role="user", content=message)],
                "tool_calls": [],
                "tool_results": [],
                "request_id": rid,
                "conversation_id": cid,
                "iteration_count": 0,
                "status": "running",
                "final_response": None,
            }

            final_state = await self._graph.ainvoke(initial_state)

            final_text = (
                final_state.get("final_response")
                or (final_state["messages"][-1].content if final_state.get("messages") else "")
                or "No response produced."
            )

            return AgentResponse(
                request_id=rid,
                conversation_id=cid,
                agent_id=self._settings.AGENT_ID,
                response=final_text,
                status=final_state.get("status", "completed"),
                tool_calls=final_state.get("tool_results", []),
                iteration_count=final_state.get("iteration_count", 0),
            )
        finally:
            clear_request_id()
            clear_current_user_context()
