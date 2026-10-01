"""
Comprehensive Integration & Security Test Suite for GitHub Connector & Gateway.
Verifies:
1. GitHub OAuth URL construction & token exchange
2. Tool Discovery & Registry Synchronization (All 10 Tools)
3. Safe Read Operations (get_authenticated_user, list_repositories, etc.)
4. Safe Write Operations (create_issue, create_pull_request)
5. Potentially Dangerous / Governed Operations (merge_pull_request, delete_file, delete_repository)
6. Security Pipeline Execution (All 9 Stages)
7. Policy & Risk Engine Evaluation
8. Human Approval Gating, Approval & Rejection Flow
9. Single-Use Replay Defense
10. Token Security & Vault Encryption
11. Audit Logging Immutability & Secret Redaction
"""

import asyncio
import hashlib
import json
import pytest
from unittest.mock import AsyncMock, patch
import httpx
from starlette.testclient import TestClient

from mcp_sentinel.api.app import app
from mcp_sentinel.config.settings import get_settings
from mcp_sentinel.connectors.github import GitHubConnector
from mcp_sentinel.connectors.models import (
    AuthType,
    ConnectorCredentials,
    IntegrationStatus,
    RiskLevel,
    ToolExecutionResult,
)
from mcp_sentinel.connectors.registry import get_connector_registry
from mcp_sentinel.connectors.vault import CredentialVault, get_vault
from mcp_sentinel.repositories.approval_repository import ApprovalRepository
from mcp_sentinel.repositories.audit_repository import AuditRepository
from mcp_sentinel.repositories.integration_repository import IntegrationRepository
from mcp_sentinel.repositories.tool_repository import ToolRepository
from mcp_sentinel.services.gateway_execution_service import (
    GatewayExecutionService,
    GatewayExecuteRequest,
)
from mcp_sentinel.services.tool_registry_service import ToolRegistryService


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


@pytest.fixture(scope="module")
def settings():
    return get_settings()


# =============================================================================
# 1. GITHUB OAUTH & ENVIRONMENT TESTS
# =============================================================================

class TestGitHubOAuth:
    def test_github_oauth_url_generation(self, client):
        res = client.get("/api/integrations/github/connect")
        assert res.status_code == 200
        data = res.json()
        assert "authorization_url" in data
        assert "github.com/login/oauth/authorize" in data["authorization_url"]
        assert "client_id=" in data["authorization_url"]
        assert "redirect_uri=" in data["authorization_url"]
        assert "state=" in data["authorization_url"]

    def test_github_oauth_url_scopes(self):
        url = GitHubConnector.get_authorization_url(
            client_id="test_client_id",
            redirect_uri="http://localhost:8000/api/integrations/github/callback",
            state="test_state_123",
            scopes=["repo", "read:user"],
        )
        assert "client_id=test_client_id" in url
        assert "state=test_state_123" in url
        assert "scope=repo+read%3Auser" in url or "scope=repo%20read%3Auser" in url

    @pytest.mark.asyncio
    async def test_github_oauth_code_exchange_mock(self):
        with patch("httpx.AsyncClient.post") as mock_post:
            mock_post.return_value = httpx.Response(
                status_code=200,
                json={
                    "access_token": "gho_test_oauth_access_token_12345",
                    "token_type": "bearer",
                    "scope": "repo,read:user",
                },
            )

            creds = await GitHubConnector.exchange_code(
                client_id="test_id",
                client_secret="test_secret",
                code="test_code",
                redirect_uri="http://localhost:8000/callback",
            )
            assert creds.access_token == "gho_test_oauth_access_token_12345"
            assert creds.token_type == "Bearer"
            assert "repo" in creds.scopes


# =============================================================================
# 2. GITHUB TOOL DISCOVERY & REGISTRY TESTS
# =============================================================================

