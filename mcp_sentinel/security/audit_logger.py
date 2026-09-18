"""
Structured JSON Security and Audit Logger for MCP-Sentinel.
Complies with:
- Structured event logging requirements.
- Zero credential/secret leakage in logs.
- Request correlation via request_id.
"""

import datetime
import hashlib
import json
import logging
import re
import sys
from typing import Any

from mcp_sentinel.security.correlation import get_request_id, get_trace_id

# Standard Security Event Types
TOOL_REQUESTED = "TOOL_REQUESTED"
TOOL_ALLOWED = "TOOL_ALLOWED"
TOOL_DENIED = "TOOL_DENIED"
TOOL_EXECUTED = "TOOL_EXECUTED"
APPROVAL_REQUIRED = "APPROVAL_REQUIRED"
APPROVAL_VALIDATION_FAILED = "APPROVAL_VALIDATION_FAILED"
DESTRUCTIVE_ACTION_BLOCKED = "DESTRUCTIVE_ACTION_BLOCKED"
DESTRUCTIVE_ACTION_EXECUTED = "DESTRUCTIVE_ACTION_EXECUTED"
INPUT_VALIDATION_FAILED = "INPUT_VALIDATION_FAILED"
SQL_INJECTION_ATTEMPT = "SQL_INJECTION_ATTEMPT"
AUTHORIZATION_FAILURE = "AUTHORIZATION_FAILURE"
DATABASE_ERROR = "DATABASE_ERROR"
LOOP_LIMIT_EXCEEDED = "LOOP_LIMIT_EXCEEDED"
TOOL_TIMEOUT = "TOOL_TIMEOUT"
POLICY_DECISION = "POLICY_DECISION"

# Phase 5 Human-in-the-Loop Approval Lifecycle Events
APPROVAL_CREATED = "APPROVAL_CREATED"
APPROVAL_VIEWED = "APPROVAL_VIEWED"
APPROVAL_APPROVED = "APPROVAL_APPROVED"
APPROVAL_DENIED = "APPROVAL_DENIED"
APPROVAL_CANCELLED = "APPROVAL_CANCELLED"
APPROVAL_EXPIRED = "APPROVAL_EXPIRED"
APPROVAL_EXECUTION_STARTED = "APPROVAL_EXECUTION_STARTED"
APPROVAL_EXECUTION_COMPLETED = "APPROVAL_EXECUTION_COMPLETED"
APPROVAL_EXECUTION_FAILED = "APPROVAL_EXECUTION_FAILED"
APPROVAL_REPLAY_BLOCKED = "APPROVAL_REPLAY_BLOCKED"
APPROVAL_BINDING_MISMATCH = "APPROVAL_BINDING_MISMATCH"
APPROVAL_POLICY_CHANGED = "APPROVAL_POLICY_CHANGED"
APPROVAL_AUTHORIZATION_FAILED = "APPROVAL_AUTHORIZATION_FAILED"

# Phase 6 Production Authentication, RBAC, ABAC & Identity Events
LOGIN_STARTED = "LOGIN_STARTED"
LOGIN_SUCCESS = "LOGIN_SUCCESS"
LOGIN_FAILURE = "LOGIN_FAILURE"
LOGOUT = "LOGOUT"
ACCOUNT_DISABLED = "ACCOUNT_DISABLED"
ACCOUNT_ENABLED = "ACCOUNT_ENABLED"
AUTHORIZATION_DENIED = "AUTHORIZATION_DENIED"
ROLE_CHANGED = "ROLE_CHANGED"
PERMISSION_DENIED = "PERMISSION_DENIED"
IDOR_ATTEMPT_BLOCKED = "IDOR_ATTEMPT_BLOCKED"
IDENTITY_SPOOFING_BLOCKED = "IDENTITY_SPOOFING_BLOCKED"

# Sensitive pattern scrubbers
_SECRET_PATTERNS = [
    re.compile(r"password['\"]?\s*[:=]\s*['\"]?([^'\"\s&]+)", re.IGNORECASE),
    re.compile(r"secret['\"]?\s*[:=]\s*['\"]?([^'\"\s&]+)", re.IGNORECASE),
    re.compile(r"postgres(ql)?://([^:]+):([^@]+)@", re.IGNORECASE),
    re.compile(r"bearer\s+([a-zA-Z0-9_\-\.]+)", re.IGNORECASE),
    re.compile(r"AIza[0-9A-Za-z\-_]{35}", re.IGNORECASE),
    re.compile(r"(?:gemini_api_key|api_key)['\"]?\s*[:=]\s*['\"]?([^'\"\s&,]+)", re.IGNORECASE),
    re.compile(
        r"(?:approval_token|token_hash|secret_key)['\"]?\s*[:=]\s*['\"]?([^'\"\s&,]+)",
        re.IGNORECASE,
    ),
]


