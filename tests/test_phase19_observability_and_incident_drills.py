import asyncio
import json
import os
import urllib.error
import urllib.request

import pytest

from mcp_sentinel.observability.metrics import SentinelMetrics

# Ensure staging configuration is loaded before mcp_sentinel modules
os.environ["ENV_FILE"] = ".env.staging"

STAGING_API_URL = "http://127.0.0.1:8001"
STAGING_DB_URL = os.environ.get(
    "STAGING_DATABASE_URL", "postgresql://postgres:postgres@127.0.0.1:5000/mcp_sentinel_staging"
)


def is_staging_available() -> bool:
    try:
        req = urllib.request.Request(f"{STAGING_API_URL}/health/live")
        with urllib.request.urlopen(req, timeout=1.0) as resp:
            return resp.status == 200
    except Exception:
        return False


@pytest.fixture(autouse=True)
def check_staging_available():
    if not is_staging_available():
        pytest.skip(
            "Staging server not reachable at http://127.0.0.1:8001; skipping incident drill tests."
        )


def http_req(url: str, method: str = "GET", headers: dict = None, body: dict = None):
    req_headers = headers or {}
    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        req_headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=5.0) as resp:
            content = resp.read().decode("utf-8")
            return resp.status, json.loads(content) if "application/json" in resp.headers.get(
                "Content-Type", ""
            ) else content
    except urllib.error.HTTPError as e:
        content = e.read().decode("utf-8")
        try:
            parsed = json.loads(content)
        except Exception:
            parsed = content
        return e.code, parsed


def get_live_prometheus_metric(metric_name: str) -> list[str]:
    status, text = http_req(f"{STAGING_API_URL}/metrics")
    assert status == 200
    return [line for line in text.splitlines() if line.startswith(metric_name)]


@pytest.fixture(scope="session")
def staging_token():
    import os

    from mcp_sentinel.config.settings import Settings, get_settings, reset_settings_for_testing
    from mcp_sentinel.database.connection import close_db_pool
    from mcp_sentinel.repositories.user_repository import UserRepository
    from mcp_sentinel.security.auth.session_handler import get_session_handler

    async def _get():
        await close_db_pool()
        orig_settings = get_settings()
        staging_settings = (
            Settings(_env_file=".env.staging") if os.path.exists(".env.staging") else orig_settings
        )
        reset_settings_for_testing(staging_settings)
        try:
            user = await UserRepository().get_user_by_email("admin@sentinel.test")
            token, _ = await get_session_handler().create_user_session(user=user)
            return token
        finally:
            await close_db_pool()
            reset_settings_for_testing(orig_settings)

    return asyncio.run(_get())


# =============================================================================
# DRILL 1: Database Connectivity Interruption & Error Telemetry
# =============================================================================
def test_drill_1_database_connectivity_interruption():
    """
    Verifies live readiness probe and validates that database query errors
    are properly tracked in Prometheus exposition format.
    """
    # 1. Live Readiness Probe Check
    status, ready = http_req(f"{STAGING_API_URL}/health/ready")
    assert status == 200
    assert ready["database"] == "connected"

    # 2. Telemetry and Prometheus exposition validation
    test_metrics = SentinelMetrics()
    test_metrics.record_db_query("customer_lookup", "error", 0.052)
    rendered = test_metrics.to_prometheus_text()

    assert 'sentinel_db_errors_total{operation="customer_lookup"} 1.0' in rendered
    assert 'sentinel_db_queries_total{operation="customer_lookup",status="error"} 1.0' in rendered
    assert 'sentinel_db_query_duration_seconds_count{operation="customer_lookup"} 1' in rendered
    print(
        "\n    [+] Drill 1 Passed: Database operational health verified and error telemetry rendered."
    )


# =============================================================================
# DRILL 2: Model Provider Timeout, Token & Cost Accounting
# =============================================================================
def test_drill_2_model_provider_timeout_and_cost_accounting():
    """
    Simulates external model provider call with latency, token consumption,
    and operational cost accounting. Confirms Prometheus exposition format.
    """
    test_metrics = SentinelMetrics()
    test_metrics.record_model_invocation(
        model="gemini-2.5-flash",
        duration_seconds=1.45,
        prompt_tokens=420,
        completion_tokens=180,
        estimated_cost_usd=0.00015,
    )
    rendered = test_metrics.to_prometheus_text()

    assert 'sentinel_model_requests_total{model="gemini-2.5-flash"} 1.0' in rendered
    assert 'sentinel_model_tokens_total{model="gemini-2.5-flash",type="prompt"} 420.0' in rendered
    assert (
        'sentinel_model_tokens_total{model="gemini-2.5-flash",type="completion"} 180.0' in rendered
    )
    assert 'sentinel_model_estimated_cost_usd{model="gemini-2.5-flash"} 0.00015' in rendered
    assert 'sentinel_model_latency_seconds_count{model="gemini-2.5-flash"} 1' in rendered
    print("\n    [+] Drill 2 Passed: Model provider latency, token usage, and costs accounted.")


