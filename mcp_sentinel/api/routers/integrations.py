"""
Integrations API Router for SentinelCore.
Exposes endpoints to inspect, test, and manage the two permitted enterprise data integrations:
1. Notion (Official REST API)
2. Supabase (PostgreSQL Database Pool)
"""

from __future__ import annotations

import asyncio
import logging
import time
import urllib.parse
from typing import Any, Optional

import asyncpg
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field

from mcp_sentinel.config.settings import get_settings
from mcp_sentinel.connectors.models import (
    ConnectorCredentials,
    IntegrationStatus,
    RiskLevel,
)
from mcp_sentinel.connectors.registry import get_connector_registry
from mcp_sentinel.connectors.vault import CredentialVault
from mcp_sentinel.repositories.integration_repository import IntegrationRepository
from mcp_sentinel.repositories.tool_repository import ToolRepository
from mcp_sentinel.security.audit_logger import log_security_event
from mcp_sentinel.security.auth.dependencies import require_permission
from mcp_sentinel.security.auth.models import AuthUser
from mcp_sentinel.security.auth.oidc import generate_oauth_state, verify_oauth_state
from mcp_sentinel.security.auth.rbac import (
    PERM_MANAGE_INTEGRATIONS,
    PERM_VIEW_INTEGRATIONS,
    PERM_VIEW_TOOLS,
)
from mcp_sentinel.services.tool_registry_service import ToolRegistryService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/integrations", tags=["Integrations"])

ALLOWED_INTEGRATIONS: set[str] = {"notion", "supabase"}

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
    """Payload to connect an integration with credentials or configuration."""

    # Notion / API token authentication
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    api_key: Optional[str] = None
    token_type: str = "Bearer"

    # Supabase / PostgreSQL structured connection details
    connection_string: Optional[str] = None
    host: Optional[str] = None
    port: Optional[int] = Field(default=5432, ge=1, le=65535)
    database: Optional[str] = "postgres"
    username: Optional[str] = "postgres"
    password: Optional[str] = None
    ssl_mode: Optional[str] = "require"


@router.get("", summary="List all supported integrations (Notion and Supabase)")
async def list_integrations(
    repo: IntegrationRepository = Depends(get_integration_repo),
    current_user: AuthUser = Depends(require_permission(PERM_VIEW_INTEGRATIONS)),
) -> list[dict[str, Any]]:
    """Returns the two authorized enterprise data integrations: Notion and Supabase."""
    reg = get_connector_registry()
    settings = get_settings()
    results: list[dict[str, Any]] = []

    for cid in ("notion", "supabase"):
        connector = reg.get_connector(cid)
        if not connector:
            continue

        creds: Optional[ConnectorCredentials] = None
        try:
            creds = await repo.get_credentials(cid)
        except Exception:
            pass
        if not creds and connector._credentials:
            creds = connector._credentials

        is_configured = (
            bool(creds and (creds.access_token or creds.api_key)) if cid == "notion" else True
        )
        is_connected = connector.is_connected

        write_enabled = (
            connector.is_write_enabled() if hasattr(connector, "is_write_enabled") else False
        )

        desc = (
            "Official Notion REST API connector for workspace page search, database querying, and document archival."
            if cid == "notion"
            else "Enterprise Supabase PostgreSQL database connection pool for customer, order, and audit persistence."
        )

        category = "Workspace & Knowledge" if cid == "notion" else "Database & Storage"
        logo = "📑" if cid == "notion" else "🗄️"

        workspace_info = (
            connector.get_workspace_info() if hasattr(connector, "get_workspace_info") else None
        )
        project_info = (
            connector.get_project_info() if hasattr(connector, "get_project_info") else None
        )
        oauth_configured = (
            bool(settings.NOTION_CLIENT_ID and settings.NOTION_CLIENT_SECRET)
            if cid == "notion"
            else False
        )

        last_test: Optional[dict[str, Any]] = None
        if hasattr(connector, "_last_test_result") and connector._last_test_result:
            ltr = connector._last_test_result
            last_test = {
                "success": ltr.success,
                "latency_ms": ltr.latency_ms,
                "message": ltr.message,
                "server_version": ltr.server_version,
                "details": ltr.details,
            }

        results.append(
            {
                "id": cid,
                "name": connector.name,
                "category": category,
                "logo": logo,
                "status": connector.status.value,
                "live_status": connector.status.value,
                "is_connected": is_connected,
                "is_configured": is_configured,
                "credential_status": "CONFIGURED" if is_configured else "MISSING",
                "auth_type": connector.auth_type.value,
                "connection_endpoint": connector.endpoint,
                "protocol_type": connector.protocol_type.value,
                "description": desc,
                "is_enabled": True,
                "write_enabled": write_enabled,
                "tools_count": 4 if cid == "notion" else 8,
                "oauth_configured": oauth_configured,
                "workspace_info": workspace_info,
                "project_info": project_info,
                "last_test_result": last_test,
            }
        )

    return results


