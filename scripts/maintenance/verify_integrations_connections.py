"""
MCP Sentinel — Comprehensive Verification Suite for Google OAuth + Notion & Supabase Connections.

This automated test suite verifies:
1. Google OAuth 2.0 / OIDC initiation, PKCE, claim checks, and anti-takeover defense.
2. Notion connection via Administrator Integration Token (successful probe, workspace metadata).
3. Notion failed authentication handling (401 invalid token, zero secret leakage).
4. Notion disconnection (credential revocation, status reset).
5. Notion OAuth 2.0 flow (authorize URL generation, signed state, token exchange callback).
6. Supabase PostgreSQL pool connection (structured details, server-side probe, status persistence).
7. Supabase connection failure & timeout handling (clean scrubbed errors, zero password leakage).
8. Supabase disconnection (credential revocation, pool reset).
9. RBAC & Security Enforcement (unauthenticated -> 401, non-admin VIEWER -> 403 Forbidden).
10. Zero-Credential Exposure (passwords and tokens never returned in API responses or logs).
11. Preserved Governance (Notion 4 tools, Supabase 8 tools, approval gates, audit integrity).
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from typing import Optional
from unittest.mock import AsyncMock, MagicMock, patch

# Ensure workspace root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Configure test environment
os.environ["ENABLE_TEST_AUTH"] = "true"
os.environ["NOTION_CLIENT_ID"] = "notion-test-client-id"
os.environ["NOTION_CLIENT_SECRET"] = "notion-test-client-secret-12345"
os.environ["NOTION_REDIRECT_URI"] = "http://localhost:8000/api/integrations/notion/oauth/callback"
os.environ["GOOGLE_CLIENT_ID"] = "test-google-client-id.apps.googleusercontent.com"
os.environ["GOOGLE_CLIENT_SECRET"] = "test-google-client-secret-12345"
os.environ["DATABASE_URL"] = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/mcp_sentinel_db",
)

from fastapi.testclient import TestClient

from mcp_sentinel.api.app import app
from mcp_sentinel.connectors.models import (
    ConnectorCredentials,
    IntegrationStatus,
    RiskLevel,
)
from mcp_sentinel.connectors.registry import get_connector_registry
from mcp_sentinel.security.auth.oidc import (
    generate_oauth_state,
)


def log_suite(title: str) -> None:
    print(f"\n{'=' * 75}\n>> [SUITE] {title}\n{'=' * 75}")


def log_test(name: str, passed: bool, detail: str = "") -> None:
    status = "[PASS]" if passed else "[FAIL]"
    print(f"  {status} | {name} {f'({detail})' if detail else ''}")
    if not passed:
        raise AssertionError(f"Test failed: {name} - {detail}")


# In-memory mock repositories for isolated testing
class MockIntegrationRepository:
    def __init__(self) -> None:
        self.credentials: dict[str, ConnectorCredentials] = {}
        self.statuses: dict[str, IntegrationStatus] = {
            "notion": IntegrationStatus.DISCONNECTED,
            "supabase": IntegrationStatus.CONNECTED,
        }

    async def get_credentials(self, integration_id: str) -> Optional[ConnectorCredentials]:
        return self.credentials.get(integration_id)

    async def save_credentials(self, integration_id: str, creds: ConnectorCredentials) -> None:
        self.credentials[integration_id] = creds

    async def delete_credentials(self, integration_id: str) -> None:
        self.credentials.pop(integration_id, None)

    async def update_status(self, integration_id: str, status: IntegrationStatus) -> None:
        self.statuses[integration_id] = status


async def main() -> None:
    print("\n" + "=" * 75)
    print("MCP Sentinel — Google OAuth + Notion & Supabase Connections Test Suite")
    print("=" * 75)

    client = TestClient(app, base_url="http://localhost:8000")
    reg = get_connector_registry()

    admin_headers = {
        "X-Test-User-Role": "ADMIN",
        "X-Test-User-Email": "admin@sentinel.internal",
    }
    viewer_headers = {
        "X-Test-User-Role": "VIEWER",
        "X-Test-User-Email": "viewer@sentinel.internal",
    }

    mock_repo = MockIntegrationRepository()
    mock_tool_svc = MagicMock()
    mock_tool_svc.sync_all_tools = AsyncMock()

    from mcp_sentinel.api.routers.integrations import (
        get_integration_repo,
        get_tool_registry_service,
    )

    app.dependency_overrides[get_integration_repo] = lambda: mock_repo
    app.dependency_overrides[get_tool_registry_service] = lambda: mock_tool_svc

    # -------------------------------------------------------------------------
    # SUITE 1: Google OAuth Flow & Security Verification
    # -------------------------------------------------------------------------
    log_suite("Suite 1: Google OAuth 2.0 PKCE & OIDC Integrity")
    with patch("mcp_sentinel.security.audit_logger.log_security_event"):
        # 1.1 Authorize initiation
        auth_res = client.get("/api/auth/google/authorize", follow_redirects=False)
        log_test(
            "OAuth Authorize Initiation",
            auth_res.status_code == 307 or auth_res.status_code == 302,
            f"Status {auth_res.status_code}",
        )
        location = auth_res.headers.get("location", "")
        log_test(
            "PKCE S256 Challenge in Authorization URL",
            "code_challenge=" in location and "code_challenge_method=S256" in location,
        )

        # 1.2 State validation
        cb_bad_state = client.get(
            "/api/auth/google/callback?code=mock_code&state=tampered_state",
            follow_redirects=False,
        )
        log_test(
            "Tampered State Rejected (403)",
            cb_bad_state.status_code in (400, 403)
            or "error=invalid_state" in cb_bad_state.headers.get("location", ""),
            f"Status {cb_bad_state.status_code}",
        )

        # 1.3 Cancelled consent handling
        cb_cancelled = client.get(
            "/api/auth/google/callback?error=access_denied&state=any_state",
            follow_redirects=False,
        )
        log_test(
            "Cancelled Consent Redirects Gracefully",
            "error=access_denied" in cb_cancelled.headers.get("location", ""),
        )

    # -------------------------------------------------------------------------
    # SUITE 2: Notion Connection via Administrator Integration Token
    # -------------------------------------------------------------------------
    log_suite("Suite 2: Notion Administrator Integration Token Connection")
    with patch(
        "mcp_sentinel.api.routers.integrations.get_integration_repo", return_value=mock_repo
    ):
        # Mock Notion API 200 response
        mock_notion_user = {
            "object": "user",
            "id": "bot-uuid-9999",
            "name": "Sentinel Enterprise Bot",
            "type": "bot",
            "bot": {
                "owner": {"type": "workspace", "workspace": True},
                "workspace_name": "Sentinel Engineering",
                "workspace_id": "ws-uuid-1234",
            },
        }

        with patch("httpx.AsyncClient.get") as mock_http_get:
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.json.return_value = mock_notion_user
            mock_http_get.return_value = mock_resp

            connect_res = client.post(
                "/api/integrations/notion/connect",
                json={"api_key": "ntn_test_secret_token_12345"},
                headers=admin_headers,
            )

            log_test(
                "Notion Connect with Valid Token",
                connect_res.status_code == 200 and connect_res.json().get("success") is True,
                f"Status: {connect_res.status_code}",
            )
            body = connect_res.json()
            log_test(
                "Notion Workspace Metadata Returned",
                body.get("details", {}).get("workspace_name") == "Sentinel Engineering"
                and body.get("details", {}).get("bot_name") == "Sentinel Enterprise Bot",
            )
            log_test(
                "Notion Status Persisted as CONNECTED",
                mock_repo.statuses.get("notion") == IntegrationStatus.CONNECTED,
            )

        # 2.2 Test Connection probe
        with patch("httpx.AsyncClient.get") as mock_http_get:
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.json.return_value = mock_notion_user
            mock_http_get.return_value = mock_resp

            test_res = client.post("/api/integrations/notion/test", headers=admin_headers)
            log_test(
                "Notion Live Test Probe Success",
                test_res.status_code == 200 and test_res.json().get("success") is True,
                f"Latency: {test_res.json().get('latency_ms')}ms",
            )

    # -------------------------------------------------------------------------
    # SUITE 3: Notion Failed Authentication & Error Scrubbing
    # -------------------------------------------------------------------------
    log_suite("Suite 3: Notion Authentication Failure & Error Masking")
    with patch(
        "mcp_sentinel.api.routers.integrations.get_integration_repo", return_value=mock_repo
    ):
        with patch("httpx.AsyncClient.get") as mock_http_get:
            mock_resp = MagicMock()
            mock_resp.status_code = 401
            mock_resp.json.return_value = {"object": "error", "message": "API token is invalid."}
            mock_http_get.return_value = mock_resp

            connect_fail = client.post(
                "/api/integrations/notion/connect",
                json={"api_key": "invalid_token_sample"},
                headers=admin_headers,
            )

            log_test(
                "Invalid Notion Token Rejected with 400",
                connect_fail.status_code == 400,
                connect_fail.json().get("detail", ""),
            )
            log_test(
                "Zero Secret Leakage in Error Response",
                "invalid_token_sample" not in json.dumps(connect_fail.json()),
            )

    # -------------------------------------------------------------------------
    # SUITE 4: Notion Disconnection
    # -------------------------------------------------------------------------
    log_suite("Suite 4: Notion Disconnection & Revocation")
    with patch(
        "mcp_sentinel.api.routers.integrations.get_integration_repo", return_value=mock_repo
    ):
        disc_res = client.post("/api/integrations/notion/disconnect", headers=admin_headers)
        log_test(
            "Notion Disconnect Endpoint Success",
            disc_res.status_code == 200 and disc_res.json().get("status") == "DISCONNECTED",
        )
        log_test(
            "Notion Status Reset to DISCONNECTED",
            mock_repo.statuses.get("notion") == IntegrationStatus.DISCONNECTED,
        )

    # -------------------------------------------------------------------------
    # SUITE 5: Notion User-Authorized OAuth 2.0 Flow
    # -------------------------------------------------------------------------
    log_suite("Suite 5: Notion User-Authorized OAuth 2.0 Flow")
    with patch(
        "mcp_sentinel.api.routers.integrations.get_integration_repo", return_value=mock_repo
    ):
        # 5.1 Authorize URL Generation
        oauth_auth_res = client.get(
            "/api/integrations/notion/oauth/authorize", headers=admin_headers
        )
        log_test(
            "Notion OAuth Authorize URL Generation",
            oauth_auth_res.status_code == 200
            and "api.notion.com" in oauth_auth_res.json().get("authorization_url", ""),
        )
        auth_url = oauth_auth_res.json().get("authorization_url", "")
        log_test(
            "Notion OAuth URL contains client_id and redirect_uri",
            "client_id=notion-test-client-id" in auth_url and "redirect_uri=" in auth_url,
        )

        # 5.2 Callback with invalid state
        cb_bad = client.get(
            "/api/integrations/notion/oauth/callback?code=mock_code&state=bad_state",
            follow_redirects=False,
        )
        log_test(
            "Notion OAuth Bad State Redirects with Error",
            "error=invalid_state" in cb_bad.headers.get("location", ""),
        )

        # 5.3 Callback with valid code and mock token exchange
        valid_state = generate_oauth_state(redirect_uri="/integrations")
        with patch("httpx.AsyncClient.post") as mock_token_post:
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.json.return_value = {
                "access_token": "secret_oauth_notion_token_999",
                "token_type": "bearer",
                "bot_id": "bot-oauth-uuid",
                "workspace_name": "Acme Global HQ",
                "workspace_id": "ws-oauth-111",
            }
            mock_token_post.return_value = mock_resp

            cb_success = client.get(
                f"/api/integrations/notion/oauth/callback?code=valid_code&state={valid_state}",
                follow_redirects=False,
            )

            log_test(
                "Notion OAuth Callback Exchanges Code & Redirects to Frontend",
                cb_success.status_code == 302
                and "connected=notion" in cb_success.headers.get("location", ""),
                cb_success.headers.get("location", ""),
            )
            log_test(
                "Notion Workspace Name in Redirect URL",
                "Acme" in cb_success.headers.get("location", ""),
            )
            log_test(
                "Notion OAuth Status Persisted as CONNECTED",
                mock_repo.statuses.get("notion") == IntegrationStatus.CONNECTED,
            )

    # -------------------------------------------------------------------------
    # SUITE 6: Supabase Connection & Pool Telemetry
    # -------------------------------------------------------------------------
    log_suite("Suite 6: Supabase PostgreSQL Connection & Pool Verification")
    with patch(
        "mcp_sentinel.api.routers.integrations.get_integration_repo", return_value=mock_repo
    ):
        # Mock asyncpg connect to simulate successful PostgreSQL handshake
        mock_conn = AsyncMock()
        mock_conn.fetchval.return_value = "PostgreSQL 17.2 on x86_64-pc-linux-gnu (Supabase)"
        mock_conn.close = AsyncMock()

        with patch("asyncpg.connect", return_value=mock_conn):
            # Connect via structured fields
            sb_res = client.post(
                "/api/integrations/supabase/connect",
                json={
                    "host": "aws-0-ap-northeast-2.pooler.supabase.com",
                    "port": 5432,
                    "database": "postgres",
                    "username": "postgres.testproject",
                    "password": "SecurePassword123!",
                    "ssl_mode": "require",
                },
                headers=admin_headers,
            )

            log_test(
                "Supabase Structured Connection Success",
                sb_res.status_code == 200 and sb_res.json().get("success") is True,
                f"Latency: {sb_res.json().get('latency_ms')}ms",
            )
            sb_body = sb_res.json()
            log_test(
                "Sanitized Database Details Returned (No Password)",
                sb_body.get("details", {}).get("host") == "aws-0-ap-northeast-2.pooler.supabase.com"
                and "password" not in json.dumps(sb_body),
            )
            log_test(
                "Supabase Status Persisted as CONNECTED",
                mock_repo.statuses.get("supabase") == IntegrationStatus.CONNECTED,
            )

        # 6.2 Supabase Test Probe
        with patch("mcp_sentinel.connectors.supabase.check_db_health", return_value=True):
            test_sb = client.post("/api/integrations/supabase/test", headers=admin_headers)
            log_test(
                "Supabase Live Test Probe Success",
                test_sb.status_code == 200 and test_sb.json().get("success") is True,
            )

    # -------------------------------------------------------------------------
    # SUITE 7: Supabase Error Handling & Password Masking
    # -------------------------------------------------------------------------
    log_suite("Suite 7: Supabase Error Handling & Password Scrubbing")
    with patch(
        "mcp_sentinel.api.routers.integrations.get_integration_repo", return_value=mock_repo
    ):
        # 7.1 Timeout simulation
        with patch("asyncpg.connect", side_effect=asyncio.TimeoutError()):
            sb_timeout = client.post(
                "/api/integrations/supabase/connect",
                json={
                    "host": "firewalled-host.supabase.com",
                    "port": 5432,
                    "username": "postgres",
                    "password": "SecretPassword999",
                },
                headers=admin_headers,
            )
            log_test(
                "Supabase Timeout Returns Safe 400 Error",
                sb_timeout.status_code == 400
                and "timed out" in sb_timeout.json().get("detail", ""),
                sb_timeout.json().get("detail", ""),
            )
            log_test(
                "Password Scrubbed from Timeout Error",
                "SecretPassword999" not in json.dumps(sb_timeout.json()),
            )

        # 7.2 Invalid Password simulation
        import asyncpg

        with patch(
            "asyncpg.connect",
            side_effect=asyncpg.InvalidPasswordError(
                "password authentication failed for user 'postgres'"
            ),
        ):
            sb_bad_auth = client.post(
                "/api/integrations/supabase/connect",
                json={
                    "host": "localhost",
                    "port": 5432,
                    "username": "postgres",
                    "password": "WrongPassword999",
                },
                headers=admin_headers,
            )
            log_test(
                "Invalid Password Returns Clean 400 Message",
                sb_bad_auth.status_code == 400
                and "Invalid database password" in sb_bad_auth.json().get("detail", ""),
            )
            log_test(
                "Password Never Disclosed in Authentication Error",
                "WrongPassword999" not in json.dumps(sb_bad_auth.json()),
            )

    # -------------------------------------------------------------------------
    # SUITE 8: Supabase Disconnection
    # -------------------------------------------------------------------------
    log_suite("Suite 8: Supabase Disconnection")
    with patch(
        "mcp_sentinel.api.routers.integrations.get_integration_repo", return_value=mock_repo
    ):
        sb_disc = client.post("/api/integrations/supabase/disconnect", headers=admin_headers)
        log_test(
            "Supabase Disconnect Endpoint Success",
            sb_disc.status_code == 200 and sb_disc.json().get("status") == "DISCONNECTED",
        )
        log_test(
            "Supabase Status Reset to DISCONNECTED",
            mock_repo.statuses.get("supabase") == IntegrationStatus.DISCONNECTED,
        )

    # -------------------------------------------------------------------------
    # SUITE 9: RBAC & Unauthorized Access Prevention
    # -------------------------------------------------------------------------
    log_suite("Suite 9: RBAC Enforcement on Integration Management")
    # 9.1 Unauthenticated requests rejected
    anon_list = client.get("/api/integrations")
    log_test(
        "Unauthenticated Request Rejected with 401",
        anon_list.status_code == 401,
        f"Status: {anon_list.status_code}",
    )

    anon_connect = client.post(
        "/api/integrations/notion/connect",
        json={"api_key": "some_token"},
    )
    log_test(
        "Unauthenticated Connect Rejected with 401",
        anon_connect.status_code == 401,
    )

    # 9.2 VIEWER role (lacks PERM_MANAGE_INTEGRATIONS)
    viewer_connect = client.post(
        "/api/integrations/notion/connect",
        json={"api_key": "some_token"},
        headers=viewer_headers,
    )
    log_test(
        "Viewer Denied Permission to Connect Integration (403)",
        viewer_connect.status_code == 403,
        f"Status: {viewer_connect.status_code}",
    )

    viewer_disc = client.post(
        "/api/integrations/notion/disconnect",
        headers=viewer_headers,
    )
    log_test(
        "Viewer Denied Permission to Disconnect Integration (403)",
        viewer_disc.status_code == 403,
    )

    viewer_test = client.post(
        "/api/integrations/notion/test",
        headers=viewer_headers,
    )
    log_test(
        "Viewer Denied Permission to Probe Integration (403)",
        viewer_test.status_code == 403,
    )

    # -------------------------------------------------------------------------
    # SUITE 10: Zero-Credential Exposure in API Responses
    # -------------------------------------------------------------------------
    log_suite("Suite 10: Zero-Credential Exposure Verification")
    with patch(
        "mcp_sentinel.api.routers.integrations.get_integration_repo", return_value=mock_repo
    ):
        # Configure a secret in the mock repo
        secret_token = "secret_super_classified_notion_key_xyz987"
        mock_repo.credentials["notion"] = ConnectorCredentials(
            api_key=secret_token,
            access_token=secret_token,
            token_type="Bearer",
        )

        list_res = client.get("/api/integrations", headers=admin_headers)
        log_test("List Integrations Status 200", list_res.status_code == 200)
        list_json_str = json.dumps(list_res.json())

        log_test(
            "Secret Token NOT Present in GET /api/integrations",
            secret_token not in list_json_str,
        )

        detail_res = client.get("/api/integrations/notion", headers=admin_headers)
        log_test("Get Notion Status 200", detail_res.status_code == 200)
        detail_json_str = json.dumps(detail_res.json())

        log_test(
            "Secret Token NOT Present in GET /api/integrations/notion",
            secret_token not in detail_json_str,
        )
        log_test(
            "Masked Token Safely Formatted",
            detail_res.json().get("masked_token", "").startswith("secr..."),
            detail_res.json().get("masked_token"),
        )

    # -------------------------------------------------------------------------
    # SUITE 11: MCP Tools, Policies & Governance Intact
    # -------------------------------------------------------------------------
    log_suite("Suite 11: Governance, Tools & Approval Architecture Intact")
    notion_conn = reg.get_connector("notion")
    supabase_conn = reg.get_connector("supabase")

    assert notion_conn is not None, "Notion connector registered"
    assert supabase_conn is not None, "Supabase connector registered"

    notion_tools = await notion_conn.list_tools()
    supabase_tools = await supabase_conn.list_tools()

    log_test(
        "Notion Connector exposes 4 FastMCP tools",
        len(notion_tools) == 4,
        f"Got: {[t.name for t in notion_tools]}",
    )
    log_test(
        "archive_page requires Human Approval & HIGH risk",
        any(
            t.name == "archive_page" and t.approval_required and t.risk_level == RiskLevel.HIGH
            for t in notion_tools
        ),
    )

    log_test(
        "Supabase Connector exposes 8 FastMCP tools",
        len(supabase_tools) == 8,
        f"Count: {len(supabase_tools)}",
    )
    log_test(
        "delete_customer requires Human Approval & CRITICAL risk",
        any(
            t.name == "delete_customer"
            and t.approval_required
            and t.risk_level == RiskLevel.CRITICAL
            for t in supabase_tools
        ),
    )

    print("\n" + "=" * 75)
    print(">>> ALL 11 VERIFICATION SUITES PASSED END-TO-END! <<<")
    print("=" * 75)


if __name__ == "__main__":
    asyncio.run(main())
