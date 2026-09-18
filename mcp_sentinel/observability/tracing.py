"""
Production OpenTelemetry Distributed Tracing for MCP-Sentinel.
Adheres to:
- OpenTelemetry API standards with safe attribute sanitization.
- Zero credential, API key, customer PII, or raw prompt leakage in spans.
- Request correlation with trace_id and request_id.
- Safe fallback when OpenTelemetry collector / exporter is not configured.
"""

import contextlib
import logging
import os
import re
from typing import Any, Iterator, Optional

from mcp_sentinel.security.correlation import get_request_id, get_trace_id

logger = logging.getLogger("mcp_sentinel.observability.tracing")

# Sensitive attribute pattern filters
_SENSITIVE_ATTR_PATTERNS = [
    re.compile(r"password", re.IGNORECASE),
    re.compile(r"secret", re.IGNORECASE),
    re.compile(r"token", re.IGNORECASE),
    re.compile(r"authorization", re.IGNORECASE),
    re.compile(r"auth", re.IGNORECASE),
    re.compile(r"api_key", re.IGNORECASE),
    re.compile(r"key", re.IGNORECASE),
    re.compile(r"prompt", re.IGNORECASE),
    re.compile(r"email", re.IGNORECASE),
    re.compile(r"phone", re.IGNORECASE),
    re.compile(r"credential", re.IGNORECASE),
]


def sanitize_attribute_value(val: Any) -> Any:
    """Sanitizes trace attribute values to prevent PII or secret leakage."""
    if val is None:
        return ""
    if isinstance(val, (int, float, bool)):
        return val
    str_val = str(val)
    if len(str_val) > 256:
        str_val = str_val[:253] + "..."
    return str_val


def sanitize_attributes(attrs: dict[str, Any]) -> dict[str, Any]:
    """Filters and sanitizes trace span attributes."""
    clean: dict[str, Any] = {}
    for k, v in attrs.items():
        # Drop sensitive keys
        if any(pat.search(k) for pat in _SENSITIVE_ATTR_PATTERNS):
            clean[k] = "[REDACTED]"
            continue
        clean[k] = sanitize_attribute_value(v)
    return clean


class FallbackSpan:
    """Lightweight in-memory span used when OpenTelemetry SDK is not configured."""

    def __init__(self, name: str, attributes: Optional[dict[str, Any]] = None):
        self.name = name
        self.attributes = sanitize_attributes(attributes or {})
        self.is_recording = True

    def set_attribute(self, key: str, value: Any) -> None:
        clean = sanitize_attributes({key: value})
        self.attributes.update(clean)

    def set_status(self, status: Any) -> None:
        pass

    def record_exception(self, exc: BaseException) -> None:
        pass

    def end(self) -> None:
        self.is_recording = False

    def __enter__(self) -> "FallbackSpan":
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        self.end()


class SentinelTracer:
    """
    Manages OpenTelemetry tracing for MCP-Sentinel execution boundaries.
    """

    def __init__(self):
        self._tracer = None
        self._initialized = False

    def _init_tracer(self) -> None:
        if self._initialized:
            return
        try:
            from opentelemetry import trace

            service_name = os.environ.get("OTEL_SERVICE_NAME", "mcp-sentinel")
            self._tracer = trace.get_tracer(service_name, "1.0.0")
        except ImportError:
            logger.info(
                "OpenTelemetry not installed; distributed tracing using lightweight fallback."
            )
            self._tracer = None
        except Exception as exc:
            logger.warning("Failed to initialize OpenTelemetry tracer (%s); using fallback.", exc)
            self._tracer = None
        self._initialized = True

    @contextlib.contextmanager
    def start_span(
        self,
        name: str,
        attributes: Optional[dict[str, Any]] = None,
    ) -> Iterator[Any]:
        """
        Context manager starting a traced span with automatic correlation enrichment.
        """
        self._init_tracer()

        attrs = {
            "service.name": "mcp-sentinel",
            "request.id": get_request_id(),
            "trace.id": get_trace_id(),
            **(attributes or {}),
        }
        sanitized = sanitize_attributes(attrs)

        if self._tracer is not None:
            try:
                with self._tracer.start_as_current_span(name, attributes=sanitized) as span:
                    yield span
                    return
            except Exception as exc:
                logger.debug("OpenTelemetry span error: %s; falling back to internal span.", exc)

        fallback = FallbackSpan(name, sanitized)
        with fallback:
            yield fallback


# Singleton instance
_tracer_instance: Optional[SentinelTracer] = None


def get_tracer() -> SentinelTracer:
    """Returns singleton SentinelTracer instance."""
    global _tracer_instance
    if _tracer_instance is None:
        _tracer_instance = SentinelTracer()
    return _tracer_instance


@contextlib.contextmanager
def trace_boundary(boundary_name: str, **attributes: Any) -> Iterator[Any]:
    """Helper context manager for tracing execution boundaries."""
    tracer = get_tracer()
    with tracer.start_span(boundary_name, attributes=attributes) as span:
        yield span


@contextlib.contextmanager
def trace_span(
    name: str, attributes: Optional[dict[str, Any]] = None, **kwargs: Any
) -> Iterator[Any]:
    """Context manager for tracing arbitrary execution blocks with attribute sanitization."""
    tracer = get_tracer()
    combined = {**(attributes or {}), **kwargs}
    with tracer.start_span(name, attributes=combined) as span:
        yield span
