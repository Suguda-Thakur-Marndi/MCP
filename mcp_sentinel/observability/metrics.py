"""
Production Prometheus Metrics Instrumentation for MCP-Sentinel.
Adheres to:
- Real application telemetry without synthetic or fake values.
- Low-cardinality label controls (no user IDs, emails, request IDs, or raw prompts in labels).
- Standard Prometheus text exposition format (compatible with Prometheus, CloudWatch, Datadog).
"""

import threading
from collections import defaultdict
from typing import Optional


class MetricsRegistry:
    """
    Thread-safe in-memory Prometheus metrics registry.
    Collects counters, gauges, and histograms with label support.
    """

    def __init__(self):
        self._lock = threading.Lock()
        self._counters: dict[str, dict[tuple, float]] = defaultdict(lambda: defaultdict(float))
        self._gauges: dict[str, dict[tuple, float]] = defaultdict(lambda: defaultdict(float))
        self._histograms: dict[str, dict[tuple, list[float]]] = defaultdict(
            lambda: defaultdict(list)
        )
        self._metric_help: dict[str, str] = {}
        self._metric_type: dict[str, str] = {}

    def register_counter(self, name: str, help_text: str) -> None:
        self._metric_help[name] = help_text
        self._metric_type[name] = "counter"

    def register_gauge(self, name: str, help_text: str) -> None:
        self._metric_help[name] = help_text
        self._metric_type[name] = "gauge"

    def register_histogram(self, name: str, help_text: str) -> None:
        self._metric_help[name] = help_text
        self._metric_type[name] = "histogram"

    def inc_counter(
        self, name: str, labels: Optional[dict[str, str]] = None, value: float = 1.0
    ) -> None:
        label_key = tuple(sorted(labels.items())) if labels else ()
        with self._lock:
            self._counters[name][label_key] += value

    def set_gauge(self, name: str, value: float, labels: Optional[dict[str, str]] = None) -> None:
        label_key = tuple(sorted(labels.items())) if labels else ()
        with self._lock:
            self._gauges[name][label_key] = value

    def observe_histogram(
        self, name: str, value: float, labels: Optional[dict[str, str]] = None
    ) -> None:
        label_key = tuple(sorted(labels.items())) if labels else ()
        with self._lock:
            self._histograms[name][label_key].append(value)
            # Keep bounded histogram samples to prevent memory unbounded growth (last 1000 observations per label set)
            if len(self._histograms[name][label_key]) > 1000:
                self._histograms[name][label_key] = self._histograms[name][label_key][-1000:]

    def get_counter_value(self, name: str, labels: Optional[dict[str, str]] = None) -> float:
        label_key = tuple(sorted(labels.items())) if labels else ()
        with self._lock:
            return self._counters[name].get(label_key, 0.0)

    def get_gauge_value(self, name: str, labels: Optional[dict[str, str]] = None) -> float:
        label_key = tuple(sorted(labels.items())) if labels else ()
        with self._lock:
            return self._gauges[name].get(label_key, 0.0)

    def generate_prometheus_text(self) -> str:
        """
        Generates standard Prometheus text exposition format string.
        """
        lines: list[str] = []

        # Standard histogram buckets in seconds
        buckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]

        with self._lock:
            # 1. Counters
            for name, entries in sorted(self._counters.items()):
                help_text = self._metric_help.get(name, "Counter metric")
                lines.append(f"# HELP {name} {help_text}")
                lines.append(f"# TYPE {name} counter")
                for label_tuples, val in sorted(entries.items()):
                    if label_tuples:
                        label_str = ",".join(f'{k}="{v}"' for k, v in label_tuples)
                        lines.append(f"{name}{{{label_str}}} {val}")
                    else:
                        lines.append(f"{name} {val}")

            # 2. Gauges
            for name, entries in sorted(self._gauges.items()):
                help_text = self._metric_help.get(name, "Gauge metric")
                lines.append(f"# HELP {name} {help_text}")
                lines.append(f"# TYPE {name} gauge")
                for label_tuples, val in sorted(entries.items()):
                    if label_tuples:
                        label_str = ",".join(f'{k}="{v}"' for k, v in label_tuples)
                        lines.append(f"{name}{{{label_str}}} {val}")
                    else:
                        lines.append(f"{name} {val}")

            # 3. Histograms
            for name, entries in sorted(self._histograms.items()):
                help_text = self._metric_help.get(name, "Histogram metric")
                lines.append(f"# HELP {name} {help_text}")
                lines.append(f"# TYPE {name} histogram")
                for label_tuples, observations in sorted(entries.items()):
                    base_labels = dict(label_tuples)
                    total_count = len(observations)
                    total_sum = sum(observations)

                    for b in buckets:
                        le_count = sum(1 for v in observations if v <= b)
                        b_labels = {**base_labels, "le": str(b)}
                        b_label_str = ",".join(f'{k}="{v}"' for k, v in sorted(b_labels.items()))
                        lines.append(f"{name}_bucket{{{b_label_str}}} {le_count}")

                    inf_labels = {**base_labels, "le": "+Inf"}
                    inf_label_str = ",".join(f'{k}="{v}"' for k, v in sorted(inf_labels.items()))
                    lines.append(f"{name}_bucket{{{inf_label_str}}} {total_count}")

                    sum_label_str = (
                        "{" + ",".join(f'{k}="{v}"' for k, v in sorted(base_labels.items())) + "}"
                        if base_labels
                        else ""
                    )
                    lines.append(f"{name}_sum{sum_label_str} {round(total_sum, 6)}")
                    lines.append(f"{name}_count{sum_label_str} {total_count}")

        return "\n".join(lines) + "\n"


