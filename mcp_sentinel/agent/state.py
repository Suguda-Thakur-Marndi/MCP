"""
Agent State Definition for LangGraph in MCP-Sentinel.
Maintains typed state across reasoning and MCP tool execution cycles.
"""

from typing import Any, Optional, TypedDict

from mcp_sentinel.agent.providers.base import AgentMessage, ToolCall


class AgentState(TypedDict):
    """
    State passed between nodes in the LangGraph agent workflow.
    """

    messages: list[AgentMessage]
    tool_calls: list[ToolCall]
    tool_results: list[dict[str, Any]]
    request_id: str
    conversation_id: str
    iteration_count: int
    status: str  # "running", "completed", "approval_required", "max_iterations_reached", "error"
    final_response: Optional[str]
