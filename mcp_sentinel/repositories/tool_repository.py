"""
Tool and Execution Repository for MCP Sentinel Multi-Software Gateway.
Manages database persistence for the tool registry, permissions, policies,
risk decisions, agent runs, and audited tool executions.
"""

from __future__ import annotations

import json
from typing import Any, Optional

import asyncpg

from mcp_sentinel.connectors.models import (
    DiscoveredTool,
    ToolState,
)
from mcp_sentinel.database.connection import get_db_pool


class ToolRepository:
    """
    Data access repository for tools, permissions, execution auditing,
    and security evaluation state machines.
    """

    def __init__(self, pool: Optional[asyncpg.Pool] = None) -> None:
        self._pool = pool

    async def _get_pool(self) -> asyncpg.Pool:
        if self._pool is not None and not self._pool._closed:
            return self._pool
        return await get_db_pool()

    # -------------------------------------------------------------------------
    # Tools Registry
    # -------------------------------------------------------------------------

    async def list_tools(
        self,
        integration_id: Optional[str] = None,
        risk_level: Optional[str] = None,
        enabled_only: bool = False,
    ) -> list[dict[str, Any]]:
        pool = await self._get_pool()
        query = """
            SELECT tool_id, integration_id, name, description,
                   input_schema, risk_level, required_permissions,
                   approval_required, policy_id, enabled, state,
                   last_used, created_at, updated_at
            FROM tools
            WHERE 1=1
        """
        params: list[Any] = []
        if integration_id:
            params.append(integration_id)
            query += f" AND integration_id = ${len(params)}"
        if risk_level:
            params.append(risk_level)
            query += f" AND risk_level = ${len(params)}"
        if enabled_only:
            query += " AND enabled = TRUE"
        query += " ORDER BY tool_id ASC"

        async with pool.acquire() as conn:
            rows = await conn.fetch(query, *params)
            results = []
            for r in rows:
                item = dict(r)
                if isinstance(item.get("input_schema"), str):
                    item["input_schema"] = json.loads(item["input_schema"])
                results.append(item)
            return results

    async def get_tool(self, tool_id: str) -> Optional[dict[str, Any]]:
        pool = await self._get_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT tool_id, integration_id, name, description,
                       input_schema, risk_level, required_permissions,
                       approval_required, policy_id, enabled, state,
                       last_used, created_at, updated_at
                FROM tools
                WHERE tool_id = $1
                """,
                tool_id,
            )
            if not row:
                return None
            item = dict(row)
            if isinstance(item.get("input_schema"), str):
                item["input_schema"] = json.loads(item["input_schema"])
            return item

    async def upsert_tool(self, tool: DiscoveredTool) -> dict[str, Any]:
        pool = await self._get_pool()
        async with pool.acquire() as conn:
            schema_json = json.dumps(tool.input_schema)
            row = await conn.fetchrow(
                """
                INSERT INTO tools (
                    tool_id, integration_id, name, description,
                    input_schema, risk_level, required_permissions,
                    approval_required, policy_id, enabled, state
                ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11)
                ON CONFLICT (tool_id) DO UPDATE SET
                    description = EXCLUDED.description,
                    input_schema = EXCLUDED.input_schema,
                    risk_level = EXCLUDED.risk_level,
                    approval_required = EXCLUDED.approval_required,
                    state = EXCLUDED.state,
                    updated_at = NOW()
                RETURNING *
                """,
                tool.tool_id,
                tool.integration_id,
                tool.name,
                tool.description,
                schema_json,
                tool.risk_level.value,
                tool.required_permissions,
                tool.approval_required,
                tool.policy_id,
                tool.enabled,
                tool.state.value,
            )
            item = dict(row)
            if isinstance(item.get("input_schema"), str):
                item["input_schema"] = json.loads(item["input_schema"])
            return item

    async def update_tool_state(self, tool_id: str, state: ToolState) -> None:
        pool = await self._get_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE tools
                SET state = $1, updated_at = NOW()
                WHERE tool_id = $2
                """,
                state.value,
                tool_id,
            )

    async def record_tool_usage(self, tool_id: str) -> None:
        pool = await self._get_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE tools
                SET last_used = NOW(), state = 'EXECUTED', updated_at = NOW()
                WHERE tool_id = $1
                """,
                tool_id,
            )

    # -------------------------------------------------------------------------
    # Policies
    # -------------------------------------------------------------------------

    async def list_policies(self) -> list[dict[str, Any]]:
        pool = await self._get_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT policy_id, name, version, status, scope,
                       description, risk_threshold, rules, raw_yaml,
                       created_at, updated_at
                FROM policies
                ORDER BY policy_id ASC
                """
            )
            return [dict(r) for r in rows]

    async def get_policy(self, policy_id: str) -> Optional[dict[str, Any]]:
        pool = await self._get_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT policy_id, name, version, status, scope,
                       description, risk_threshold, rules, raw_yaml,
                       created_at, updated_at
                FROM policies
                WHERE policy_id = $1
                """,
                policy_id,
            )
            return dict(row) if row else None

    # -------------------------------------------------------------------------
    # Risk Decisions
    # -------------------------------------------------------------------------

    async def record_risk_decision(
        self,
        request_id: str,
        tool_id: str,
        risk_level: str,
        risk_score: int,
        factors: dict[str, Any],
        decision: str,
        policy_id: Optional[str] = None,
    ) -> str:
        pool = await self._get_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO risk_decisions (
                    request_id, tool_id, risk_level, risk_score,
                    factors, policy_id, decision
                ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
                RETURNING id::text
                """,
                request_id,
                tool_id,
                risk_level,
                risk_score,
                json.dumps(factors),
                policy_id,
                decision,
            )
            return row["id"]
