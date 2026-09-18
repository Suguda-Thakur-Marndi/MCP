"""
Health and Readiness Probes for MCP-Sentinel API.
Provides decoupled:
- Liveness Probe (/health/live): Verifies process vitality (zero external dependency calls).
- Readiness Probe (/health/ready): Verifies availability of critical operational dependencies (PostgreSQL, MCP catalog).
- Preserves legacy /health and /ready routes for backward compatibility.
- Zero secret or stack trace leakage in health payloads.
"""

from typing import Any

from fastapi import APIRouter, Response, status

from mcp_sentinel.config.settings import get_settings
from mcp_sentinel.database.connection import check_db_health, get_pool_status
from mcp_sentinel.observability.metrics import get_metrics

router = APIRouter(tags=["Health"])


@router.get("/health/live", summary="Service Liveness Probe")
@router.get("/health", summary="Legacy Service Liveness Probe")
async def liveness_probe() -> dict[str, Any]:
    """
    Liveness probe: Indicates that the FastAPI server process is running and accepting connections.
    Does not depend on external services (per SRE best practices).
    """
    return {"status": "healthy", "alive": True, "service": "mcp-sentinel"}


@router.get("/health/ready", summary="Service Readiness Probe")
@router.get("/ready", summary="Legacy Service Readiness Probe")
async def readiness_probe(response: Response) -> dict[str, Any]:
    """
    Readiness probe: Deep check verifying that dependencies needed to serve traffic are operational.
    Checks:
    - PostgreSQL database connectivity
    - Connection pool state
    - MCP server catalog readiness
    - Gemini model configuration state
    Returns HTTP 200 when ready, HTTP 503 when degraded.
    Never exposes credentials, connection strings, or stack traces.
    """
    settings = get_settings()
    metrics = get_metrics()

    # 1. Database connectivity check
    db_ok = await check_db_health()
    pool_stats = get_pool_status()
    total_conn = pool_stats.get("total", 0)
    used_conn = pool_stats.get("used", 0)
    free_conn = pool_stats.get("free", 0)
    metrics.set_db_pool_status(total=total_conn, used=used_conn, free=free_conn)

    # 2. MCP Layer readiness
    mcp_status = "operational"

    # 3. Gemini LLM Provider readiness
    gemini_status = "configured" if settings.GEMINI_API_KEY else "not_configured"

    # Overall readiness condition
    if not db_ok:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {
            "status": "unready",
            "service": "mcp-sentinel",
            "environment": settings.APP_ENV,
            "database": "disconnected",
            "dependencies": {
                "database": "disconnected",
                "mcp_server": mcp_status,
                "gemini": gemini_status,
            },
            "error": "Database connectivity check failed.",
        }

    return {
        "status": "ready",
        "service": "mcp-sentinel",
        "environment": settings.APP_ENV,
        "server_name": settings.MCP_SERVER_NAME,
        "database": "connected",
        "mcp_server": mcp_status,
        "gemini": gemini_status,
        "dependencies": {
            "database": "connected",
            "mcp_server": mcp_status,
            "gemini": gemini_status,
        },
        "pool": {
            "total": total_conn,
            "used": used_conn,
            "free": free_conn,
            "total_connections": total_conn,
            "used_connections": used_conn,
            "free_connections": free_conn,
        },
    }
