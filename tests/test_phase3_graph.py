"""
Phase 3 Tests: LangGraph Workflow Execution and Loop Protection.
Verifies:
1. Basic state transitions: START -> agent -> END.
2. Tool execution transitions: START -> agent -> mcp_tools -> agent -> END.
3. Loop protection: MAX_AGENT_ITERATIONS enforcement prevents runaway execution.
4. Max tool calls enforcement.
"""

import pytest

from mcp_sentinel.agent.graph import create_agent_graph
from mcp_sentinel.agent.mcp_client import SentinelMCPClient
from mcp_sentinel.agent.providers.base import (
    AgentMessage,
    LLMResponse,
    ToolCall,
)
from mcp_sentinel.agent.providers.mock import MockLLMProvider
from mcp_sentinel.config.settings import Settings
from mcp_sentinel.server.app import create_app


@pytest.mark.asyncio
async def test_graph_direct_answer(db_pool):
    provider = MockLLMProvider(
        responses=[
            LLMResponse(content="I can help you with customer accounts.", tool_calls=[]),
        ]
    )
    server = create_app()
    mcp_client = SentinelMCPClient(server_instance=server)
    graph = create_agent_graph(provider=provider, mcp_client=mcp_client)

    initial_state = {
        "messages": [AgentMessage(role="user", content="Hello")],
        "tool_calls": [],
        "tool_results": [],
        "request_id": "req-test-direct",
        "conversation_id": "conv-test",
        "iteration_count": 0,
        "status": "running",
        "final_response": None,
    }

    final_state = await graph.ainvoke(initial_state)
    assert final_state["status"] == "completed"
    assert "I can help you" in final_state["final_response"]
    assert final_state["iteration_count"] == 1


@pytest.mark.asyncio
async def test_graph_tool_execution_cycle(db_pool):
    provider = MockLLMProvider(
        responses=[
            LLMResponse(
                content=None,
                tool_calls=[
                    ToolCall(id="call_1", name="get_customer", args={"customer_id": "CUST-000001"})
                ],
            ),
            LLMResponse(
                content="Customer CUST-000001 is Acme Corp Alpha.",
                tool_calls=[],
            ),
        ]
    )
    server = create_app()
    mcp_client = SentinelMCPClient(server_instance=server)
    graph = create_agent_graph(provider=provider, mcp_client=mcp_client)

    initial_state = {
        "messages": [AgentMessage(role="user", content="Find customer CUST-000001")],
        "tool_calls": [],
        "tool_results": [],
        "request_id": "req-test-tool-cycle",
        "conversation_id": "conv-test",
        "iteration_count": 0,
        "status": "running",
        "final_response": None,
    }

    final_state = await graph.ainvoke(initial_state)
    assert final_state["status"] == "completed"
    assert "Acme Corp Alpha" in final_state["final_response"]
    assert len(final_state["tool_results"]) == 1
    assert final_state["tool_results"][0]["tool"] == "get_customer"
    assert final_state["tool_results"][0]["status"] == "success"
    assert final_state["iteration_count"] == 2


@pytest.mark.asyncio
async def test_graph_loop_protection_max_iterations(db_pool):
    """Verifies that an agent repeatedly calling tools is safely halted at MAX_AGENT_ITERATIONS."""

    # Build a provider that endlessly requests get_customer
    def endless_tool_caller(messages, tools):
        return LLMResponse(
            content=None,
            tool_calls=[
                ToolCall(id="call_loop", name="get_customer", args={"customer_id": "CUST-000001"})
            ],
        )

    provider = MockLLMProvider(custom_handler=endless_tool_caller)
    server = create_app()
    mcp_client = SentinelMCPClient(server_instance=server)

    # Configure a small max_iterations for test
    settings = Settings(
        DATABASE_URL="postgresql://app_user:CHANGE_ME_PASSWORD@localhost:5000/mcp_sentinel_db",
        MAX_AGENT_ITERATIONS=3,
    )

    graph = create_agent_graph(provider=provider, mcp_client=mcp_client, settings=settings)

    initial_state = {
        "messages": [AgentMessage(role="user", content="Trigger infinite loop")],
        "tool_calls": [],
        "tool_results": [],
        "request_id": "req-test-loop",
        "conversation_id": "conv-test",
        "iteration_count": 0,
        "status": "running",
        "final_response": None,
    }

    final_state = await graph.ainvoke(initial_state)
    assert final_state["status"] == "max_iterations_reached"
    assert final_state["iteration_count"] >= 3
    assert "maximum allowed" in final_state["final_response"]