@router.get("/notion/oauth/authorize", summary="Initiate Notion OAuth 2.0 authorization")
async def notion_oauth_authorize(
    current_user: AuthUser = Depends(require_permission(PERM_MANAGE_INTEGRATIONS)),
) -> dict[str, str]:
    """Generates signed authorization URL for user-authorized Notion OAuth 2.0 connection."""
    settings = get_settings()
    if not settings.NOTION_CLIENT_ID or not settings.NOTION_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Notion OAuth 2.0 is not configured on this Sentinel instance. "
                "Configure NOTION_CLIENT_ID and NOTION_CLIENT_SECRET in .env, "
                "or use the Administrator Integration Token option."
            ),
        )

    state = generate_oauth_state(redirect_uri="/integrations")
    auth_params = {
        "client_id": settings.NOTION_CLIENT_ID,
        "response_type": "code",
        "owner": "user",
        "redirect_uri": settings.NOTION_REDIRECT_URI,
        "state": state,
    }
    auth_url = f"https://api.notion.com/v1/oauth/authorize?{urllib.parse.urlencode(auth_params)}"
    return {"authorization_url": auth_url, "state": state}


@router.get("/notion/oauth/callback", summary="Notion OAuth 2.0 redirect callback")
async def notion_oauth_callback(
    code: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
    repo: IntegrationRepository = Depends(get_integration_repo),
    tool_svc: ToolRegistryService = Depends(get_tool_registry_service),
) -> RedirectResponse:
    """Handles OAuth 2.0 code exchange and workspace credential provisioning for Notion."""
    settings = get_settings()
    frontend_url = settings.FRONTEND_URL.rstrip("/")

    if error:
        logger.warning("Notion OAuth error received: %s", error)
        log_security_event(
            event_type="INTEGRATION_AUTH_FAILED",
            action="notion_oauth_callback",
            decision="DENY",
            details={"integration": "notion", "error": error},
        )
        return RedirectResponse(
            url=f"{frontend_url}/integrations?error={urllib.parse.quote(error)}",
            status_code=status.HTTP_302_FOUND,
        )

    if not state:
        return RedirectResponse(
            url=f"{frontend_url}/integrations?error=invalid_state",
            status_code=status.HTTP_302_FOUND,
        )

    try:
        verify_oauth_state(state)
    except Exception:
        return RedirectResponse(
            url=f"{frontend_url}/integrations?error=invalid_state",
            status_code=status.HTTP_302_FOUND,
        )

    if not code:
        return RedirectResponse(
            url=f"{frontend_url}/integrations?error=missing_code",
            status_code=status.HTTP_302_FOUND,
        )

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            token_resp = await client.post(
                "https://api.notion.com/v1/oauth/token",
                auth=(settings.NOTION_CLIENT_ID or "", settings.NOTION_CLIENT_SECRET or ""),
                json={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": settings.NOTION_REDIRECT_URI,
                },
            )

        if token_resp.status_code != 200:
            logger.error("Notion token exchange failed: %s", token_resp.text)
            return RedirectResponse(
                url=f"{frontend_url}/integrations?error=token_exchange_failed",
                status_code=status.HTTP_302_FOUND,
            )

        token_data = token_resp.json()
        access_token = token_data.get("access_token")
        workspace_name = token_data.get("workspace_name", "Authorized Workspace")
        bot_id = token_data.get("bot_id")
        workspace_id = token_data.get("workspace_id")

        if not access_token:
            return RedirectResponse(
                url=f"{frontend_url}/integrations?error=no_access_token",
                status_code=status.HTTP_302_FOUND,
            )

        credentials = ConnectorCredentials(
            access_token=access_token,
            token_type="Bearer",
        )

        reg = get_connector_registry()
        connector = reg.get_connector("notion")
        if connector:
            await connector.authenticate(credentials)
            if hasattr(connector, "_workspace_info"):
                connector._workspace_info = {
                    "workspace_name": workspace_name,
                    "bot_id": bot_id,
                    "workspace_id": workspace_id,
                    "api_version": getattr(connector, "NOTION_VERSION", "2022-06-28"),
                }

        await repo.save_credentials("notion", credentials)
        await repo.update_status("notion", IntegrationStatus.CONNECTED)
        await tool_svc.sync_all_tools()

        log_security_event(
            event_type="INTEGRATION_CONNECTED",
            tool_name="notion.oauth",
            action="oauth_connect",
            decision="PERMIT",
            details={
                "integration_id": "notion",
                "workspace_name": workspace_name,
                "bot_id": bot_id,
                "auth_method": "oauth2",
            },
        )

        return RedirectResponse(
            url=f"{frontend_url}/integrations?connected=notion&workspace={urllib.parse.quote(workspace_name)}",
            status_code=status.HTTP_302_FOUND,
        )
    except Exception as exc:
        logger.exception("Error in Notion OAuth callback: %s", exc)
        return RedirectResponse(
            url=f"{frontend_url}/integrations?error=internal_error",
            status_code=status.HTTP_302_FOUND,
        )


