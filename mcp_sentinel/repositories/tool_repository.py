"""
Tool and Execution Repository for MCP Sentinel Multi-Software Gateway.
Manages database persistence for the tool registry, permissions, policies,
risk decisions, agent runs, and audited tool executions.
"""

from __future__ import annotations

import hashlib
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

    # -------------------------------------------------------------------------
    # Agent Runs & Tool Executions
    # -------------------------------------------------------------------------

    async def create_agent_run(
        self,
        run_id: str,
        agent_id: str,
        agent_name: str,
        model: str,
        application: str,
        tool_id: Optional[str] = None,
        user_prompt: Optional[str] = None,
        reasoning: Optional[str] = None,
        payload: Optional[dict[str, Any]] = None,
        risk_level: str = "LOW",
        risk_score: int = 0,
        approval_state: str = "NOT_REQUIRED",
    ) -> dict[str, Any]:
        pool = await self._get_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO agent_runs (
                    run_id, agent_id, agent_name, model, application,
                    tool_id, user_prompt, reasoning, payload,
                    risk_level, risk_score, approval_state, execution_state
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, 'RUNNING')
                RETURNING *
                """,
                run_id,
                agent_id,
                agent_name,
                model,
                application,
                tool_id,
                user_prompt,
                reasoning,
                json.dumps(payload or {}),
                risk_level,
                risk_score,
                approval_state,
            )
            return dict(row)

    async def update_agent_run_status(
        self,
        run_id: str,
        execution_state: str,
        duration_ms: int,
    ) -> None:
        pool = await self._get_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE agent_runs
                SET execution_state = $1, duration_ms = $2, completed_at = NOW()
                WHERE run_id = $3
                """,
                execution_state,
                duration_ms,
                run_id,
            )

    async def record_tool_execution(
        self,
        run_id: str,
        tool_id: str,
        parameters: dict[str, Any],
        status: str,
        latency_ms: int,
        result: Optional[Any] = None,
        error_message: Optional[str] = None,
        ticket_id: Optional[str] = None,
    ) -> str:
        pool = await self._get_pool()
        param_str = json.dumps(parameters, sort_keys=True)
        param_hash = hashlib.sha256(param_str.encode("utf-8")).hexdigest()

        # Sanitize result to ensure secrets are never logged
        res_json = json.dumps(result, default=str) if result is not None else None

        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO tool_executions (
                    run_id, tool_id, ticket_id, parameters, parameters_hash,
                    result, error_message, status, latency_ms
                ) VALUES ($1, $2, $3, $4::jsonb, $5, $6::jsonb, $7, $8, $9)
                RETURNING id::text
                """,
                run_id,
                tool_id,
                ticket_id,
                param_str,
                param_hash,
                res_json,
                error_message,
                status,
                latency_ms,
            )
            return row["id"]