class SentinelMetrics:
    """
    Centralized high-level metrics recorder for MCP-Sentinel services.
    Enforces strictly controlled, low-cardinality labels.
    """

    def __init__(self, registry: Optional[MetricsRegistry] = None):
        self.registry = registry or MetricsRegistry()
        self._setup_metrics()

    def _setup_metrics(self) -> None:
        # HTTP metrics
        self.registry.register_counter(
            "sentinel_http_requests_total", "Total HTTP requests handled by the API"
        )
        self.registry.register_histogram(
            "sentinel_http_request_duration_seconds", "HTTP request latency in seconds"
        )
        self.registry.register_counter(
            "sentinel_http_errors_total", "Total HTTP 4xx and 5xx errors"
        )

        # Agent metrics
        self.registry.register_counter(
            "sentinel_agent_invocations_total", "Total AI agent reasoning turns"
        )
        self.registry.register_histogram(
            "sentinel_agent_duration_seconds", "AI agent reasoning latency in seconds"
        )
        self.registry.register_counter(
            "sentinel_agent_tool_calls_total", "Total tool calls requested by the agent"
        )

        # MCP metrics
        self.registry.register_counter(
            "sentinel_mcp_tool_calls_total", "Total executions through MCP tool catalog"
        )
        self.registry.register_histogram(
            "sentinel_mcp_tool_duration_seconds", "MCP tool execution latency in seconds"
        )
        self.registry.register_counter(
            "sentinel_mcp_tool_failures_total", "Total MCP tool failures"
        )

        # Security metrics
        self.registry.register_counter(
            "sentinel_policy_decisions_total", "Security policy evaluation decisions"
        )
        self.registry.register_counter(
            "sentinel_approvals_total", "Total human approval requests recorded"
        )
        self.registry.register_counter(
            "sentinel_approval_replays_blocked_total", "Total approval replay attempts blocked"
        )
        self.registry.register_counter(
            "sentinel_auth_failures_total", "Total authentication failures"
        )
        self.registry.register_counter(
            "sentinel_authorization_denials_total", "Total RBAC/ABAC authorization denials"
        )

        # Database metrics
        self.registry.register_counter(
            "sentinel_db_queries_total", "Total database operations executed"
        )
        self.registry.register_histogram(
            "sentinel_db_query_duration_seconds", "Database query latency in seconds"
        )
        self.registry.register_counter(
            "sentinel_db_errors_total", "Total database operational errors"
        )
        self.registry.register_gauge(
            "sentinel_db_pool_connections", "Current database connection pool status"
        )

    # Recorders
    def record_http_request(
        self, method: str, route: str, status_code: int, duration_seconds: float
    ) -> None:
        status_family = f"{status_code // 100}xx"
        labels = {"method": method.upper(), "route": route, "status": str(status_code)}
        self.registry.inc_counter("sentinel_http_requests_total", labels)
        self.registry.observe_histogram(
            "sentinel_http_request_duration_seconds",
            duration_seconds,
            {"method": method.upper(), "route": route},
        )
        if status_code >= 400:
            self.registry.inc_counter(
                "sentinel_http_errors_total",
                {"method": method.upper(), "route": route, "status_family": status_family},
            )

    def record_agent_invocation(self, status: str, duration_seconds: float) -> None:
        self.registry.inc_counter("sentinel_agent_invocations_total", {"status": status})
        self.registry.observe_histogram("sentinel_agent_duration_seconds", duration_seconds)

    def record_agent_tool_call(self, tool_name: str, status: str) -> None:
        self.registry.inc_counter(
            "sentinel_agent_tool_calls_total", {"tool": tool_name, "status": status}
        )

    def record_mcp_tool_call(self, tool_name: str, status: str, duration_seconds: float) -> None:
        self.registry.inc_counter(
            "sentinel_mcp_tool_calls_total", {"tool": tool_name, "status": status}
        )
        self.registry.observe_histogram(
            "sentinel_mcp_tool_duration_seconds", duration_seconds, {"tool": tool_name}
        )
        if status not in ("success", "allowed"):
            self.registry.inc_counter("sentinel_mcp_tool_failures_total", {"tool": tool_name})

    def record_policy_decision(self, tool_name: str, decision: str, risk_level: str) -> None:
        self.registry.inc_counter(
            "sentinel_policy_decisions_total",
            {"tool": tool_name, "decision": decision, "risk_level": risk_level},
        )

    def record_approval_lifecycle(self, status: str) -> None:
        self.registry.inc_counter("sentinel_approvals_total", {"status": status})

    def record_approval_replay(self) -> None:
        self.registry.inc_counter("sentinel_approval_replays_blocked_total")

    def record_auth_failure(self, reason: str = "invalid_credentials") -> None:
        # Sanitize reason to safe known categories
        clean_reason = (
            "token_expired"
            if "expired" in reason.lower()
            else ("token_invalid" if "invalid" in reason.lower() else "unauthorized")
        )
        self.registry.inc_counter("sentinel_auth_failures_total", {"reason": clean_reason})

    def record_authorization_denial(self, permission: str = "unknown") -> None:
        self.registry.inc_counter(
            "sentinel_authorization_denials_total", {"permission": permission}
        )

    def record_db_query(self, operation: str, status: str, duration_seconds: float) -> None:
        self.registry.inc_counter(
            "sentinel_db_queries_total", {"operation": operation, "status": status}
        )
        self.registry.observe_histogram(
            "sentinel_db_query_duration_seconds", duration_seconds, {"operation": operation}
        )
        if status != "success":
            self.registry.inc_counter("sentinel_db_errors_total", {"operation": operation})

    def set_db_pool_status(self, total: int, used: int, free: int) -> None:
        self.registry.set_gauge("sentinel_db_pool_connections", float(total), {"state": "total"})
        self.registry.set_gauge("sentinel_db_pool_connections", float(used), {"state": "used"})
        self.registry.set_gauge("sentinel_db_pool_connections", float(free), {"state": "free"})

    def to_prometheus_text(self) -> str:
        return self.registry.generate_prometheus_text()


