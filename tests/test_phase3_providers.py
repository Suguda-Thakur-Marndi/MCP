"""
Phase 3 Tests: LLM Provider Abstraction and Implementations.
Verifies:
1. Provider interface contract.
2. GeminiProvider schema conversion and error handling.
3. MockLLMProvider for deterministic offline execution.
"""

import pytest

from mcp_sentinel.agent.providers.base import (
    AgentMessage,
    LLMProvider,
    LLMResponse,
    ToolCall,
)
from mcp_sentinel.agent.providers.gemini import GeminiProvider
from mcp_sentinel.agent.providers.mock import MockLLMProvider
from mcp_sentinel.security.exceptions import ConfigurationError


def test_provider_subclass_contract():
    class IncompleteProvider(LLMProvider):
        pass

    with pytest.raises(TypeError):
        IncompleteProvider()  # type: ignore[abstract]


def test_gemini_provider_missing_key_raises():
    provider = GeminiProvider(api_key=None)
    provider._api_key = None  # Ensure no key
    with pytest.raises(ConfigurationError) as exc_info:
        provider._get_client()
    assert "Gemini API key is not configured" in str(exc_info.value.safe_message)


def test_gemini_provider_tool_conversion():
    provider = GeminiProvider(api_key="fake-key-for-unit-test")
    raw_tools = [
        {
            "name": "get_customer",
            "description": "Lookup a customer by ID",
            "input_schema": {
                "type": "object",
                "properties": {"customer_id": {"type": "string"}},
                "required": ["customer_id"],
            },
        },
        {
            "name": "query_customer_records",
            "description": "Query customers with filters",
            "input_schema": {
                "type": "object",
                "properties": {"limit": {"type": "integer", "default": 10}},
            },
        },
    ]

    gemini_tools = provider._convert_tools(raw_tools)
    assert gemini_tools is not None
    assert len(gemini_tools) == 1
    tool_obj = gemini_tools[0]
    assert len(tool_obj.function_declarations) == 2
    assert tool_obj.function_declarations[0].name == "get_customer"
    assert tool_obj.function_declarations[1].name == "query_customer_records"


def test_gemini_provider_message_conversion():
    provider = GeminiProvider(api_key="fake-key-for-unit-test")
    messages = [
        AgentMessage(role="user", content="Find customer 1"),
        AgentMessage(
            role="assistant",
            content=None,
            tool_calls=[ToolCall(id="call_1", name="get_customer", args={"customer_id": "1"})],
        ),
        AgentMessage(
            role="tool",
            content='{"status": "success", "customer": {"id": 1}}',
            name="get_customer",
            tool_call_id="call_1",
        ),
    ]

    contents = provider._convert_messages(messages)
    assert len(contents) == 3
    assert contents[0].role == "user"
    assert contents[0].parts[0].text == "Find customer 1"

    assert contents[1].role == "model"
    assert contents[1].parts[0].function_call.name == "get_customer"
    assert contents[1].parts[0].function_call.args == {"customer_id": "1"}

    assert contents[2].role == "user"
    assert contents[2].parts[0].function_response.name == "get_customer"


@pytest.mark.asyncio
async def test_mock_provider_scripted_responses():
    provider = MockLLMProvider()
    resp1 = LLMResponse(
        content=None, tool_calls=[ToolCall(id="c1", name="get_customer", args={"customer_id": "1"})]
    )
    resp2 = LLMResponse(content="Customer 1 is active.")
    provider.queue_response(resp1)
    provider.queue_response(resp2)

    r1 = await provider.generate_response([AgentMessage(role="user", content="Find 1")], tools=[])
    assert r1.has_tool_calls
    assert r1.tool_calls[0].name == "get_customer"

    r2 = await provider.generate_response([AgentMessage(role="user", content="Find 1")], tools=[])
    assert not r2.has_tool_calls
    assert r2.content == "Customer 1 is active."


@pytest.mark.asyncio
async def test_mock_provider_rule_based():
    provider = MockLLMProvider()

    # Read prompt
    r = await provider.generate_response(
        [AgentMessage(role="user", content="Find customer CUST-000001")], tools=[]
    )
    assert r.has_tool_calls
    assert r.tool_calls[0].name == "get_customer"
    assert r.tool_calls[0].args["customer_id"] == "CUST-000001"

    # Destructive prompt
    r_del = await provider.generate_response(
        [AgentMessage(role="user", content="Delete customer CUST-000001")], tools=[]
    )
    assert r_del.has_tool_calls
    assert r_del.tool_calls[0].name == "delete_customer"

    # Orders prompt
    r_ord = await provider.generate_response(
        [AgentMessage(role="user", content="Show the recent orders for CUST-000001")], tools=[]
    )
    assert r_ord.has_tool_calls
    assert r_ord.tool_calls[0].name == "get_customer_orders"
