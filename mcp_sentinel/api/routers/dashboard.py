"""
Dashboard API Router for MCP-Sentinel.
Aggregates live operational metrics directly from PostgreSQL.
Complies with: Zero fake statistics — all counts and summaries reflect live database state.
"""

from typing import Any

from fastapi import APIRouter, Depends

from mcp_sentinel.config.settings import get_settings
from mcp_sentinel.database.connection import get_db_pool
from mcp_sentinel.security.auth.dependencies import get_current_user
from mcp_sentinel.security.auth.models import AuthUser

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get(
    "/stats",
    summary="Get real-time operational security metrics",
)
async def get_dashboard_stats(current_user: AuthUser = Depends(get_current_user)) -> dict[str, Any]:
    """
    Returns real metrics computed from PostgreSQL.
    """
    pool = await get_db_pool()
    settings = get_settings()

    async with pool.acquire() as conn:
        customer_count = await conn.fetchval("SELECT COUNT(*) FROM customers")
        order_count = await conn.fetchval("SELECT COUNT(*) FROM orders")
        audit_count = await conn.fetchval("SELECT COUNT(*) FROM audit_events")
        pending_approvals = await conn.fetchval(
            "SELECT COUNT(*) FROM approval_requests WHERE status = 'PENDING' AND expires_at > NOW()"
        )
        completed_approvals = await conn.fetchval(
            "SELECT COUNT(*) FROM approval_requests WHERE status = 'COMPLETED'"
        )
        blocked_actions = await conn.fetchval(
            "SELECT COUNT(*) FROM audit_events WHERE decision IN ('BLOCKED', 'REJECTED', 'BLOCK', 'FAIL')"
        )

        recent_events = await conn.fetch(
            """
            SELECT id, event_type, tool_name, decision, created_at
            FROM audit_events
            ORDER BY created_at DESC
            LIMIT 5
            """
        )

    formatted_events = [
        {
            "id": r["id"],
            "event_type": r["event_type"],
            "tool_name": r["tool_name"],
            "decision": r["decision"],
            "created_at": r["created_at"].isoformat() if r["created_at"] else "",
        }
        for r in recent_events
    ]

    return {
        "status": "operational",
        "environment": settings.APP_ENV,
        "metrics": {
            "customers": customer_count,
            "orders": order_count,
            "audit_events": audit_count,
            "pending_approvals": pending_approvals,
            "completed_approvals": completed_approvals,
            "blocked_actions": blocked_actions,
        },
        "recent_security_events": formatted_events,
        "server": {
            "name": settings.MCP_SERVER_NAME,
            "version": settings.MCP_SERVER_VERSION,
            "agent_id": settings.AGENT_ID,
            "model": settings.GEMINI_MODEL,
        },
    }
