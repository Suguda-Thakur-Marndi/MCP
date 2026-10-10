"""
GitHub Connector for MCP Sentinel.
Connects to GitHub REST API (https://api.github.com).
Supports GitHub OAuth 2.0 PKCE / Web Application Flow and PAT tokens,
repository inspection, issue creation, pull request review & merging,
and destructive action protection.
"""

from __future__ import annotations

import time
import urllib.parse
from typing import Any, Optional

import httpx

from mcp_sentinel.connectors.base import BaseConnector
from mcp_sentinel.connectors.models import (
    AuthType,
    ConnectionTestResult,
    ConnectorCredentials,
    ConnectorHealth,
    DiscoveredTool,
    IntegrationStatus,
    ProtocolType,
    RiskLevel,
    ToolExecutionResult,
    ToolState,
)


class GitHubConnector(BaseConnector):
    """
    Official GitHub REST API Connector.
    Endpoint: https://api.github.com
    """

    DEFAULT_ENDPOINT = "https://api.github.com"

    STANDARD_GITHUB_TOOLS = [
        {
            "id": "github.get_authenticated_user",
            "name": "get_authenticated_user",
            "desc": "Fetch details of the authenticated GitHub user, username, ID, and scopes.",
            "risk": RiskLevel.LOW,
            "approval": False,
            "schema": {
                "type": "object",
                "properties": {},
            },
        },
        {
            "id": "github.list_repositories",
            "name": "list_repositories",
            "desc": "List authenticated user or organization repositories.",
            "risk": RiskLevel.LOW,
            "approval": False,
            "schema": {
                "type": "object",
                "properties": {
                    "visibility": {"type": "string", "enum": ["all", "public", "private"], "default": "all"},
                    "limit": {"type": "integer", "default": 30, "maximum": 100},
                },
            },
        },
        {
            "id": "github.get_repository",
            "name": "get_repository",
            "desc": "Fetch complete repository metadata, default branch, and security alerts.",
            "risk": RiskLevel.LOW,
            "approval": False,
            "schema": {
                "type": "object",
                "required": ["owner", "repo"],
                "properties": {
                    "owner": {"type": "string", "description": "Repository owner"},
                    "repo": {"type": "string", "description": "Repository name"},
                },
            },
        },
        {
            "id": "github.list_issues",
            "name": "list_issues",
            "desc": "List issues for a repository with optional state filter.",
            "risk": RiskLevel.LOW,
            "approval": False,
            "schema": {
                "type": "object",
                "required": ["owner", "repo"],
                "properties": {
                    "owner": {"type": "string", "description": "Repository owner"},
                    "repo": {"type": "string", "description": "Repository name"},
                    "state": {"type": "string", "enum": ["open", "closed", "all"], "default": "open"},
                    "limit": {"type": "integer", "default": 30, "maximum": 100},
                },
            },
        },
        {
            "id": "github.create_issue",
            "name": "create_issue",
            "desc": "Create a new tracking issue in a repository.",
            "risk": RiskLevel.MEDIUM,
            "approval": False,
            "schema": {
                "type": "object",
                "required": ["owner", "repo", "title"],
                "properties": {
                    "owner": {"type": "string"},
                    "repo": {"type": "string"},
                    "title": {"type": "string"},
                    "body": {"type": "string"},
                    "labels": {"type": "array", "items": {"type": "string"}},
                },
            },
        },
        {
            "id": "github.create_pull_request",
            "name": "create_pull_request",
            "desc": "Create a pull request merging a feature branch into base branch.",
            "risk": RiskLevel.MEDIUM,
            "approval": False,
            "schema": {
                "type": "object",
                "required": ["owner", "repo", "title", "head"],
                "properties": {
                    "owner": {"type": "string"},
                    "repo": {"type": "string"},
                    "title": {"type": "string"},
                    "head": {"type": "string"},
                    "base": {"type": "string", "default": "main"},
                    "body": {"type": "string"},
                },
            },
        },
        {
            "id": "github.close_issue",
            "name": "close_issue",
            "desc": "Close an existing issue in a repository.",
            "risk": RiskLevel.MEDIUM,
            "approval": False,
            "schema": {
                "type": "object",
                "required": ["owner", "repo", "issue_number"],
                "properties": {
                    "owner": {"type": "string"},
                    "repo": {"type": "string"},
                    "issue_number": {"type": "integer"},
                    "comment": {"type": "string", "description": "Optional closing comment"},
                },
            },
        },
        {
            "id": "github.merge_pull_request",
            "name": "merge_pull_request",
            "desc": "Merge an approved pull request into target deployment branch. Governed action requiring approval.",
            "risk": RiskLevel.HIGH,
            "approval": True,
            "schema": {
                "type": "object",
                "required": ["owner", "repo", "pull_number"],
                "properties": {
                    "owner": {"type": "string"},
                    "repo": {"type": "string"},
                    "pull_number": {"type": "integer"},
                    "commit_title": {"type": "string"},
                    "merge_method": {"type": "string", "enum": ["merge", "squash", "rebase"], "default": "merge"},
                },
            },
        },
        {
            "id": "github.delete_file",
            "name": "delete_file",
            "desc": "Delete a file from a repository with commit message. Governed action requiring approval.",
            "risk": RiskLevel.HIGH,
            "approval": True,
            "schema": {
                "type": "object",
                "required": ["owner", "repo", "path", "message", "sha"],
                "properties": {
                    "owner": {"type": "string"},
                    "repo": {"type": "string"},
                    "path": {"type": "string"},
                    "message": {"type": "string"},
                    "sha": {"type": "string", "description": "The blob SHA of the file being deleted"},
                    "branch": {"type": "string", "default": "main"},
                },
            },
        },
        {
            "id": "github.delete_repository",
            "name": "delete_repository",
            "desc": "Permanently delete an entire GitHub repository. Strictly governed action requiring approval.",
            "risk": RiskLevel.CRITICAL,
            "approval": True,
            "schema": {
                "type": "object",
                "required": ["owner", "repo", "confirmation"],
                "properties": {
                    "owner": {"type": "string"},
                    "repo": {"type": "string"},
                    "confirmation": {"type": "string", "description": "Must match exact repo name"},
                },
            },
        },
    ]

    def __init__(
        self,
        endpoint: str = DEFAULT_ENDPOINT,
        credentials: Optional[ConnectorCredentials] = None,
        timeout_seconds: float = 15.0,
    ) -> None:
        super().__init__(
            integration_id="github",
            name="GitHub",
            endpoint=endpoint,
            protocol_type=ProtocolType.REST_API,
            auth_type=AuthType.OAUTH_APP,
            credentials=credentials,
        )
        self.timeout_seconds = timeout_seconds
        self._tool_cache: dict[str, DiscoveredTool] = {}

    @classmethod
    def get_authorization_url(
        cls,
        client_id: str,
        redirect_uri: str,
        state: str,
        scopes: Optional[list[str]] = None,
    ) -> str:
        """Constructs GitHub OAuth 2.0 authorization URL."""
        target_scopes = scopes or ["repo", "read:user", "user:email"]
        scope_str = " ".join(target_scopes)
        params = {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "scope": scope_str,
            "state": state,
        }
        return f"https://github.com/login/oauth/authorize?{urllib.parse.urlencode(params)}"

    @classmethod
    async def exchange_code(
        cls,
        client_id: str,
        client_secret: str,
        code: str,
        redirect_uri: str,
    ) -> ConnectorCredentials:
        """Exchanges authorization code for GitHub OAuth access token."""
        url = "https://github.com/login/oauth/access_token"
        headers = {
            "Accept": "application/json",
            "User-Agent": "MCP-Sentinel-Gateway/1.0",
        }
        payload = {
            "client_id": client_id,
            "client_secret": client_secret,
            "code": code,
            "redirect_uri": redirect_uri,
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, json=payload, headers=headers)

        if resp.status_code != 200:
            raise RuntimeError(f"GitHub OAuth token exchange HTTP {resp.status_code}: {resp.text}")

        data = resp.json()
        if "error" in data:
            raise RuntimeError(f"GitHub OAuth error: {data.get('error_description') or data.get('error')}")

        access_token = data.get("access_token")
        if not access_token:
            raise RuntimeError("GitHub did not return an access token in OAuth response.")

        token_type = data.get("token_type", "Bearer")
        raw_scope = data.get("scope", "")
        scopes = [s.strip() for s in raw_scope.split(",") if s.strip()]

        return ConnectorCredentials(
            access_token=access_token,
            token_type=token_type.capitalize() if token_type.lower() == "bearer" else token_type,
            scopes=scopes,
        )

    def _get_headers(self) -> dict[str, str]:
        headers = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "MCP-Sentinel-Gateway/1.0",
        }
        token = None
        if self._credentials:
            token = self._credentials.access_token or self._credentials.api_key
        if token:
            headers["Authorization"] = f"Bearer {token}"
        return headers

    async def connect(self) -> bool:
        test = await self.test_connection()
        if test.success:
            self._connected = True
            self._status = IntegrationStatus.CONNECTED
            return True
        self._connected = False
        self._status = IntegrationStatus.ERROR
        return False

    async def disconnect(self) -> bool:
        self._connected = False
        self._status = IntegrationStatus.DISCONNECTED
        return True

    async def authenticate(self, credentials: ConnectorCredentials) -> bool:
        self._credentials = credentials
        return await self.connect()

    async def refresh_auth(self) -> bool:
        return False

    async def test_connection(self) -> ConnectionTestResult:
        start = time.perf_counter()
        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                has_auth = bool(self._credentials and (self._credentials.access_token or self._credentials.api_key))
                url = f"{self.endpoint}/user" if has_auth else f"{self.endpoint}/zen"
                resp = await client.get(url, headers=self._get_headers())

            latency = int((time.perf_counter() - start) * 1000)
            if resp.status_code == 200:
                user_data = resp.json() if has_auth else {}
                username = user_data.get("login", "anonymous")
                user_id = user_data.get("id")
                raw_scopes = resp.headers.get("x-oauth-scopes", "")
                scopes = [s.strip() for s in raw_scopes.split(",") if s.strip()]
                rate_limit = resp.headers.get("x-ratelimit-remaining")

                return ConnectionTestResult(
                    success=True,
                    latency_ms=latency,
                    message=f"Connected to GitHub as {username}",
                    server_version="GitHub-API/v3",
                    details={
                        "username": username,
                        "user_id": user_id,
                        "scopes": scopes,
                        "rate_limit_remaining": rate_limit,
                        "authenticated": has_auth,
                    },
                )
            elif resp.status_code == 401:
                return ConnectionTestResult(
                    success=False,
                    latency_ms=latency,
                    message="GitHub authentication failed: Bad credentials",
                )
            else:
                return ConnectionTestResult(
                    success=False,
                    latency_ms=latency,
                    message=f"GitHub API returned HTTP {resp.status_code}",
                )
        except Exception as exc:
            latency = int((time.perf_counter() - start) * 1000)
            return ConnectionTestResult(
                success=False,
                latency_ms=latency,
                message=f"GitHub network error: {str(exc)}",
            )

    async def list_tools(self) -> list[DiscoveredTool]:
        discovered = []
        for s in self.STANDARD_GITHUB_TOOLS:
            tool = DiscoveredTool(
                tool_id=s["id"],
                integration_id="github",
                name=s["name"],
                description=s["desc"],
                input_schema=s["schema"],
                risk_level=s["risk"],
                approval_required=s["approval"],
                enabled=True,
                state=ToolState.AVAILABLE if self.is_connected else ToolState.DISCOVERED,
            )
            self._tool_cache[s["id"]] = tool
            discovered.append(tool)
        return discovered

    async def get_tool_schema(self, tool_id: str) -> dict[str, Any]:
        if not self._tool_cache:
            await self.list_tools()
        tool = self._tool_cache.get(tool_id)
        return tool.input_schema if tool else {}

    async def execute_tool(
        self,
        tool_id: str,
        parameters: dict[str, Any],
    ) -> ToolExecutionResult:
        start = time.perf_counter()
        if not self._credentials or not (self._credentials.access_token or self._credentials.api_key):
            return ToolExecutionResult(
                success=False,
                error="GitHub connector is not authenticated. Please complete OAuth connection.",
                latency_ms=0,
                status="BLOCKED",
                tool_id=tool_id,
                integration_id=self.integration_id,
            )

        headers = self._get_headers()
        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                if tool_id in ("github.get_authenticated_user", "get_authenticated_user"):
                    resp = await client.get(f"{self.endpoint}/user", headers=headers)

                elif tool_id in ("github.list_repositories", "list_repositories"):
                    limit = parameters.get("limit", 30)
                    visibility = parameters.get("visibility", "all")
                    resp = await client.get(
                        f"{self.endpoint}/user/repos?per_page={limit}&visibility={visibility}",
                        headers=headers,
                    )

                elif tool_id in ("github.get_repository", "get_repository"):
                    owner = parameters["owner"]
                    repo = parameters["repo"]
                    resp = await client.get(f"{self.endpoint}/repos/{owner}/{repo}", headers=headers)

                elif tool_id in ("github.list_issues", "list_issues"):
                    owner = parameters["owner"]
                    repo = parameters["repo"]
                    state = parameters.get("state", "open")
                    limit = parameters.get("limit", 30)
                    resp = await client.get(
                        f"{self.endpoint}/repos/{owner}/{repo}/issues?state={state}&per_page={limit}",
                        headers=headers,
                    )

                elif tool_id in ("github.create_issue", "create_issue"):
                    owner = parameters["owner"]
                    repo = parameters["repo"]
                    payload: dict[str, Any] = {"title": parameters["title"]}
                    if "body" in parameters:
                        payload["body"] = parameters["body"]
                    if "labels" in parameters:
                        payload["labels"] = parameters["labels"]
                    resp = await client.post(
                        f"{self.endpoint}/repos/{owner}/{repo}/issues",
                        json=payload,
                        headers=headers,
                    )

                elif tool_id in ("github.create_pull_request", "create_pull_request"):
                    owner = parameters["owner"]
                    repo = parameters["repo"]
                    payload = {
                        "title": parameters["title"],
                        "head": parameters["head"],
                        "base": parameters.get("base", "main"),
                    }
                    if "body" in parameters:
                        payload["body"] = parameters["body"]
                    resp = await client.post(
                        f"{self.endpoint}/repos/{owner}/{repo}/pulls",
                        json=payload,
                        headers=headers,
                    )

                elif tool_id in ("github.close_issue", "close_issue"):
                    owner = parameters["owner"]
                    repo = parameters["repo"]
                    issue_number = parameters["issue_number"]
                    if "comment" in parameters and parameters["comment"]:
                        await client.post(
                            f"{self.endpoint}/repos/{owner}/{repo}/issues/{issue_number}/comments",
                            json={"body": parameters["comment"]},
                            headers=headers,
                        )
                    resp = await client.patch(
                        f"{self.endpoint}/repos/{owner}/{repo}/issues/{issue_number}",
                        json={"state": "closed"},
                        headers=headers,
                    )

                elif tool_id in ("github.merge_pull_request", "merge_pull_request"):
                    owner = parameters["owner"]
                    repo = parameters["repo"]
                    pull_number = parameters["pull_number"]
                    payload = {
                        "merge_method": parameters.get("merge_method", "merge"),
                    }
                    if "commit_title" in parameters:
                        payload["commit_title"] = parameters["commit_title"]
                    resp = await client.put(
                        f"{self.endpoint}/repos/{owner}/{repo}/pulls/{pull_number}/merge",
                        json=payload,
                        headers=headers,
                    )

                elif tool_id in ("github.delete_file", "delete_file"):
                    owner = parameters["owner"]
                    repo = parameters["repo"]
                    path = parameters["path"].lstrip("/")
                    payload = {
                        "message": parameters["message"],
                        "sha": parameters["sha"],
                        "branch": parameters.get("branch", "main"),
                    }
                    resp = await client.request(
                        "DELETE",
                        f"{self.endpoint}/repos/{owner}/{repo}/contents/{path}",
                        json=payload,
                        headers=headers,
                    )

                elif tool_id in ("github.delete_repository", "delete_repository"):
                    owner = parameters["owner"]
                    repo = parameters["repo"]
                    if parameters.get("confirmation") != repo:
                        raise ValueError(f"Confirmation '{parameters.get('confirmation')}' does not match '{repo}'")
                    resp = await client.delete(f"{self.endpoint}/repos/{owner}/{repo}", headers=headers)

                else:
                    raise ValueError(f"Unknown GitHub tool: {tool_id}")

            latency = int((time.perf_counter() - start) * 1000)
            if resp.status_code >= 400:
                return ToolExecutionResult(
                    success=False,
                    error=f"GitHub API HTTP {resp.status_code}: {resp.text}",
                    latency_ms=latency,
                    status="FAILED",
                    tool_id=tool_id,
                    integration_id=self.integration_id,
                )

            data = resp.json() if resp.text and resp.status_code != 204 else {"deleted": True, "status": "success"}
            return ToolExecutionResult(
                success=True,
                data=data,
                latency_ms=latency,
                status="EXECUTED",
                tool_id=tool_id,
                integration_id=self.integration_id,
            )
        except Exception as exc:
            latency = int((time.perf_counter() - start) * 1000)
            return ToolExecutionResult(
                success=False,
                error=str(exc),
                latency_ms=latency,
                status="FAILED",
                tool_id=tool_id,
                integration_id=self.integration_id,
            )

    async def revoke_credentials(self) -> bool:
        self._credentials = None
        await self.disconnect()
        return True

    async def health_check(self) -> ConnectorHealth:
        test = await self.test_connection()
        return ConnectorHealth(
            status=IntegrationStatus.CONNECTED if test.success else IntegrationStatus.DEGRADED,
            latency_ms=test.latency_ms,
            error_message=None if test.success else test.message,
        )
