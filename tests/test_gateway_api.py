"""
API Integration Tests for Multi-Software MCP Gateway.
Validates HTTP endpoints:
- GET  /api/integrations
- GET  /api/integrations/{id}
- POST /api/integrations/{id}/test
- GET  /api/integrations/canva/oauth-url
- GET  /api/tools
- POST /api/tools/sync
- POST /api/tools/{tool_id}/execute
- GET  /api/mcp-servers
- POST /api/mcp-servers
"""

import pytest
from fastapi.testclient import TestClient
from mcp_sentinel.api.app import app

client = TestClient(app)

AUTH_HEADERS = {
    "X-Test-User-Role": "ADMIN",
    "X-Test-User-Email": "admin@sentinel.internal",
}


def test_get_integrations():
    resp = client.get("/api/integrations")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    int_ids = [item["id"] for item in data]
    assert "canva" in int_ids
    assert "github" in int_ids
    assert "slack" in int_ids
    assert "google_drive" in int_ids
    assert "custom_mcp" in int_ids


def test_get_canva_detail():
    resp = client.get("/api/integrations/canva")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == "canva"
    assert data["name"] == "Canva"
    assert data["connection_endpoint"] == "https://mcp.canva.com/mcp"
    assert "is_authenticated" in data


def test_canva_pkce_oauth_url():
    resp = client.get(
        "/api/integrations/canva/oauth-url",
        params={
            "client_id": "test_client_id_123",
            "redirect_uri": "http://localhost:3000/callback",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "authorization_url" in data
    assert "code_verifier" in data
    assert "state" in data
    assert "canva.com/api/oauth/authorize" in data["authorization_url"]


def test_test_canva_connection():
    resp = client.post("/api/integrations/canva/test")
    assert resp.status_code == 200
    data = resp.json()
    assert "success" in data
    assert "latency_ms" in data
    assert "protocol_version" in data


def test_get_tools_list():
    resp = client.get("/api/tools")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 20
    tool_ids = [t["tool_id"] for t in data]
    assert "canva.search_designs" in tool_ids
    assert "github.create_issue" in tool_ids
    assert "slack.send_message" in tool_ids


def test_tool_sync():
    resp = client.post("/api/tools/sync")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["count"] >= 20


def test_execute_low_risk_tool():
    resp = client.post(
        "/api/tools/custom_mcp.query_customer_records/execute",
        json={"parameters": {"limit": 2}},
        headers=AUTH_HEADERS,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["status"] == "EXECUTED"
    assert data["risk_level"] == "LOW"


def test_execute_high_risk_tool_gates_for_approval():
    resp = client.post(
        "/api/tools/canva.update_design/execute",
        json={"parameters": {"design_id": "des_test_api", "title": "New Pitch Deck"}},
        headers=AUTH_HEADERS,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is False
    assert data["status"] == "PENDING_APPROVAL"
    assert data["approval_ticket_id"] is not None
    assert "TICKET-EXECUTE_CANVA.UPDATE_DESIGN" in data["approval_ticket_id"]


def test_mcp_servers_list():
    resp = client.get("/api/mcp-servers")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 2
    server_ids = [s["id"] for s in data]
    assert "srv_canva_remote" in server_ids
    assert "srv_local_fastmcp" in server_ids


def test_register_custom_mcp_server():
    resp = client.post(
        "/api/mcp-servers",
        json={
            "id": "srv_test_custom_mcp",
            "name": "Test Custom MCP Server",
            "transport": "stream-http",
            "endpoint": "https://mcp.internal.corp/mcp",
            "auth_method": "Bearer Token",
            "environment": "staging",
        },
        headers=AUTH_HEADERS,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["server"]["id"] == "srv_test_custom_mcp"
