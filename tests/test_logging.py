"""
Category G: Structured Security Logging & Redaction Tests.
Complies with:
- Section 12: Security Logging (JSON format, standard event types).
- Section 13: Request Correlation.
- Zero credential / secret leakage in log streams.
"""

from mcp_sentinel.security.audit_logger import (
    DESTRUCTIVE_ACTION_BLOCKED,
    hash_identifier,
    log_security_event,
    redact_secrets,
)
from mcp_sentinel.security.correlation import set_request_id


def test_redact_secrets_dsn_and_passwords():
    """Verifies DSN passwords, query passwords, and bearer tokens are scrubbed."""
    raw_dsn = "postgresql://my_user:SuperSecretPassword123@localhost:5000/my_db"
    clean_dsn = redact_secrets(raw_dsn)
    assert "SuperSecretPassword123" not in clean_dsn
    assert "***" in clean_dsn
    assert "my_user:***@localhost:5000" in clean_dsn

    raw_token = "Authorization: Bearer secret_jwt_token_value_xyz"
    clean_token = redact_secrets(raw_token)
    assert "secret_jwt_token_value_xyz" not in clean_token
    assert "Bearer ***" in clean_token


def test_hash_identifier_anonymizes_sensitive_ids():
    """Verifies that identifiers are hashed with SHA-256 prefixes."""
    h1 = hash_identifier(12345)
    h2 = hash_identifier(12345)
    h3 = hash_identifier(67890)

    assert h1.startswith("h_")
    assert h1 == h2  # Deterministic for same ID
    assert h1 != h3
    assert "12345" not in h1


def test_log_security_event_structure():
    """Verifies standard structured security event properties."""
    set_request_id("req-test-correlation-123")

    event = log_security_event(
        event_type=DESTRUCTIVE_ACTION_BLOCKED,
        tool_name="purge_inactive_customer_data",
        action="purge_customer",
        decision="BLOCK",
        risk_classification="CRITICAL",
        user_id="user_admin_01",
        success=False,
        error_code="UNAUTHORIZED",
    )

    assert event["event_type"] == DESTRUCTIVE_ACTION_BLOCKED
    assert event["tool_name"] == "purge_inactive_customer_data"
    assert event["decision"] == "BLOCK"
    assert event["request_id"] == "req-test-correlation-123"
    assert event["timestamp"] is not None
    assert event["user_id"].startswith("h_")
    assert "user_admin_01" not in event["user_id"]