def redact_secrets(text: str) -> str:
    """
    Redacts sensitive credentials, tokens, database passwords, approval tokens, and API keys from log strings.
    """
    redacted = text
    # Redact PostgreSQL DSN passwords
    redacted = re.sub(
        r"(postgres(?:ql)?://[^:]+:)([^@]+)(@)",
        r"\1***\3",
        redacted,
        flags=re.IGNORECASE,
    )
    # Redact password / secret fields
    redacted = re.sub(
        r"((?:password|secret)['\"]?\s*[:=]\s*['\"]?)([^'\"\s&,]+)",
        r"\1***",
        redacted,
        flags=re.IGNORECASE,
    )
    # Redact tokens
    redacted = re.sub(
        r"(bearer\s+)([a-zA-Z0-9_\-\.]+)",
        r"\1***",
        redacted,
        flags=re.IGNORECASE,
    )
    # Redact Google/Gemini API keys (AIza...)
    redacted = re.sub(
        r"AIza[0-9A-Za-z\-_]{20,}",
        "AIza***REDACTED_API_KEY***",
        redacted,
    )
    # Redact generic api_key / gemini_api_key fields
    redacted = re.sub(
        r"((?:gemini_api_key|api_key|apiKey)['\"]?\s*[:=]\s*['\"]?)([^'\"\s&,]+)",
        r"\1***",
        redacted,
        flags=re.IGNORECASE,
    )
    # Redact approval tokens and secrets
    redacted = re.sub(
        r"((?:approval_token|token_secret|secret_key)['\"]?\s*[:=]\s*['\"]?)([^'\"\s&,]+)",
        r"\1***",
        redacted,
        flags=re.IGNORECASE,
    )
    # Redact AWS secret access keys / session tokens / IAM access key IDs
    redacted = re.sub(
        r"(AKIA[0-9A-Z]{16})",
        "AKIA***REDACTED_AWS_KEY***",
        redacted,
    )
    redacted = re.sub(
        r"((?:aws_secret_access_key|aws_session_token)['\"]?\s*[:=]\s*['\"]?)([^'\"\s&,]+)",
        r"\1***",
        redacted,
        flags=re.IGNORECASE,
    )
    return redacted


def hash_identifier(identifier: Any) -> str:
    """
    Produces a 12-char SHA-256 hash digest for sensitive identifiers (e.g. customer_id, email)
    to allow correlation without exposing raw PII in logs.
    """
    if identifier is None:
        return "none"
    raw = str(identifier).encode("utf-8")
    return f"h_{hashlib.sha256(raw).hexdigest()[:12]}"


_SENSITIVE_KEY_SUBSTRINGS = (
    "password",
    "secret",
    "token",
    "authorization",
    "cookie",
    "api_key",
    "apikey",
    "gemini_key",
    "private_key",
    "access_key",
    "aws_key",
)


def scrub_dict_secrets(data: Any) -> Any:
    """
    Recursively scrubs sensitive keys and values from dictionaries, lists, and strings.
    """
    if isinstance(data, dict):
        scrubbed = {}
        for k, v in data.items():
            k_lower = str(k).lower()
            if any(s in k_lower for s in _SENSITIVE_KEY_SUBSTRINGS):
                if "aws" in k_lower or (isinstance(v, str) and v.startswith("AKIA")):
                    scrubbed[k] = "[REDACTED_AWS_KEY]"
                else:
                    scrubbed[k] = "[REDACTED]"
            else:
                scrubbed[k] = scrub_dict_secrets(v)
        return scrubbed
    elif isinstance(data, list):
        return [scrub_dict_secrets(item) for item in data]
    elif isinstance(data, str):
        return redact_secrets(data)
    return data


# Alias for internal and testing use
_scrub_sensitive_data = scrub_dict_secrets


class SecurityJsonFormatter(logging.Formatter):
    """
    Formats log records as single-line JSON objects with standard security fields.
    """

    def format(self, record: logging.LogRecord) -> str:
        log_obj = getattr(record, "security_event", None)
        if isinstance(log_obj, dict):
            # Ensure standard fields
            if "timestamp" not in log_obj:
                log_obj["timestamp"] = datetime.datetime.now(datetime.UTC).isoformat()
            if "request_id" not in log_obj:
                log_obj["request_id"] = get_request_id()
            if "trace_id" not in log_obj:
                log_obj["trace_id"] = get_trace_id()
            if "level" not in log_obj:
                log_obj["level"] = record.levelname
            return redact_secrets(json.dumps(log_obj, ensure_ascii=False))

        # Standard logging fallback
        fallback = {
            "timestamp": datetime.datetime.now(datetime.UTC).isoformat(),
            "level": record.levelname,
            "request_id": get_request_id(),
            "trace_id": get_trace_id(),
            "logger": record.name,
            "message": redact_secrets(record.getMessage()),
        }
        if record.exc_info:
            fallback["exception"] = redact_secrets(self.formatException(record.exc_info))
        return json.dumps(fallback, ensure_ascii=False)


# Initialize logger
_logger = logging.getLogger("mcp_sentinel.security")
_logger.setLevel(logging.INFO)
if not _logger.handlers:
    _handler = logging.StreamHandler(sys.stdout)
    _handler.setFormatter(SecurityJsonFormatter())
    _logger.addHandler(_handler)


def log_security_event(
    event_type: str,
    action: str,
    decision: str,
    tool_name: str | None = None,
    risk_classification: str | None = None,
    user_id: str | None = None,
    agent_id: str | None = None,
    success: bool = True,
    error_code: str | None = None,
    details: dict[str, Any] | None = None,
    level: int = logging.INFO,
    request_id: str | None = None,
    trace_id: str | None = None,
) -> dict[str, Any]:
    """
    Logs a structured security audit event.
    Automatically scrubs secrets and enriches with correlation request_id, trace_id, and UTC timestamp.
    """
    event = {
        "timestamp": datetime.datetime.now(datetime.UTC).isoformat(),
        "request_id": request_id or get_request_id(),
        "trace_id": trace_id or get_trace_id(),
        "event_type": event_type,
        "tool_name": tool_name or "unknown",
        "action": action,
        "decision": decision,
        "risk_classification": risk_classification or "NORMAL",
        "user_id": hash_identifier(user_id) if user_id else None,
        "agent_id": agent_id or "default_agent",
        "success": success,
        "error_code": error_code,
        "details": details or {},
    }

    record = _logger.makeRecord(
        name=_logger.name,
        level=level,
        fn="",
        lno=0,
        msg="",
        args=(),
        exc_info=None,
    )
    record.security_event = event  # type: ignore[attr-defined]
    _logger.handle(record)
    return event