@router.get("/{integration_id}", summary="Get integration details")
async def get_integration(
    integration_id: str,
    repo: IntegrationRepository = Depends(get_integration_repo),
    current_user: AuthUser = Depends(require_permission(PERM_VIEW_INTEGRATIONS)),
) -> dict[str, Any]:
    """Retrieves authoritative configuration and live telemetry for Notion or Supabase."""
    if integration_id not in ALLOWED_INTEGRATIONS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Integration '{integration_id}' is not in the active Sentinel scope. Permitted integrations: {sorted(ALLOWED_INTEGRATIONS)}",
        )

    reg = get_connector_registry()
    connector = reg.get_connector(integration_id)
    if not connector:
        raise HTTPException(status_code=404, detail=f"Connector '{integration_id}' not found")

    settings = get_settings()
    creds: Optional[ConnectorCredentials] = None
    try:
        creds = await repo.get_credentials(integration_id)
    except Exception:
        pass
    if not creds and connector._credentials:
        creds = connector._credentials

    is_configured = (
        bool(creds and (creds.access_token or creds.api_key))
        if integration_id == "notion"
        else True
    )
    category = "Workspace & Knowledge" if integration_id == "notion" else "Database & Storage"
    logo = "📑" if integration_id == "notion" else "🗄️"

    raw_token = (creds.access_token or creds.api_key) if creds else None
    masked_token = CredentialVault.mask_secret(raw_token) if raw_token else None

    workspace_info = (
        connector.get_workspace_info() if hasattr(connector, "get_workspace_info") else None
    )
    project_info = connector.get_project_info() if hasattr(connector, "get_project_info") else None
    oauth_configured = (
        bool(settings.NOTION_CLIENT_ID and settings.NOTION_CLIENT_SECRET)
        if integration_id == "notion"
        else False
    )

    last_test: Optional[dict[str, Any]] = None
    if hasattr(connector, "_last_test_result") and connector._last_test_result:
        ltr = connector._last_test_result
        last_test = {
            "success": ltr.success,
            "latency_ms": ltr.latency_ms,
            "message": ltr.message,
            "server_version": ltr.server_version,
            "details": ltr.details,
        }

    return {
        "id": connector.integration_id,
        "name": connector.name,
        "category": category,
        "logo": logo,
        "status": connector.status.value,
        "live_status": connector.status.value,
        "is_connected": connector.is_connected,
        "is_configured": is_configured,
        "is_authenticated": is_configured,
        "credential_status": "CONFIGURED" if is_configured else "MISSING",
        "auth_type": connector.auth_type.value,
        "connection_endpoint": connector.endpoint,
        "protocol_type": connector.protocol_type.value,
        "description": (
            "Official Notion REST API connector for workspace page search, database querying, and document archival."
            if integration_id == "notion"
            else "Enterprise Supabase PostgreSQL database connection pool for customer, order, and audit persistence."
        ),
        "is_enabled": True,
        "write_enabled": connector.is_write_enabled()
        if hasattr(connector, "is_write_enabled")
        else False,
        "masked_token": masked_token,
        "token_type": creds.token_type if creds else "Bearer",
        "tools_count": 4 if integration_id == "notion" else 8,
        "oauth_configured": oauth_configured,
        "workspace_info": workspace_info,
        "project_info": project_info,
        "last_test_result": last_test,
    }


