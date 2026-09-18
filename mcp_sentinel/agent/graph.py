"""
LangGraph Agent Workflow Definition for MCP-Sentinel.
Implements the core reasoning loop, dynamic tool invocation,
and loop protection safety controls.
"""

from typing import Any, Optional

from langgraph.graph import END, START, StateGraph

from mcp_sentinel.agent.mcp_client import SentinelMCPClient
from mcp_sentinel.agent.prompts import AGENT_SYSTEM_PROMPT
from mcp_sentinel.agent.providers.base import AgentMessage, LLMProvider
from mcp_sentinel.agent.state import AgentState
from mcp_sentinel.config.settings import Settings, get_settings
from mcp_sentinel.security.audit_logger import (
    LOOP_LIMIT_EXCEEDED,
    log_security_event,
)


def create_agent_graph(
    provider: LLMProvider,
    mcp_client: SentinelMCPClient,
    settings: Optional[Settings] = None,
):
    """
    Constructs and compiles the LangGraph StateGraph agent workflow.
    """
    cfg = settings or get_settings()
    max_iterations = cfg.MAX_AGENT_ITERATIONS
    max_tool_calls = cfg.MAX_TOOL_CALLS

    # 1. Agent Reasoning Node
    async def agent_node(state: AgentState) -> dict[str, Any]:
        current_iterations = state.get("iteration_count", 0)

        # Check loop limit before calling provider
        if current_iterations >= max_iterations:
            return {
                "iteration_count": current_iterations,
                "status": "max_iterations_reached",
            }

        # Ensure MCP tools are discovered
        tools = mcp_client.get_tool_definitions()
        if not tools:
            tools = await mcp_client.discover_tools()

        # Call the LLM provider
        response = await provider.generate_response(
            messages=state["messages"],
            tools=tools,
            system_instruction=AGENT_SYSTEM_PROMPT,
        )

        new_iterations = current_iterations + 1
        updated_messages = list(state["messages"])

        if response.has_tool_calls:
            # Model requested one or more tool calls
            updated_messages.append(
                AgentMessage(
                    role="assistant",
                    content=response.content,
                    tool_calls=response.tool_calls,
                )
            )
            return {
                "messages": updated_messages,
                "tool_calls": response.tool_calls,
                "iteration_count": new_iterations,
                "status": "running",
            }

        # Model produced a natural-language answer
        updated_messages.append(
            AgentMessage(
                role="assistant",
                content=response.content or "",
            )
        )

        # Determine if final state should reflect approval_required
        status = "completed"
        for tr in state.get("tool_results", []):
            if tr.get("reason") == "approval_required" or tr.get("status") == "blocked":
                status = "approval_required"
                break

        return {
            "messages": updated_messages,
            "tool_calls": [],
            "final_response": response.content or "",
            "status": status,
            "iteration_count": new_iterations,
        }

    # 2. MCP Tools Execution Node
    async def mcp_tools_node(state: AgentState) -> dict[str, Any]:
        tool_results = list(state.get("tool_results", []))
        updated_messages = list(state["messages"])
        pending_calls = state.get("tool_calls", [])
        rid = state.get("request_id")

        for tc in pending_calls:
            # Guard against exceeding maximum allowed tool calls
            if len(tool_results) >= max_tool_calls:
                log_security_event(
                    event_type=LOOP_LIMIT_EXCEEDED,
                    action="max_tool_calls_exceeded",
                    decision="BLOCK",
                    risk_classification="HIGH",
                    agent_id=cfg.AGENT_ID,
                    success=False,
                    error_code="MAX_TOOL_CALLS_EXCEEDED",
                    details={"limit": max_tool_calls},
                    request_id=rid,
                )
                return {
                    "tool_calls": [],
                    "status": "max_iterations_reached",
                    "final_response": "The agent stopped execution because the maximum allowed tool call limit was reached.",
                }

            # Call the MCP server through the security-hardened client
            result_data = await mcp_client.call_tool(
                name=tc.name,
                arguments=tc.args,
                request_id=rid,
            )

            # Record structured audit and status info
            if result_data.get("status") == "approval_required":
                tool_results.append(
                    {
                        "tool": tc.name,
                        "status": "blocked",
                        "reason": "approval_required",
                        "details": result_data.get("message", "Approval required."),
                    }
                )
            elif result_data.get("status") == "success":
                tool_results.append(
                    {
                        "tool": tc.name,
                        "status": "success",
                    }
                )
            else:
                tool_results.append(
                    {
                        "tool": tc.name,
                        "status": "error",
                        "error_type": result_data.get("error_type", "UnknownError"),
                    }
                )

            # Enclose returned database data in untrusted markers
            wrapped_content = mcp_client.wrap_untrusted_data(tc.name, result_data)

            updated_messages.append(
                AgentMessage(
                    role="tool",
                    content=wrapped_content,
                    tool_call_id=tc.id,
                    name=tc.name,
                )
            )

        return {
            "messages": updated_messages,
            "tool_calls": [],
            "tool_results": tool_results,
        }

    # 3. Safe Max Iterations Handler Node
    async def max_iterations_node(state: AgentState) -> dict[str, Any]:
        rid = state.get("request_id")
        log_security_event(
            event_type=LOOP_LIMIT_EXCEEDED,
            action="agent_loop_protection",
            decision="ABORT",
            risk_classification="HIGH",
            agent_id=cfg.AGENT_ID,
            success=False,
            error_code="MAX_AGENT_ITERATIONS_REACHED",
            details={"iterations": state.get("iteration_count", 0), "limit": max_iterations},
            request_id=rid,
        )
        return {
            "status": "max_iterations_reached",
            "final_response": "The operation could not be completed because the maximum allowed reasoning steps were reached.",
            "tool_calls": [],
        }

    # 4. Conditional Edge Router
    def route_after_agent(state: AgentState) -> str:
        if state.get("status") == "max_iterations_reached":
            return "max_iterations"
        if state.get("tool_calls") and len(state["tool_calls"]) > 0:
            return "mcp_tools"
        return END

    # 5. Build StateGraph
    workflow = StateGraph(AgentState)
    workflow.add_node("agent", agent_node)
    workflow.add_node("mcp_tools", mcp_tools_node)
    workflow.add_node("max_iterations", max_iterations_node)

    workflow.add_edge(START, "agent")
    workflow.add_conditional_edges(
        "agent",
        route_after_agent,
        {
            "max_iterations": "max_iterations",
            "mcp_tools": "mcp_tools",
            END: END,
        },
    )
    workflow.add_edge("mcp_tools", "agent")
    workflow.add_edge("max_iterations", END)

    return workflow.compile()
