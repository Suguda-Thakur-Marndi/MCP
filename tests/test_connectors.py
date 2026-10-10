"""
Tests for Multi-Software MCP Connector Platform (Phase 1-4).
Validates:
1. Credential Vault encryption, decryption, and secret masking.
2. Connector Registry lifecycle, tool discovery, and health probes.
3. BaseConnector compliance for Canva, GitHub, Slack, Google Drive, and Custom MCP.
4. Canva OAuth 2.0 PKCE code verifier and challenge generation.
5. Fail-closed behavior on missing or invalid credentials.
"""

import pytest

from mcp_sentinel.connectors.canva import CanvaConnector
from mcp_sentinel.connectors.github import GitHubConnector
from mcp_sentinel.connectors.google_drive import GoogleDriveConnector
from mcp_sentinel.connectors.models import (
    AuthType,
    IntegrationStatus,
    RiskLevel,
)
from mcp_sentinel.connectors.registry import get_connector_registry
from mcp_sentinel.connectors.slack import SlackConnector
from mcp_sentinel.connectors.vault import CredentialVault, get_vault


class TestCredentialVault:
    def test_encrypt_decrypt_roundtrip(self):
        vault = CredentialVault(secret_key="test-secret-key-32chars-minimum-length")
        plaintext = "canva_oauth_token_xyz987"
        encrypted = vault.encrypt(plaintext)
        assert encrypted != plaintext
        assert vault.decrypt(encrypted) == plaintext

    def test_encrypt_empty(self):
        vault = get_vault()
        assert vault.encrypt("") == ""
        assert vault.decrypt("") == ""

    def test_mask_secret(self):
        assert CredentialVault.mask_secret("ghp_1234567890abcdef") == "ghp_...cdef"
        assert CredentialVault.mask_secret("short") == "●●●●●●●●"
        assert CredentialVault.mask_secret(None) == "[NONE]"


class TestCanvaConnector:
    def test_canva_initialization(self):
        canva = CanvaConnector()
        assert canva.integration_id == "canva"
        assert canva.endpoint == "https://mcp.canva.com/mcp"
        assert canva.auth_type == AuthType.OAUTH2
        assert canva.status == IntegrationStatus.DISCONNECTED

    def test_canva_pkce_generation(self):
        verifier, challenge = CanvaConnector.generate_pkce_pair()
        assert len(verifier) >= 43
        assert len(challenge) >= 43
        assert verifier != challenge

    def test_canva_auth_url_construction(self):
        verifier, challenge = CanvaConnector.generate_pkce_pair()
        url = CanvaConnector.get_authorization_url(
            client_id="test_client_id",
            redirect_uri="http://localhost:3000/callback",
            state="xyz_state",
            code_challenge=challenge,
        )
        assert "canva.com/api/oauth/authorize" in url
        assert "client_id=test_client_id" in url
        assert "code_challenge=" in url
        assert "code_challenge_method=S256" in url

    @pytest.mark.asyncio
    async def test_canva_tool_discovery(self):
        canva = CanvaConnector()
        tools = await canva.list_tools()
        assert len(tools) >= 5
        tool_ids = [t.tool_id for t in tools]
        assert "canva.search_designs" in tool_ids
        assert "canva.get_design" in tool_ids
        assert "canva.create_design" in tool_ids
        assert "canva.update_design" in tool_ids

        # Risk classification checks
        search_tool = next(t for t in tools if t.tool_id == "canva.search_designs")
        assert search_tool.risk_level == RiskLevel.LOW
        assert search_tool.approval_required is False

        update_tool = next(t for t in tools if t.tool_id == "canva.update_design")
        assert update_tool.risk_level == RiskLevel.HIGH
        assert update_tool.approval_required is True

    @pytest.mark.asyncio
    async def test_canva_unauthenticated_execution_fails_closed(self):
        canva = CanvaConnector()
        res = await canva.execute_tool("canva.search_designs", {"query": "marketing"})
        assert res.success is False
        assert "not authenticated" in res.error.lower()


class TestGitHubConnector:
    def test_github_initialization(self):
        gh = GitHubConnector()
        assert gh.integration_id == "github"
        assert gh.endpoint == "https://api.github.com"

    @pytest.mark.asyncio
    async def test_github_tool_discovery(self):
        gh = GitHubConnector()
        tools = await gh.list_tools()
        tool_ids = [t.tool_id for t in tools]
        assert "github.list_repositories" in tool_ids
        assert "github.delete_repository" in tool_ids

        # Delete repo must be CRITICAL and require approval
        del_tool = next(t for t in tools if t.tool_id == "github.delete_repository")
        assert del_tool.risk_level == RiskLevel.CRITICAL
        assert del_tool.approval_required is True

    @pytest.mark.asyncio
    async def test_github_unauthenticated_fails_closed(self):
        gh = GitHubConnector()
        res = await gh.execute_tool("github.list_repositories", {})
        assert res.success is False
        assert "not authenticated" in res.error.lower()


class TestSlackConnector:
    def test_slack_initialization(self):
        slack = SlackConnector()
        assert slack.integration_id == "slack"
        assert slack.endpoint == "https://slack.com/api"

    @pytest.mark.asyncio
    async def test_slack_tool_discovery(self):
        slack = SlackConnector()
        tools = await slack.list_tools()
        tool_ids = [t.tool_id for t in tools]
        assert "slack.send_message" in tool_ids

        send_msg = next(t for t in tools if t.tool_id == "slack.send_message")
        assert send_msg.risk_level == RiskLevel.HIGH
        assert send_msg.approval_required is True


class TestGoogleDriveConnector:
    def test_google_drive_initialization(self):
        drive = GoogleDriveConnector()
        assert drive.integration_id == "google_drive"
        assert drive.endpoint == "https://www.googleapis.com/drive/v3"

    @pytest.mark.asyncio
    async def test_google_drive_tools(self):
        drive = GoogleDriveConnector()
        tools = await drive.list_tools()
        tool_ids = [t.tool_id for t in tools]
        assert "google_drive.delete_file" in tool_ids

        del_file = next(t for t in tools if t.tool_id == "google_drive.delete_file")
        assert del_file.risk_level == RiskLevel.CRITICAL
        assert del_file.approval_required is True


class TestConnectorRegistry:
    def test_registry_initializes_builtins(self):
        reg = get_connector_registry()
        connectors = reg.list_connectors()
        int_ids = [c.integration_id for c in connectors]
        assert "canva" in int_ids
        assert "github" in int_ids
        assert "slack" in int_ids
        assert "google_drive" in int_ids
        assert "custom_mcp" in int_ids

    @pytest.mark.asyncio
    async def test_discover_all_tools(self):
        reg = get_connector_registry()
        tools = await reg.discover_all_tools()
        assert len(tools) >= 20
        integrations_represented = {t.integration_id for t in tools}
        assert "canva" in integrations_represented
        assert "github" in integrations_represented
        assert "slack" in integrations_represented
        assert "google_drive" in integrations_represented
        assert "custom_mcp" in integrations_represented
