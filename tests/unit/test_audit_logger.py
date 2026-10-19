"""
Unit tests for MCP-Sentinel Audit Logger and Secret Redaction.
Verifies:
- Complete scrubbing of sensitive credentials from log strings
- Masking of PostgreSQL DSN passwords
- Masking of Notion integration tokens (ntn_, secret_)
- Masking of AWS access keys
- Masking of Bearer tokens
"""

from mcp_sentinel.security.audit_logger import redact_secrets


def test_redacts_postgresql_dsn_password():
    """Verifies that database passwords in connection strings are masked."""
    dsn = "postgresql://sentinel_user:super_secret_password_123@db.example.com:5432/sentinel_prod"
    redacted = redact_secrets(dsn)

    assert "super_secret_password_123" not in redacted
    assert "postgresql://sentinel_user:***@db.example.com:5432/sentinel_prod" in redacted


def test_redacts_notion_tokens():
    """Verifies that Notion integration tokens are masked."""
    msg = "Failed request using token ntn_1234567890abcdef1234567890 and secret_abcdef1234567890abcdef1234"
    redacted = redact_secrets(msg)

    assert "ntn_1234567890abcdef1234567890" not in redacted
    assert "ntn_***REDACTED_NOTION_KEY***" in redacted
    assert "secret_***REDACTED_NOTION_KEY***" in redacted


def test_redacts_aws_access_key():
    """Verifies that AWS access keys are masked."""
    msg = "Access denied for principal with key AKIAIOSFODNN7EXAMPLE"
    redacted = redact_secrets(msg)

    assert "AKIAIOSFODNN7EXAMPLE" not in redacted
    assert "AKIA***REDACTED_AWS_KEY***" in redacted


def test_redacts_bearer_token():
    """Verifies that Bearer authentication tokens are masked."""
    msg = "Header Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.signature"
    redacted = redact_secrets(msg)

    assert "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" not in redacted
    assert "Bearer ***" in redacted
