"""
Audit API Router for MCP-Sentinel.
Provides queryable security and tool execution audit event streams from PostgreSQL.
"""

import json
from typing import Any, Optional

from fastapi import APIRouter, Depends, Query

from mcp_sentinel.database.connection import get_db_pool
from mcp_sentinel.security.auth.dependencies import require_permission
from mcp_sentinel.security.auth.models import AuthUser
from mcp_sentinel.security.auth.rbac import PERM_VIEW_AUDIT

router = APIRouter(prefix="/api/audit", tags=["Audit"])


@router.get(
    "/events",
    summary="Get paginated structured audit events",
)
async def get_audit_events(
    event_type: Optional[str] = Query(None),
    tool_name: Optional[str] = Query(None),
    decision: Optional[str] = Query(None),
    actor_id: Optional[str] = Query(None),
    request_id: Optional[str] = Query(None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: AuthUser = Depends(require_permission(PERM_VIEW_AUDIT)),
) -> dict[str, Any]:
    """Retrieves immutable security and tool audit events from PostgreSQL."""
    pool = await get_db_pool()
    conditions = []
    params = []
    idx = 1

    if event_type:
        conditions.append(f"event_type = ${idx}")
        params.append(event_type)
        idx += 1

    if tool_name:
        conditions.append(f"tool_name = ${idx}")
        params.append(tool_name)
        idx += 1

    if decision:
        conditions.append(f"decision = ${idx}")
        params.append(decision)
        idx += 1

    if actor_id:
        conditions.append(f"actor_id = ${idx}")
        params.append(actor_id)
        idx += 1

    if request_id:
        conditions.append(f"request_id = ${idx}")
        params.append(request_id)
        idx += 1

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    query = f"""
        SELECT id, event_type, actor_type, actor_id, tool_name, decision, request_id, details, created_at
        FROM audit_events
        {where_clause}
        ORDER BY created_at DESC
        LIMIT ${idx} OFFSET ${idx + 1}
    """
    params.extend([limit, offset])

    count_query = f"SELECT COUNT(*) FROM audit_events {where_clause}"
    count_params = params[: idx - 1]

    async with pool.acquire() as conn:
        rows = await conn.fetch(query, *params)
        total = await conn.fetchval(count_query, *count_params)

    records = [dict(r) for r in rows]
    for r in records:
        if r.get("created_at"):
            r["created_at"] = r["created_at"].isoformat()
        if isinstance(r.get("details"), str):
            try:
                r["details"] = json.loads(r["details"])
            except Exception:
                pass

    return {
        "status": "success",
        "total": total,
        "limit": limit,
        "offset": offset,
        "events": records,
    }


@router.get(
    "/stats",
    summary="Get aggregate audit event statistics",
)
async def get_audit_stats(
    current_user: AuthUser = Depends(require_permission(PERM_VIEW_AUDIT)),
) -> dict[str, Any]:
    """Returns aggregated audit statistics grouped by decision and event type."""
    pool = await get_db_pool()
    query = """
        SELECT decision, COUNT(*) as count
        FROM audit_events
        GROUP BY decision
    """
    async with pool.acquire() as conn:
        rows = await conn.fetch(query)

    decisions = {r["decision"]: r["count"] for r in rows}
    return {
        "status": "success",
        "by_decision": decisions,
    }