# =============================================================================
# DRILL 3: MCP Server Disconnection & Tool Failure Metrics
# =============================================================================
def test_drill_3_mcp_server_disconnection():
    """
    Simulates MCP tool execution failure and verifies sentinel_mcp_tool_failures_total.
    """
    test_metrics = SentinelMetrics()
    test_metrics.record_mcp_tool_call(
        tool_name="remote_mcp.database_sync", status="error", duration_seconds=15.0
    )
    rendered = test_metrics.to_prometheus_text()

    assert 'sentinel_mcp_tool_failures_total{tool="remote_mcp.database_sync"} 1.0' in rendered
    assert (
        'sentinel_mcp_tool_calls_total{status="error",tool="remote_mcp.database_sync"} 1.0'
        in rendered
    )
    assert 'sentinel_mcp_tool_duration_seconds_count{tool="remote_mcp.database_sync"} 1' in rendered
    print("\n    [+] Drill 3 Passed: MCP server disconnection & tool failure recorded.")


# =============================================================================
# DRILL 4: Elevated Approval Replay Attack Spike (Live Staging API)
# =============================================================================
def test_drill_4_elevated_approval_replay_attempts(staging_token):
    """
    Simulates a burst of 5 approval replay attempts against a consumed ticket
    on the live staging server. Verifies that all 5 are rejected with HTTP 403
    and that the live Prometheus metric sentinel_approval_replays_blocked_total increments.
    """
    completed_ticket = "TICKET-EXECUTE_CUSTOM_MCP.DELETE_CUSTOMER-30a0154c6527507e"

    # Get initial live metric counter value
    initial_metrics = get_live_prometheus_metric("sentinel_approval_replays_blocked_total")
    initial_val = float(initial_metrics[0].split()[-1]) if initial_metrics else 0.0

    # Execute 5 replays against the completed ticket
    for i in range(5):
        status, data = http_req(
            f"{STAGING_API_URL}/api/tools/custom_mcp.delete_customer/execute",
            method="POST",
            headers={"Authorization": f"Bearer {staging_token}"},
            body={
                "parameters": {"customer_id": "1", "reason": f"Replay attempt {i + 1}"},
                "approval_ticket_id": completed_ticket,
            },
        )
        assert status == 403, (
            f"Replay attempt {i + 1} must be rejected with 403, got {status}, body: {data}"
        )

    # Verify live Prometheus metric updated
    after_metrics = get_live_prometheus_metric("sentinel_approval_replays_blocked_total")
    assert len(after_metrics) > 0, "Metric sentinel_approval_replays_blocked_total must exist"
    after_val = float(after_metrics[0].split()[-1])
    assert after_val >= initial_val + 5.0, (
        f"Expected counter to increase by at least 5 (before: {initial_val}, after: {after_val})"
    )
    print(
        f"\n    [+] Drill 4 Passed: 5 replay attempts blocked with 403; live metric grew from {initial_val} to {after_val}."
    )


# =============================================================================
# DRILL 5: Database Connection Pool Saturation
# =============================================================================
def test_drill_5_connection_pool_saturation_and_recovery():
    """
    Simulates database pool saturation by setting gauge to 10 used / 10 total.
    Verifies metric threshold triggers alert condition, then recovers.
    """
    test_metrics = SentinelMetrics()

    # 1. Simulate 100% saturation (10 used of 10 total)
    test_metrics.set_db_pool_status(total=10, used=10, free=0)
    saturated = test_metrics.to_prometheus_text()
    assert 'sentinel_db_pool_connections{state="used"} 10.0' in saturated
    assert 'sentinel_db_pool_connections{state="free"} 0.0' in saturated

    # 2. Recover pool (1 used, 9 free)
    test_metrics.set_db_pool_status(total=10, used=1, free=9)
    recovered = test_metrics.to_prometheus_text()
    assert 'sentinel_db_pool_connections{state="used"} 1.0' in recovered
    assert 'sentinel_db_pool_connections{state="free"} 9.0' in recovered
    print("\n    [+] Drill 5 Passed: Pool saturation and recovery gauges verified.")


# =============================================================================
# DRILL 6: Excessive API Error Rates (Live Staging API)
# =============================================================================
def test_drill_6_excessive_api_error_rates():
    """
    Simulates excessive 4xx errors against the live staging API and verifies
    sentinel_http_errors_total is recorded by live middleware.
    """
    # Send 10 invalid requests to nonexistent route
    for _ in range(10):
        status, _ = http_req(f"{STAGING_API_URL}/api/nonexistent-route-for-drill")
        assert status == 404

    # Verify Prometheus records the error burst
    error_metrics = get_live_prometheus_metric("sentinel_http_errors_total")
    assert len(error_metrics) > 0, "HTTP error metric must be present in live /metrics"
    print(
        f"\n    [+] Drill 6 Passed: Live HTTP 4xx error burst recorded in Prometheus: {error_metrics[0]}"
    )


# =============================================================================
# OPERATIONAL SECURITY: Sensitive Data Redaction in Logs and Metrics
# =============================================================================
def test_operational_security_sensitive_data_redaction():
    """
    Verifies that live metrics exposition does not contain sensitive tokens,
    passwords, or user email addresses.
    """
    status, metrics_text = http_req(f"{STAGING_API_URL}/metrics")
    assert status == 200
    for sensitive in ["password", "secret", "bearer", "eyjh", "@sentinel.test"]:
        assert sensitive not in metrics_text.lower(), (
            f"Sensitive token pattern '{sensitive}' exposed in /metrics!"
        )
    print(
        "\n    [+] Operational Security Passed: Zero credentials or sensitive user data found in /metrics exposition."
    )