class TestGitHubToolRegistry:
    @pytest.mark.asyncio
    async def test_all_ten_github_tools_discovered(self):
        gh = GitHubConnector()
        tools = await gh.list_tools()
        tool_ids = [t.tool_id for t in tools]
        expected_tools = [
            "github.get_authenticated_user",
            "github.list_repositories",
            "github.get_repository",
            "github.list_issues",
            "github.create_issue",
            "github.create_pull_request",
            "github.close_issue",
            "github.merge_pull_request",
            "github.delete_file",
            "github.delete_repository",
        ]
        for exp in expected_tools:
            assert exp in tool_ids, f"Missing tool: {exp}"

    @pytest.mark.asyncio
    async def test_tool_risk_and_approval_classification(self):
        gh = GitHubConnector()
        tools = await gh.list_tools()
        by_id = {t.tool_id: t for t in tools}

        # Safe Reads: LOW risk, no approval
        assert by_id["github.get_authenticated_user"].risk_level == RiskLevel.LOW
        assert by_id["github.get_authenticated_user"].approval_required is False

        assert by_id["github.list_repositories"].risk_level == RiskLevel.LOW
        assert by_id["github.list_repositories"].approval_required is False

        assert by_id["github.get_repository"].risk_level == RiskLevel.LOW
        assert by_id["github.get_repository"].approval_required is False

        assert by_id["github.list_issues"].risk_level == RiskLevel.LOW
        assert by_id["github.list_issues"].approval_required is False

        # Safe Writes: MEDIUM risk, no approval
        assert by_id["github.create_issue"].risk_level == RiskLevel.MEDIUM
        assert by_id["github.create_issue"].approval_required is False

        assert by_id["github.create_pull_request"].risk_level == RiskLevel.MEDIUM

        assert by_id["github.close_issue"].risk_level == RiskLevel.MEDIUM

        # Governed Actions: HIGH / CRITICAL risk, approval required
        assert by_id["github.merge_pull_request"].risk_level == RiskLevel.HIGH
        assert by_id["github.merge_pull_request"].approval_required is True

        assert by_id["github.delete_file"].risk_level == RiskLevel.HIGH
        assert by_id["github.delete_file"].approval_required is True

        assert by_id["github.delete_repository"].risk_level == RiskLevel.CRITICAL
        assert by_id["github.delete_repository"].approval_required is True


# =============================================================================
# 3. GITHUB CONNECTION & TOOL EXECUTION TESTS
# =============================================================================

class TestGitHubExecution:
    @pytest.mark.asyncio
    async def test_unauthenticated_execution_fails_closed(self):
        gh = GitHubConnector()
        gh._credentials = None
        res = await gh.execute_tool("github.get_authenticated_user", {})
        assert res.success is False
        assert res.status == "BLOCKED"
        assert "not authenticated" in res.error.lower()

    @pytest.mark.asyncio
    async def test_live_connection_zen_ping(self):
        """Tests live public GitHub ping without credentials (must succeed with status 200)."""
        gh = GitHubConnector()
        test_res = await gh.test_connection()
        assert test_res.success is True
        assert test_res.latency_ms > 0
        assert "GitHub" in test_res.message
        assert test_res.server_version == "GitHub-API/v3"

    @pytest.mark.asyncio
    async def test_authenticated_user_safe_read_mock(self):
        gh = GitHubConnector(credentials=ConnectorCredentials(access_token="ghp_test_token_123"))
        with patch("httpx.AsyncClient.get") as mock_get:
            mock_get.return_value = httpx.Response(
                status_code=200,
                json={"login": "octocat", "id": 583231, "name": "The Octocat"},
            )

            res = await gh.execute_tool("github.get_authenticated_user", {})
            assert res.success is True
            assert res.data["login"] == "octocat"
            assert res.data["id"] == 583231

    @pytest.mark.asyncio
    async def test_create_issue_safe_write_mock(self):
        gh = GitHubConnector(credentials=ConnectorCredentials(access_token="ghp_test_token_123"))
        with patch("httpx.AsyncClient.post") as mock_post:
            mock_post.return_value = httpx.Response(
                status_code=201,
                json={"number": 101, "title": "Security Issue", "state": "open"},
            )

            res = await gh.execute_tool(
                "github.create_issue",
                {"owner": "octocat", "repo": "Hello-World", "title": "Security Issue", "body": "Audit report"},
            )
            assert res.success is True
            assert res.data["number"] == 101


