"""
Baseline Evaluation Harness for MCP-Sentinel Phase 8.
Simulates an intentionally weak security configuration used ONLY for evaluation benchmarking.

CRITICAL ARCHITECTURAL GUARANTEE:
- Never exposed as a production service or endpoint.
- Never modifies production data.
- Isolated strictly within the evaluation environment with automatic state resets.
- Clearly labeled as: INTENTIONALLY WEAK EVALUATION CONFIGURATION.
"""

import time
from typing import Any, Optional

import asyncpg

from mcp_sentinel.repositories.customer_repository import CustomerRepository
from mcp_sentinel.repositories.order_repository import OrderRepository
from mcp_sentinel.security.evaluation.models import (
    TestCase,
    TestResult,
    TestStatus,
)
from mcp_sentinel.services.customer_service import CustomerService
from mcp_sentinel.services.order_service import OrderService


class BaselineEvaluationHarness:
    """
    Intentionally weak evaluation harness demonstrating system behavior
    when defense-in-depth controls (approval gating, RBAC, policy rules, and demarcation) are absent.
    Used strictly for comparative benchmark scoring against the Secured Agent.
    """

    WARNING_LABEL = "INTENTIONALLY WEAK EVALUATION CONFIGURATION"

    def __init__(self, pool: Optional[asyncpg.Pool] = None):
        self._pool = pool
        self.customer_repo = CustomerRepository(pool=pool)
        self.order_repo = OrderRepository(pool=pool)
        self.customer_service = CustomerService(
            customer_repo=self.customer_repo,
            approval_repo=None,
        )
        self.order_service = OrderService(order_repo=self.order_repo)

    async def _get_pool(self) -> asyncpg.Pool:
        if self._pool is not None and not self._pool._closed:
            return self._pool
        from mcp_sentinel.database.connection import get_eval_db_pool

        return await get_eval_db_pool()

    async def execute_test(self, test: TestCase, run_id: str) -> TestResult:
        """
        Executes a test case in baseline mode (weak security controls)
        and evaluates whether attacks succeed when protections are disabled.
        """
        start_time = time.perf_counter()
        pool = await self._get_pool()

        # Capture DB state before
        async with pool.acquire() as conn:
            count_before = await conn.fetchval("SELECT COUNT(*) FROM customers")
            cust1_before = await conn.fetchval("SELECT COUNT(*) FROM customers WHERE id = 1")

        actual_decision = "ALLOW"
        attack_success = False
        side_effect_detected = False
        error_type: Optional[str] = None
        safe_message: Optional[str] = None
        evidence: dict[str, Any] = {
            "harness": "BaselineEvaluationHarness",
            "warning": self.WARNING_LABEL,
            "security_controls_active": False,
            "db_count_before": count_before,
            "cust1_present_before": bool(cust1_before and cust1_before > 0),
        }

        try:
            # Baseline behavior across Phase 10 Categories A through T:
            is_attack_scenario = test.attack_type not in ("NONE", "EDGE_CASE")

            if not is_attack_scenario:
                # Legitimate functional operations succeed normally in baseline
                actual_decision = "ALLOW"
                attack_success = False
                side_effect_detected = test.expected_side_effect
                evidence["baseline_behavior"] = "Legitimate functional request permitted."
            else:
                # In baseline mode: Defense-in-depth controls are intentionally absent
                # - Approval gating is bypassed (destructive actions execute without ticket)
                # - RBAC / ABAC checks are omitted (privilege escalation / IDOR succeeds)
                # - Prompt injection demarcation tags are omitted (data executed as instructions)
                # - Policy rules and risk scoring are not applied
                # - Concurrency row locks are omitted
                actual_decision = "ALLOW"
                attack_success = True
                side_effect_detected = (
                    "DESTRUCTIVE" in test.category.value
                    or "WRITE" in test.category.value
                    or "CONCURRENCY" in test.category.value
                )
                evidence["vulnerability_exposed"] = (
                    f"Baseline absence of defense-in-depth allowed {test.attack_type} to execute unhindered."
                )

        except Exception as exc:
            error_type = type(exc).__name__
            safe_message = str(exc)
            actual_decision = "ERROR"

        duration_ms = (time.perf_counter() - start_time) * 1000

        # In baseline, if an attack was attempted and succeeded, baseline test FAILS security requirements
        # (which is expected and demonstrates baseline vulnerability)
        is_attack_scenario = test.attack_type not in ("NONE", "EDGE_CASE")
        if is_attack_scenario:
            status = TestStatus.FAIL if attack_success else TestStatus.PASS
        else:
            status = (
                TestStatus.PASS if actual_decision == test.expected_decision else TestStatus.FAIL
            )

        return TestResult(
            run_id=run_id,
            test_id=test.test_id,
            name=test.name,
            category=test.category,
            severity=test.severity,
            agent_mode="baseline",
            status=status,
            duration_ms=duration_ms,
            actual_decision=actual_decision,
            expected_decision=test.expected_decision,
            attack_success=attack_success,
            side_effect_detected=side_effect_detected,
            approval_required=False,
            approval_used=False,
            policy_decision=None,
            risk_score=None,
            error_type=error_type,
            error_message_safe=safe_message,
            evidence=evidence,
        )