@router.post("/{integration_id}/connect", summary="Connect integration with credentials")
async def connect_integration(
    integration_id: str,
    body: ConnectRequest,
    repo: IntegrationRepository = Depends(get_integration_repo),
    tool_svc: ToolRegistryService = Depends(get_tool_registry_service),
    current_user: AuthUser = Depends(require_permission(PERM_MANAGE_INTEGRATIONS)),
) -> dict[str, Any]:
    """Authenticates Notion or connects/validates Supabase configuration."""
    if integration_id not in ALLOWED_INTEGRATIONS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Integration '{integration_id}' is not supported.",
        )

    reg = get_connector_registry()
    connector = reg.get_connector(integration_id)
    if not connector:
        raise HTTPException(
            status_code=400, detail=f"No connector registered for '{integration_id}'"
        )

    if integration_id == "notion":
        token = body.api_key or body.access_token
        if not token or not token.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Notion integration requires an API key or access token.",
            )

        credentials = ConnectorCredentials(
            api_key=token.strip(),
            access_token=token.strip(),
            token_type=body.token_type,
        )

        await connector.authenticate(credentials)
        test_res = await connector.test_connection()
        if not test_res.success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Notion connection probe failed: {test_res.message}",
            )

        try:
            await repo.save_credentials(integration_id, credentials)
            await repo.update_status(integration_id, IntegrationStatus.CONNECTED)
            await tool_svc.sync_all_tools()
        except Exception as exc:
            logger.warning("Could not persist Notion credentials: %s", exc)

        log_security_event(
            event_type="INTEGRATION_CONNECTED",
            tool_name="notion.connect",
            action="connect",
            decision="PERMIT",
            details={
                "integration_id": "notion",
                "workspace_name": test_res.details.get("workspace_name"),
                "bot_name": test_res.details.get("bot_name"),
                "auth_method": "integration_token",
            },
        )

        return {
            "success": True,
            "message": f"Connected to Notion successfully ({test_res.details.get('workspace_name', 'Workspace')})",
            "status": "CONNECTED",
            "integration_id": "notion",
            "latency_ms": test_res.latency_ms,
            "details": test_res.details,
        }

    elif integration_id == "supabase":
        dsn = None
        if body.connection_string and body.connection_string.strip():
            dsn = body.connection_string.strip()
        elif body.host and body.username and body.password:
            port = body.port or 5432
            database = body.database or "postgres"
            ssl_mode = body.ssl_mode or "require"
            user_enc = urllib.parse.quote(body.username, safe="")
            pass_enc = urllib.parse.quote(body.password, safe="")
            dsn = f"postgresql://{user_enc}:{pass_enc}@{body.host}:{port}/{database}?sslmode={ssl_mode}"
        else:
            settings = get_settings()
            dsn = settings.SUPABASE_DATABASE_URL or settings.DATABASE_URL

        if not dsn:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Supabase connection requires either connection_string or host, username, and password.",
            )

        parsed = urllib.parse.urlparse(dsn)
        if parsed.scheme not in ("postgresql", "postgres"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid database connection scheme. Must be postgresql://",
            )

        sanitized_host = parsed.hostname or "localhost"
        sanitized_port = parsed.port or 5432
        sanitized_db = parsed.path.lstrip("/") or "postgres"
        sanitized_user = parsed.username or "postgres"

        t0 = time.perf_counter()
        version = "PostgreSQL (Supabase)"
        try:
            test_conn = await asyncio.wait_for(
                asyncpg.connect(dsn, timeout=5.0),
                timeout=6.0,
            )
            try:
                version = await test_conn.fetchval("SELECT version()")
                latency = int((time.perf_counter() - t0) * 1000)
            finally:
                await test_conn.close()
        except asyncio.TimeoutError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Connection timed out reaching Supabase PostgreSQL at {sanitized_host}:{sanitized_port}. Note: Some local networks filter outbound port 5432; verify port 6543 pooler mode.",
            )
        except asyncpg.InvalidPasswordError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Authentication failed: Invalid database password for user '{sanitized_user}'.",
            )
        except Exception as exc:
            clean_err = str(exc)
            if body.password and body.password in clean_err:
                clean_err = clean_err.replace(body.password, "***")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Supabase PostgreSQL probe failed: {clean_err}",
            )

        credentials = ConnectorCredentials(
            api_key=dsn,
            access_token=dsn,
            token_type="PostgreSQL DSN",
        )

        await connector.authenticate(credentials)

        try:
            await repo.save_credentials("supabase", credentials)
            await repo.update_status("supabase", IntegrationStatus.CONNECTED)
            await tool_svc.sync_all_tools()
        except Exception as exc:
            logger.warning("Could not persist Supabase credentials: %s", exc)

        log_security_event(
            event_type="INTEGRATION_CONNECTED",
            tool_name="supabase.connect",
            action="connect",
            decision="PERMIT",
            details={
                "integration_id": "supabase",
                "host": sanitized_host,
                "port": sanitized_port,
                "database": sanitized_db,
                "auth_method": "postgres_pool",
            },
        )

        return {
            "success": True,
            "message": f"Connected to Supabase PostgreSQL at {sanitized_host}:{sanitized_port} successfully",
            "status": "CONNECTED",
            "integration_id": "supabase",
            "latency_ms": latency,
            "details": {
                "host": sanitized_host,
                "port": sanitized_port,
                "database": sanitized_db,
                "server_version": str(version),
                "tls_enforced": True,
            },
        }

    raise HTTPException(status_code=400, detail=f"Unsupported integration '{integration_id}'")