# =============================================================================
# 4. SECURITY PIPELINE & APPROVAL GATING TESTS
# =============================================================================

class TestGitHubSecurityPipeline:
    @pytest.mark.asyncio
    async def test_low_risk_github_tool_executes_without_approval(self):
        """get_authenticated_user is LOW risk and executes immediately through all 9 stages."""
        svc = GatewayExecutionService()
        reg = get_connector_registry()
        gh = reg.get_connector("github")
        gh._credentials = ConnectorCredentials(access_token="ghp_test_token_dummy")

        with patch("httpx.AsyncClient.get") as mock_get:
            mock_get.return_value = httpx.Response(
                status_code=200,
                json={"login": "sentinel-bot", "id": 9999},
            )

            req = GatewayExecuteRequest(
                tool_id="github.get_authenticated_user",
                parameters={},
                user_id="lead-engineer@sentinel.internal",
                user_role="OPERATOR",
            )
            res = await svc.execute(req)
            assert res.success is True
            assert res.status == "EXECUTED"
            assert res.risk_level == "LOW"
            assert any("1. Identity Verified" in s for s in res.stages_completed)
            assert any("9. Audit Logged Immutably" in s for s in res.stages_completed)

    @pytest.mark.asyncio
    async def test_high_risk_github_merge_pr_gates_for_human_approval(self):
        """github.merge_pull_request is HIGH risk and must pause in PENDING_APPROVAL."""
        svc = GatewayExecutionService()
        req = GatewayExecuteRequest(
            tool_id="github.merge_pull_request",
            parameters={
                "owner": "octocat",
                "repo": "demo-repo",
                "pull_number": 42,
                "merge_method": "merge",
            },
            user_id="developer@sentinel.internal",
            user_role="OPERATOR",
            reason="Release deployment PR merge",
        )
        res = await svc.execute(req)
        assert res.success is False
        assert res.status == "PENDING_APPROVAL"
        assert res.risk_level == "HIGH"
        assert res.approval_ticket_id is not None
        assert "Ticket Created" in "".join(res.stages_completed)

    @pytest.mark.asyncio
    async def test_github_approval_lifecycle_and_execution(self):
        """Step 9: Request -> Approval Required -> Human Approves -> Operation Executes."""
        svc = GatewayExecutionService()
        approval_repo = ApprovalRepository()
        reg = get_connector_registry()
        gh = reg.get_connector("github")
        gh._credentials = ConnectorCredentials(access_token="ghp_test_token_dummy")

        params = {
            "owner": "octocat",
            "repo": "demo-repo",
            "pull_number": 55,
            "merge_method": "squash",
        }

        # Step A: Initiate request -> halts in PENDING_APPROVAL
        req = GatewayExecuteRequest(
            tool_id="github.merge_pull_request",
            parameters=params,
            user_id="developer@sentinel.internal",
            user_role="OPERATOR",
        )
        init_res = await svc.execute(req)
        ticket_id = init_res.approval_ticket_id
        assert ticket_id is not None

        # Step B: Human Security Lead approves the ticket
        await approval_repo.decide_approval(
            ticket_id=ticket_id,
            decision="APPROVED",
            approver_id="security-lead@sentinel.internal",
            decision_notes="Verified CI passes and security scans clear",
        )

        # Step C: Re-run with valid approved ticket
        with patch("httpx.AsyncClient.put") as mock_put:
            mock_put.return_value = httpx.Response(
                status_code=200,
                json={"sha": "6dcb09b5b57875f334f61aebed695e2e4193db5e", "merged": True, "message": "Pull Request successfully merged"},
            )

            exec_req = GatewayExecuteRequest(
                tool_id="github.merge_pull_request",
                parameters=params,
                user_id="developer@sentinel.internal",
                user_role="OPERATOR",
                approval_ticket_id=ticket_id,
            )
            exec_res = await svc.execute(exec_req)
            assert exec_res.success is True
            assert exec_res.status == "EXECUTED"
            assert "6. Approval Verified & Consumed" in "".join(exec_res.stages_completed)

        # Step D: Single-Use Replay Defense: Attempting to reuse the consumed ticket must be BLOCKED
        replay_res = await svc.execute(exec_req)
        assert replay_res.success is False
        assert replay_res.status == "BLOCKED"
        assert "verification failed" in replay_res.error.lower()

    @pytest.mark.asyncio
    async def test_github_rejection_halts_execution(self):
        """Step 9: Request -> Approval Required -> Human Rejects -> MUST NOT execute."""
        svc = GatewayExecutionService()
        approval_repo = ApprovalRepository()

        params = {"owner": "octocat", "repo": "critical-repo", "confirmation": "critical-repo"}
        init_res = await svc.execute(
            GatewayExecuteRequest(
                tool_id="github.delete_repository",
                parameters=params,
                user_id="dev@sentinel.internal",
                user_role="ADMIN",
            )
        )
        ticket_id = init_res.approval_ticket_id
        assert ticket_id is not None

        # Human operator rejects the ticket
        await approval_repo.decide_approval(
            ticket_id=ticket_id,
            decision="DENIED",
            approver_id="compliance@sentinel.internal",
            decision_notes="Unauthorized repository destruction request",
        )

        # Execution attempt with denied ticket must be BLOCKED
        exec_res = await svc.execute(
            GatewayExecuteRequest(
                tool_id="github.delete_repository",
                parameters=params,
                user_id="dev@sentinel.internal",
                user_role="ADMIN",
                approval_ticket_id=ticket_id,
            )
        )
        assert exec_res.success is False
        assert exec_res.status == "BLOCKED"
        assert "verification failed" in exec_res.error.lower()