# Global singleton instance
_metrics: Optional[SentinelMetrics] = None


def get_metrics() -> SentinelMetrics:
    """Returns singleton SentinelMetrics instance."""
    global _metrics
    if _metrics is None:
        _metrics = SentinelMetrics()
    return _metrics


def reset_metrics_for_testing() -> None:
    """Resets metrics singleton for isolated testing."""
    global _metrics
    _metrics = SentinelMetrics()


def generate_prometheus_metrics() -> bytes:
    """Returns raw Prometheus metrics text formatted as bytes."""
    return get_metrics().to_prometheus_text().encode("utf-8")


def record_policy_decision(tool_name: str, decision: str, risk_level: str = "medium") -> None:
    get_metrics().record_policy_decision(tool_name, decision, risk_level)


def record_tool_execution(tool_name: str, duration_seconds: float, status: str = "success") -> None:
    get_metrics().record_mcp_tool_call(tool_name, status, duration_seconds)


def record_approval_event(status: str) -> None:
    get_metrics().record_approval_lifecycle(status)


def record_approval_replay() -> None:
    get_metrics().record_approval_replay()


def record_rate_limit_exceeded(endpoint: str) -> None:
    get_metrics().registry.inc_counter("sentinel_rate_limit_exceeded_total", {"endpoint": endpoint})


def update_db_pool_metrics(total: int, used: int, free: int) -> None:
    get_metrics().set_db_pool_status(total, used, free)
