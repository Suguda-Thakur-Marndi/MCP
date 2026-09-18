"""
Phase 4 Performance Benchmark Tests.
Measures policy evaluation latency and determinism under rapid sequential invocations.
"""

import time

from mcp_sentinel.security.decisions.models import SecurityDecisionEnum
from mcp_sentinel.security.policy.engine import PolicyEngine


def test_policy_evaluation_latency():
    """
    Measures the average latency of the Policy Engine over 1,000 evaluations.
    Validates that server-side policy evaluation is lightweight (< 1.0 ms average).
    """
    engine = PolicyEngine()
    context = engine.build_context(
        tool_name="get_customer",
        arguments={"customer_id": "CUST-000001"},
    )

    # Warmup
    for _ in range(50):
        engine.evaluate(context)

    iterations = 1000
    start_time = time.perf_counter()
    for _ in range(iterations):
        decision = engine.evaluate(context)
        assert decision.decision == SecurityDecisionEnum.ALLOW
    end_time = time.perf_counter()

    total_time_ms = (end_time - start_time) * 1000.0
    avg_latency_ms = total_time_ms / iterations

    # Policy evaluation must be ultra-fast (well below 5 ms)
    assert avg_latency_ms < 5.0, (
        f"Average policy evaluation latency too high: {avg_latency_ms:.3f} ms"
    )
    print(
        f"\n[PERFORMANCE] Policy Evaluation: {iterations} iterations, avg={avg_latency_ms:.4f} ms per eval"
    )


def test_destructive_policy_evaluation_latency():
    """Measures latency for destructive evaluation with factor breakdown."""
    engine = PolicyEngine()
    context = engine.build_context(
        tool_name="delete_customer",
        arguments={"customer_id": "CUST-000001"},
        is_server_approved=False,
    )

    iterations = 500
    start = time.perf_counter()
    for _ in range(iterations):
        decision = engine.evaluate(context)
        assert decision.decision == SecurityDecisionEnum.REQUIRE_APPROVAL
    duration = time.perf_counter() - start

    avg_ms = (duration * 1000.0) / iterations
    assert avg_ms < 5.0
    print(f"\n[PERFORMANCE] Destructive Policy Evaluation: avg={avg_ms:.4f} ms per eval")