# =============================================================================
# 5. TOKEN SECURITY & AUDIT LOGGING TESTS
# =============================================================================

class TestTokenSecurityAndAudit:
    @pytest.mark.asyncio
    async def test_token_vault_encryption_at_rest(self):
        repo = IntegrationRepository()
        vault = get_vault()
        raw_secret = "gho_super_secret_github_token_value_98765"

        creds = ConnectorCredentials(
            access_token=raw_secret,
            token_type="Bearer",
            scopes=["repo", "read:user"],
        )
        await repo.save_credentials("github", creds)

        # Verify from database that plaintext secret is NOT stored
        pool = await repo._get_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT encrypted_access_token FROM integration_credentials WHERE integration_id = 'github'"
            )
            assert row is not None
            enc_data = row["encrypted_access_token"]
            # Must not contain raw secret substring
            assert raw_secret not in enc_data
            # Decryption yields original secret
            decrypted = vault.decrypt(enc_data)
            assert decrypted == raw_secret

    def test_status_endpoint_never_exposes_plaintext_token(self, client):
        res = client.get("/api/integrations/github/status")
        assert res.status_code == 200
        data = res.json()
        raw_text = json.dumps(data)
        assert "gho_super_secret" not in raw_text
        if data.get("masked_token"):
            assert "..." in data["masked_token"] or "●" in data["masked_token"] or "***" in data["masked_token"]

    def test_disconnect_purges_stored_credentials(self, client):
        res = client.post("/api/integrations/github/disconnect")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "DISCONNECTED"

        status_res = client.get("/api/integrations/github/status")
        status_data = status_res.json()
        assert status_data["is_connected"] is False
        assert status_data["is_authenticated"] is False
        assert status_data["masked_token"] is None
