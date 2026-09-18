"""
Security Evaluation Repository for MCP-Sentinel Phase 8.
Manages persistent evaluation runs, scenario results, and benchmark metrics in PostgreSQL.
"""

import json
from datetime import datetime, timezone
from typing import Any, Optional

import asyncpg

from mcp_sentinel.database.connection import get_db_pool
from mcp_sentinel.security.exceptions import DatabaseOperationError


class SecurityEvalRepository:
    """
    Data access repository for automated security evaluation runs and individual test results.
    """

    def __init__(self, pool: Optional[asyncpg.Pool] = None):
        self._pool = pool

    async def _get_pool(self) -> asyncpg.Pool:
        if self._pool is not None and not self._pool._closed:
            return self._pool
        return await get_db_pool()

    async def create_run(self, run_data: dict[str, Any]) -> dict[str, Any]:
        """
        Creates a new evaluation run record with initial status RUNNING.
        """
        pool = await self._get_pool()
        query = """
            INSERT INTO security_eval_runs (
                run_id, dataset_version, agent_mode, status, started_at,
                environment, metadata, report_summary
            ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)
            RETURNING *;
        """
        try:
            async with pool.acquire() as conn:
                row = await conn.fetchrow(
                    query,
                    run_data["run_id"],
                    run_data.get("dataset_version", "security-eval-v1"),
                    run_data.get("agent_mode", "secured"),
                    run_data.get("status", "RUNNING"),
                    run_data.get("started_at", datetime.now(timezone.utc)),
                    run_data.get("environment", "development"),
                    json.dumps(run_data.get("metadata", {})),
                    json.dumps(run_data.get("report_summary", {})),
                )
                return dict(row) if row else {}
        except Exception as exc:
            raise DatabaseOperationError(
                internal_details=f"create_run database error: {exc!s}",
            ) from exc

    async def complete_run(
        self,
        run_id: str,
        metrics: dict[str, Any],
        results: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """
        Finalizes an evaluation run with summary metrics and bulk-inserts individual test results.
        """
        pool = await self._get_pool()
        update_query = """
            UPDATE security_eval_runs
            SET
                status = $2,
                completed_at = $3,
                duration_seconds = $4,
                total_tests = $5,
                passed = $6,
                failed = $7,
                errors = $8,
                blocked = $9,
                skipped = $10,
                attack_attempts = $11,
                attack_successes = $12,
                gating_recall = $13,
                attack_success_rate = $14,
                pass_rate = $15,
                report_summary = $16::jsonb
            WHERE run_id = $1
            RETURNING *;
        """
        result_insert_query = """
            INSERT INTO security_eval_results (
                run_id, test_id, category, name, severity, status,
                attack_success, side_effect_detected, expected_decision, actual_decision,
                approval_required, approval_used, policy_decision, risk_score,
                duration_ms, error_type, safe_message, evidence
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18::jsonb
            );
        """
        try:
            async with pool.acquire() as conn:
                async with conn.transaction():
                    updated_row = await conn.fetchrow(
                        update_query,
                        run_id,
                        metrics.get("status", "COMPLETED"),
                        metrics.get("completed_at", datetime.now(timezone.utc)),
                        metrics.get("duration_seconds", 0.0),
                        metrics.get("total_tests", 0),
                        metrics.get("passed", 0),
                        metrics.get("failed", 0),
                        metrics.get("errors", 0),
                        metrics.get("blocked", 0),
                        metrics.get("skipped", 0),
                        metrics.get("attack_attempts", 0),
                        metrics.get("attack_successes", 0),
                        metrics.get("gating_recall", 0.0),
                        metrics.get("attack_success_rate", 0.0),
                        metrics.get("pass_rate", 0.0),
                        json.dumps(metrics.get("report_summary", {})),
                    )

                    if results:
                        records = [
                            (
                                run_id,
                                r.get("test_id", ""),
                                r.get("category", ""),
                                r.get("name", ""),
                                r.get("severity", "MEDIUM"),
                                r.get("status", "PASS"),
                                r.get("attack_success", False),
                                r.get("side_effect_detected", False),
                                r.get("expected_decision", ""),
                                r.get("actual_decision", ""),
                                r.get("approval_required", False),
                                r.get("approval_used", False),
                                r.get("policy_decision"),
                                r.get("risk_score"),
                                r.get("duration_ms", 0.0),
                                r.get("error_type"),
                                r.get("safe_message"),
                                json.dumps(r.get("evidence", {})),
                            )
                            for r in results
                        ]
                        await conn.executemany(result_insert_query, records)

                    return dict(updated_row) if updated_row else {}
        except Exception as exc:
            raise DatabaseOperationError(
                internal_details=f"complete_run database error: {exc!s}",
            ) from exc

    async def get_run(self, run_id: str) -> Optional[dict[str, Any]]:
        """
        Fetches an evaluation run by run_id.
        """
        pool = await self._get_pool()
        try:
            async with pool.acquire() as conn:
                row = await conn.fetchrow(
                    "SELECT * FROM security_eval_runs WHERE run_id = $1", run_id
                )
                if not row:
                    return None
                data = dict(row)
                if isinstance(data.get("metadata"), str):
                    data["metadata"] = json.loads(data["metadata"])
                if isinstance(data.get("report_summary"), str):
                    data["report_summary"] = json.loads(data["report_summary"])
                return data
        except Exception as exc:
            raise DatabaseOperationError(
                internal_details=f"get_run error: {exc!s}",
            ) from exc

    async def list_runs(
        self,
        agent_mode: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        """
        Lists evaluation runs ordered by recency.
        """
        pool = await self._get_pool()
        query = """
            SELECT * FROM security_eval_runs
            WHERE ($1::varchar IS NULL OR agent_mode = $1)
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3;
        """
        try:
            async with pool.acquire() as conn:
                rows = await conn.fetch(query, agent_mode, limit, offset)
                output = []
                for r in rows:
                    item = dict(r)
                    if isinstance(item.get("metadata"), str):
                        item["metadata"] = json.loads(item["metadata"])
                    if isinstance(item.get("report_summary"), str):
                        item["report_summary"] = json.loads(item["report_summary"])
                    output.append(item)
                return output
        except Exception as exc:
            raise DatabaseOperationError(
                internal_details=f"list_runs error: {exc!s}",
            ) from exc

    async def get_results(
        self,
        run_id: str,
        category: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        """
        Retrieves granular test results for a given run with optional filtering.
        """
        pool = await self._get_pool()
        query = """
            SELECT * FROM security_eval_results
            WHERE run_id = $1
              AND ($2::varchar IS NULL OR category = $2)
              AND ($3::varchar IS NULL OR status = $3)
            ORDER BY created_at ASC
            LIMIT $4 OFFSET $5;
        """
        try:
            async with pool.acquire() as conn:
                rows = await conn.fetch(query, run_id, category, status, limit, offset)
                output = []
                for r in rows:
                    item = dict(r)
                    if isinstance(item.get("evidence"), str):
                        item["evidence"] = json.loads(item["evidence"])
                    output.append(item)
                return output
        except Exception as exc:
            raise DatabaseOperationError(
                internal_details=f"get_results error: {exc!s}",
            ) from exc

    async def get_latest_run_by_mode(self, agent_mode: str) -> Optional[dict[str, Any]]:
        """
        Gets the latest completed run for a given agent mode (e.g. 'secured' or 'baseline').
        """
        pool = await self._get_pool()
        query = """
            SELECT * FROM security_eval_runs
            WHERE agent_mode = $1 AND status = 'COMPLETED'
            ORDER BY created_at DESC
            LIMIT 1;
        """
        try:
            async with pool.acquire() as conn:
                row = await conn.fetchrow(query, agent_mode)
                if not row:
                    return None
                data = dict(row)
                if isinstance(data.get("metadata"), str):
                    data["metadata"] = json.loads(data["metadata"])
                if isinstance(data.get("report_summary"), str):
                    data["report_summary"] = json.loads(data["report_summary"])
                return data
        except Exception as exc:
            raise DatabaseOperationError(
                internal_details=f"get_latest_run_by_mode error: {exc!s}",
            ) from exc
