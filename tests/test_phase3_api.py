"""
Phase 3 Tests: Agent HTTP API Endpoints.
Verifies:
1. GET /health returns 200.
2. POST /api/agent/chat executes agent flow and returns structured response.
3. Input validation rejects missing or invalid messages with 400.
4. Fail-closed error handling masks internal details with 500.
"""

import pytest
from starlette.testclient import TestClient

from mcp_sentinel.agent.api import create_agent_app
from mcp_sentinel.agent.mcp_client import SentinelMCPClient
from mcp_sentinel.agent.providers.mock import MockLLMProvider
from mcp_sentinel.agent.service import AgentService
from mcp_sentinel.server.app import create_app


@pytest.fixture
def api_client(db_pool):
    provider = MockLLMProvider()
    server = create_app()
    mcp_client = SentinelMCPClient(server_instance=server)
    service = AgentService(provider=provider, mcp_client=mcp_client)
    app = create_agent_app(agent_service=service)
    return TestClient(app)


def test_api_health(api_client):
    res = api_client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert data["service"] == "mcp-sentinel-agent"


def test_api_chat_success(api_client):
    res = api_client.post(
        "/api/agent/chat",
        json={"message": "Find customer CUST-000001"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "request_id" in data
    assert "response" in data
    assert "tool_calls" in data
    assert data["status"] == "completed"


def test_api_chat_missing_message(api_client):
    res = api_client.post(
        "/api/agent/chat",
        json={},
    )
    assert res.status_code == 400
    data = res.json()
    assert data["status"] == "error"
    assert data["error_type"] == "ValidationError"


def test_api_chat_empty_string_message(api_client):
    res = api_client.post(
        "/api/agent/chat",
        json={"message": "   "},
    )
    assert res.status_code == 400
    data = res.json()
    assert data["status"] == "error"
    assert data["error_type"] == "ValidationError"


def test_api_chat_non_json(api_client):
    res = api_client.post(
        "/api/agent/chat",
        content="not a json string",
        headers={"Content-Type": "application/json"},
    )
    assert res.status_code == 400
    data = res.json()
    assert data["status"] == "error"


def test_api_chat_internal_error_fails_closed():
    # Build a service that simulates an internal error
    provider = MockLLMProvider(
        simulate_error=RuntimeError("Internal database connection failed with secret password=123")
    )
    server = create_app()
    mcp_client = SentinelMCPClient(server_instance=server)
    service = AgentService(provider=provider, mcp_client=mcp_client)
    app = create_agent_app(agent_service=service)
    client = TestClient(app)

    res = client.post("/api/agent/chat", json={"message": "Hello"})
    assert res.status_code == 500
    data = res.json()
    assert data["status"] == "error"
    assert data["error_type"] == "ServerError"
    # Never leak internal details or passwords in response
    assert "password=123" not in res.text
    assert "RuntimeError" not in res.text
    assert "Traceback" not in res.text