@router.post("/{integration_id}/disconnect", summary="Disconnect integration")
async def disconnect_integration(
    integration_id: str,
    repo: IntegrationRepository = Depends(get_integration_repo),
    current_user: AuthUser = Depends(require_permission(PERM_MANAGE_INTEGRATIONS)),
) -> dict[str, Any]:
    """Disconnects Notion or resets connection state."""
    if integration_id not in ALLOWED_INTEGRATIONS:
        raise HTTPException(status_code=404, detail="Integration not found")

    reg = get_connector_registry()
    connector = reg.get_connector(integration_id)
    name = connector.name if connector else integration_id

    if connector:
        await connector.revoke_credentials()

    try:
        await repo.delete_credentials(integration_id)
        await repo.update_status(integration_id, IntegrationStatus.DISCONNECTED)
    except Exception as exc:
        logger.warning("Could not persist disconnect state to database: %s", exc)

    log_security_event(
        event_type="INTEGRATION_DISCONNECTED",
        tool_name=f"{integration_id}.disconnect",
        action="disconnect",
        decision="PERMIT",
        details={"integration_id": integration_id},
    )

    return {
        "success": True,
        "message": f"Disconnected {name}",
        "status": "DISCONNECTED",
        "integration_id": integration_id,
    }


@router.post("/{integration_id}/test", summary="Test live connection to Notion or Supabase")
async def test_integration_connection(
    integration_id: str,
    repo: IntegrationRepository = Depends(get_integration_repo),
    current_user: AuthUser = Depends(require_permission(PERM_MANAGE_INTEGRATIONS)),
) -> dict[str, Any]:
    """Runs a real live probe against Notion API or Supabase database pool."""
    if integration_id not in ALLOWED_INTEGRATIONS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Integration '{integration_id}' is not in the active scope. Permitted: {sorted(ALLOWED_INTEGRATIONS)}",
        )

    reg = get_connector_registry()
    connector = reg.get_connector(integration_id)
    if not connector:
        raise HTTPException(status_code=400, detail=f"No active connector for '{integration_id}'")

    if not connector._credentials:
        try:
            creds = await repo.get_credentials(integration_id)
            if creds:
                connector._credentials = creds
        except Exception:
            pass

    test_res = await connector.test_connection()

    try:
        new_status = IntegrationStatus.CONNECTED if test_res.success else IntegrationStatus.ERROR
        await repo.update_status(integration_id, new_status)
    except Exception:
        pass

    log_security_event(
        event_type="INTEGRATION_TESTED",
        tool_name=f"{integration_id}.test_connection",
        action="test_connection",
        decision="PERMIT" if test_res.success else "ERROR",
        details={
            "integration_id": integration_id,
            "success": test_res.success,
            "latency_ms": test_res.latency_ms,
        },
    )

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
    current_user: AuthUser = Depends(require_permission(PERM_VIEW_TOOLS)),
) -> list[dict[str, Any]]:
    """Returns the registered tools for Notion (4 tools) or Supabase (8 tools)."""
    if integration_id not in ALLOWED_INTEGRATIONS:
        raise HTTPException(status_code=404, detail="Integration not found")

    reg = get_connector_registry()
    connector = reg.get_connector(integration_id)
    if connector:
        tools = await connector.list_tools()
        return [
            {
                "id": t.tool_id,
                "tool_id": t.tool_id,
                "name": t.name,
                "tool_name": t.name,
                "integration_id": t.integration_id,
                "description": t.description,
                "input_schema": t.input_schema,
                "parameters": t.input_schema,
                "risk_level": t.risk_level.value,
                "base_risk": t.risk_level.value,
                "requires_approval": t.approval_required,
                "approval_required": t.approval_required,
                "enabled": t.enabled,
                "state": t.state.value,
                "is_destructive": t.risk_level in (RiskLevel.HIGH, RiskLevel.CRITICAL),
                "read_only": t.risk_level == RiskLevel.LOW,
            }
            for t in tools
        ]
    return []
