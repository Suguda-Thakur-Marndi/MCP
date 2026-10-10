"""
Integrations API Router for MCP Sentinel Multi-Software Gateway.
Exposes endpoints to view, connect, test, and disconnect external software
connectors (Canva, GitHub, Slack, Google Drive, Notion, Jira, Custom MCP).
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from mcp_sentinel.config.settings import get_settings
from mcp_sentinel.connectors.canva import CanvaConnector
from mcp_sentinel.connectors.github import GitHubConnector
from mcp_sentinel.connectors.models import (
    ConnectorCredentials,
    IntegrationStatus,
)
from mcp_sentinel.connectors.registry import get_connector_registry
from mcp_sentinel.connectors.vault import CredentialVault
from mcp_sentinel.repositories.integration_repository import IntegrationRepository
from mcp_sentinel.repositories.tool_repository import ToolRepository
from mcp_sentinel.security.audit_logger import log_security_event
from mcp_sentinel.services.tool_registry_service import ToolRegistryService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/integrations", tags=["Integrations"])

_integration_repo: Optional[IntegrationRepository] = None
_tool_registry_service: Optional[ToolRegistryService] = None


def get_integration_repo() -> IntegrationRepository:
    global _integration_repo
    if _integration_repo is None:
        _integration_repo = IntegrationRepository()
    return _integration_repo


def get_tool_registry_service() -> ToolRegistryService:
    global _tool_registry_service
    if _tool_registry_service is None:
        _tool_registry_service = ToolRegistryService()
    return _tool_registry_service


class ConnectRequest(BaseModel):
    """Payload to connect an integration with credentials."""
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    api_key: Optional[str] = None
    token_type: str = "Bearer"


class CanvaOAuthUrlResponse(BaseModel):
    authorization_url: str
    code_verifier: str
    state: str


class CanvaOAuthCallbackRequest(BaseModel):
    code: str
    code_verifier: str
    client_id: str
    client_secret: str
    redirect_uri: str


@router.get("", summary="List all integrations")
async def list_integrations(
    repo: IntegrationRepository = Depends(get_integration_repo),
) -> list[dict[str, Any]]:
    integrations = await repo.list_integrations()
    reg = get_connector_registry()

    # Augment with live connector status
    for item in integrations:
        connector = reg.get_connector(item["id"])
        if connector:
            item["live_status"] = connector.status.value
            item["is_connected"] = connector.is_connected
        else:
            item["live_status"] = item["status"]
            item["is_connected"] = (item["status"] == "CONNECTED")
    return integrations


@router.get("/canva/oauth-url", summary="Generate Canva OAuth 2.0 PKCE Authorization URL")
async def get_canva_oauth_url(
    client_id: str = Query(..., description="Canva Developer Client ID"),
    redirect_uri: str = Query(..., description="Redirect URI configured in Canva app"),
) -> CanvaOAuthUrlResponse:
    import secrets
    verifier, challenge = CanvaConnector.generate_pkce_pair()
    state = secrets.token_urlsafe(16)
    auth_url = CanvaConnector.get_authorization_url(
        client_id=client_id,
        redirect_uri=redirect_uri,
        state=state,
        code_challenge=challenge,
    )
    return CanvaOAuthUrlResponse(
        authorization_url=auth_url,
        code_verifier=verifier,
        state=state,
    )


@router.post("/canva/oauth-callback", summary="Complete Canva OAuth 2.0 PKCE Token Exchange")
async def complete_canva_oauth(
    body: CanvaOAuthCallbackRequest,
    repo: IntegrationRepository = Depends(get_integration_repo),
) -> dict[str, Any]:
    try:
        credentials = await CanvaConnector.exchange_code(
            client_id=body.client_id,
            client_secret=body.client_secret,
            code=body.code,
            code_verifier=body.code_verifier,
            redirect_uri=body.redirect_uri,
        )
        # Encrypt and persist credentials
        await repo.save_credentials("canva", credentials)
        await repo.update_status("canva", IntegrationStatus.CONNECTED)

        # Update active connector in memory
        reg = get_connector_registry()
        canva = reg.get_connector("canva")
        if canva:
            await canva.authenticate(credentials)

        # Sync Canva tools
        tool_svc = get_tool_registry_service()
        await tool_svc.sync_all_tools()

        return {"success": True, "message": "Canva OAuth connected successfully", "integration_id": "canva"}
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Canva OAuth exchange failed: {str(exc)}",
        )


# =============================================================================
# GitHub OAuth & Integration Management
# =============================================================================

class GitHubConnectRequest(BaseModel):
    access_token: Optional[str] = None
    code: Optional[str] = None
    state: Optional[str] = None
    redirect_uri: Optional[str] = None
    token_type: str = "Bearer"


class GitHubOAuthUrlResponse(BaseModel):
    authorization_url: str
    state: str
    client_id: str
    redirect_uri: str


@router.get("/github/connect", summary="Generate GitHub OAuth 2.0 Authorization URL")
async def get_github_oauth_url(
    redirect_uri: Optional[str] = None,
    scopes: Optional[str] = None,
) -> GitHubOAuthUrlResponse:
    import secrets
    settings = get_settings()
    client_id = settings.GITHUB_OAUTH_CLIENT_ID
    if not client_id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="GITHUB_OAUTH_CLIENT_ID is not configured in backend environment",
        )
    target_redirect = redirect_uri or settings.GITHUB_OAUTH_REDIRECT_URI
    state = secrets.token_urlsafe(16)
    target_scopes = [s.strip() for s in scopes.split(",")] if scopes else ["repo", "read:user", "user:email"]

    auth_url = GitHubConnector.get_authorization_url(
        client_id=client_id,
        redirect_uri=target_redirect,
        state=state,
        scopes=target_scopes,
    )
    return GitHubOAuthUrlResponse(
        authorization_url=auth_url,
        state=state,
        client_id=client_id,
        redirect_uri=target_redirect,
    )


@router.post("/github/connect", summary="Connect GitHub via OAuth code or Personal Access Token")
async def connect_github(
    body: GitHubConnectRequest,
    repo: IntegrationRepository = Depends(get_integration_repo),
    tool_svc: ToolRegistryService = Depends(get_tool_registry_service),
) -> dict[str, Any]:
    settings = get_settings()
    reg = get_connector_registry()
    connector = reg.get_connector("github")
    if not connector:
        raise HTTPException(status_code=500, detail="GitHub connector is not registered in MCP Sentinel")

    credentials: Optional[ConnectorCredentials] = None

    if body.code:
        if not settings.GITHUB_OAUTH_CLIENT_ID or not settings.GITHUB_OAUTH_CLIENT_SECRET:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="GitHub OAuth credentials (CLIENT_ID/SECRET) not configured in backend",
            )
        target_redirect = body.redirect_uri or settings.GITHUB_OAUTH_REDIRECT_URI
        try:
            credentials = await GitHubConnector.exchange_code(
                client_id=settings.GITHUB_OAUTH_CLIENT_ID,
                client_secret=settings.GITHUB_OAUTH_CLIENT_SECRET,
                code=body.code,
                redirect_uri=target_redirect,
            )
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to exchange GitHub authorization code: {str(exc)}",
            )
    elif body.access_token:
        credentials = ConnectorCredentials(
            access_token=body.access_token,
            token_type=body.token_type,
            scopes=["repo", "read:user"],
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Must provide either 'code' for OAuth exchange or 'access_token' for PAT connection",
        )

    # Test the connection with GitHub
    await connector.authenticate(credentials)
    test_res = await connector.test_connection()
    if not test_res.success:
        await connector.disconnect()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"GitHub connection test failed: {test_res.message}",
        )

    # Save encrypted credentials at rest (never plaintext)
    await repo.save_credentials("github", credentials)
    await repo.update_status("github", IntegrationStatus.CONNECTED)

    # Synchronize GitHub tools into database registry
    await tool_svc.sync_all_tools()

    # Log security event
    log_security_event(
        event_type="GITHUB_CONNECTED",
        action="github.connect",
        decision="PERMIT",
        details={
            "user": test_res.details.get("username") if test_res.details else None,
            "scopes": test_res.details.get("scopes") if test_res.details else None,
            "latency_ms": test_res.latency_ms,
        },
    )

    username = test_res.details.get("username") if test_res.details else "user"
    return {
        "success": True,
        "message": f"Successfully connected to GitHub as {username}",
        "status": "CONNECTED",
        "integration_id": "github",
        "authenticated_user": username,
        "scopes": test_res.details.get("scopes", []) if test_res.details else [],
        "latency_ms": test_res.latency_ms,
    }


@router.get("/github/callback", summary="GitHub OAuth 2.0 Web Redirect Callback")
async def github_oauth_callback(
    request: Request,
    code: str = Query(..., description="Authorization code returned by GitHub"),
    state: Optional[str] = Query(None, description="State token for CSRF protection"),
    repo: IntegrationRepository = Depends(get_integration_repo),
    tool_svc: ToolRegistryService = Depends(get_tool_registry_service),
):
    settings = get_settings()
    if not settings.GITHUB_OAUTH_CLIENT_ID or not settings.GITHUB_OAUTH_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="GitHub OAuth credentials not configured in backend",
        )

    try:
        credentials = await GitHubConnector.exchange_code(
            client_id=settings.GITHUB_OAUTH_CLIENT_ID,
            client_secret=settings.GITHUB_OAUTH_CLIENT_SECRET,
            code=code,
            redirect_uri=settings.GITHUB_OAUTH_REDIRECT_URI,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"GitHub OAuth callback exchange failed: {str(exc)}",
        )

    reg = get_connector_registry()
    connector = reg.get_connector("github")
    if connector:
        await connector.authenticate(credentials)
        test_res = await connector.test_connection()
        username = test_res.details.get("username", "authenticated_user") if test_res.details else "authenticated_user"
    else:
        username = "authenticated_user"

    await repo.save_credentials("github", credentials)
    await repo.update_status("github", IntegrationStatus.CONNECTED)
    await tool_svc.sync_all_tools()

    log_security_event(
        event_type="GITHUB_OAUTH_SUCCESS",
        action="github.callback",
        decision="PERMIT",
        details={"username": username},
    )

    accept_header = request.headers.get("accept", "")
    if "text/html" in accept_header:
        redirect_url = f"{settings.FRONTEND_URL}/integrations/github?connected=true&user={username}"
        return RedirectResponse(url=redirect_url, status_code=302)

    return {
        "success": True,
        "message": f"GitHub connected successfully as {username}",
        "username": username,
        "status": "CONNECTED",
        "integration_id": "github",
    }


@router.post("/github/disconnect", summary="Disconnect GitHub and revoke stored credentials")
async def disconnect_github(
    repo: IntegrationRepository = Depends(get_integration_repo),
) -> dict[str, Any]:
    reg = get_connector_registry()
    connector = reg.get_connector("github")
    if connector:
        await connector.revoke_credentials()

    await repo.delete_credentials("github")
    await repo.update_status("github", IntegrationStatus.DISCONNECTED)

    log_security_event(
        event_type="GITHUB_DISCONNECTED",
        action="github.disconnect",
        decision="PERMIT",
    )

    return {
        "success": True,
        "message": "GitHub disconnected and credentials purged from secure vault",
        "status": "DISCONNECTED",
        "integration_id": "github",
    }


@router.get("/github/status", summary="Get GitHub Integration detailed status")
async def get_github_status(
    repo: IntegrationRepository = Depends(get_integration_repo),
    tool_repo: ToolRepository = Depends(lambda: ToolRepository()),
) -> dict[str, Any]:
    integration = await repo.get_integration("github")
    if not integration:
        raise HTTPException(status_code=404, detail="GitHub integration record not found")

    reg = get_connector_registry()
    connector = reg.get_connector("github")
    creds = await repo.get_credentials("github")

    is_authenticated = bool(creds and (creds.access_token or creds.api_key))
    authenticated_user = None
    scopes: list[str] = []

    if connector and is_authenticated:
        if not connector._credentials:
            connector._credentials = creds
        test = await connector.test_connection()
        if test.success and test.details:
            authenticated_user = {
                "login": test.details.get("username"),
                "id": test.details.get("user_id"),
                "rate_limit_remaining": test.details.get("rate_limit_remaining"),
            }
            scopes = test.details.get("scopes", creds.scopes if creds else [])

    tools = await tool_repo.list_tools(integration_id="github")

    return {
        "id": "github",
        "name": "GitHub",
        "status": connector.status.value if connector else integration["status"],
        "is_connected": connector.is_connected if connector else (integration["status"] == "CONNECTED"),
        "is_authenticated": is_authenticated,
        "authenticated_user": authenticated_user,
        "scopes": scopes or (creds.scopes if creds else []),
        "masked_token": CredentialVault.mask_secret(creds.access_token or creds.api_key) if creds else None,
        "token_type": creds.token_type if creds else None,
        "connection_endpoint": integration["connection_endpoint"],
        "tools_count": len(tools),
        "last_activity": integration.get("updated_at"),
        "risk_level": "CRITICAL",
    }


@router.post("/github/test", summary="Test live connection to GitHub API")
async def test_github_connection(
    repo: IntegrationRepository = Depends(get_integration_repo),
) -> dict[str, Any]:
    reg = get_connector_registry()
    connector = reg.get_connector("github")
    if not connector:
        raise HTTPException(status_code=400, detail="GitHub connector not registered")

    if not connector._credentials:
        creds = await repo.get_credentials("github")
        if creds:
            connector._credentials = creds

    test_res = await connector.test_connection()
    return {
        "success": test_res.success,
        "latency_ms": test_res.latency_ms,
        "message": test_res.message,
        "server_version": test_res.server_version,
        "details": test_res.details,
    }


@router.get("/{integration_id}", summary="Get integration details")
async def get_integration(
    integration_id: str,
    repo: IntegrationRepository = Depends(get_integration_repo),
) -> dict[str, Any]:
    integration = await repo.get_integration(integration_id)
    if not integration:
        raise HTTPException(status_code=404, detail=f"Integration '{integration_id}' not found")

    reg = get_connector_registry()
    connector = reg.get_connector(integration_id)
    creds = await repo.get_credentials(integration_id)

    integration["is_authenticated"] = bool(creds and (creds.access_token or creds.api_key))
    if creds:
        integration["token_type"] = creds.token_type
        integration["masked_token"] = CredentialVault.mask_secret(creds.access_token or creds.api_key)
        integration["scopes"] = creds.scopes

    if connector:
        integration["is_connected"] = connector.is_connected
        integration["live_status"] = connector.status.value

    return integration


@router.post("/{integration_id}/connect", summary="Connect integration with credentials")
async def connect_integration(
    integration_id: str,
    body: ConnectRequest,
    repo: IntegrationRepository = Depends(get_integration_repo),
    tool_svc: ToolRegistryService = Depends(get_tool_registry_service),
) -> dict[str, Any]:
    integration = await repo.get_integration(integration_id)
    if not integration:
        raise HTTPException(status_code=404, detail=f"Integration '{integration_id}' not found")

    credentials = ConnectorCredentials(
        access_token=body.access_token,
        refresh_token=body.refresh_token,
        api_key=body.api_key,
        token_type=body.token_type,
    )

    reg = get_connector_registry()
    connector = reg.get_connector(integration_id)
    if not connector:
        raise HTTPException(status_code=400, detail=f"No connector registered for '{integration_id}'")

    # Authenticate and test connection
    connected = await connector.authenticate(credentials)
    if not connected and integration["auth_type"] != "None":
        test = await connector.test_connection()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Connection failed: {test.message}",
        )

    # Save encrypted credentials
    await repo.save_credentials(integration_id, credentials)
    await repo.update_status(integration_id, IntegrationStatus.CONNECTED)

    # Sync discovered tools to database registry
    await tool_svc.sync_all_tools()

    return {
        "success": True,
        "message": f"Connected to {integration['name']} successfully",
        "status": "CONNECTED",
        "integration_id": integration_id,
    }


@router.post("/{integration_id}/disconnect", summary="Disconnect integration and revoke session")
async def disconnect_integration(
    integration_id: str,
    repo: IntegrationRepository = Depends(get_integration_repo),
) -> dict[str, Any]:
    integration = await repo.get_integration(integration_id)
    if not integration:
        raise HTTPException(status_code=404, detail=f"Integration '{integration_id}' not found")

    reg = get_connector_registry()
    connector = reg.get_connector(integration_id)
    if connector:
        await connector.revoke_credentials()

    await repo.delete_credentials(integration_id)
    await repo.update_status(integration_id, IntegrationStatus.DISCONNECTED)

    return {
        "success": True,
        "message": f"Disconnected {integration['name']}",
        "status": "DISCONNECTED",
        "integration_id": integration_id,
    }


@router.post("/{integration_id}/test", summary="Test live connection to external software")
async def test_integration_connection(
    integration_id: str,
    repo: IntegrationRepository = Depends(get_integration_repo),
) -> dict[str, Any]:
    integration = await repo.get_integration(integration_id)
    if not integration:
        raise HTTPException(status_code=404, detail=f"Integration '{integration_id}' not found")

    reg = get_connector_registry()
    connector = reg.get_connector(integration_id)
    if not connector:
        raise HTTPException(status_code=400, detail=f"No active connector for '{integration_id}'")

    # Load credentials if connector not in-memory authenticated
    if not connector._credentials:
        creds = await repo.get_credentials(integration_id)
        if creds:
            connector._credentials = creds

    test_res = await connector.test_connection()
    return {
        "success": test_res.success,
        "latency_ms": test_res.latency_ms,
        "message": test_res.message,
        "server_version": test_res.server_version,
        "protocol_version": test_res.protocol_version,
        "details": test_res.details,
    }


@router.get("/{integration_id}/tools", summary="List tools for this integration")
async def get_integration_tools(
    integration_id: str,
    tool_repo: ToolRepository = Depends(lambda: ToolRepository()),
) -> list[dict[str, Any]]:
    return await tool_repo.list_tools(integration_id=integration_id)
