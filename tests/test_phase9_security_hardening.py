"""
Phase 9 Automated Tests: Security Hardening, Secret Redaction, and Policy Fail-Closed Enforcements.
Tests:
- Secret scrubbing in structured audit logs (AWS keys, passwords, bearer tokens)
- SecretProvider abstraction (EnvSecretProvider & AWSSecretsManagerProvider)
- CORS origin restriction behavior
- Authoritative fail-closed behavior under error conditions
"""

import json
from unittest.mock import MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from mcp_sentinel.api.app import app
from mcp_sentinel.config.secrets import AWSSecretsManagerProvider, EnvSecretProvider
from mcp_sentinel.security.audit_logger import _scrub_sensitive_data
from mcp_sentinel.security.decisions.models import SecurityDecisionEnum
from mcp_sentinel.security.policy.engine import PolicyEngine


def test_audit_logger_scrubs_secrets_and_credentials():
    """Verify that regex scrubbers in audit logger redact AWS keys, tokens, and passwords."""
    raw_payload = {
        "aws_key": "AKIA" + "IOSFODNN7EXAMPLE",
        "authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "db_password": "postgres_super_secret_1234",
        "cookie": "session=xyz987token; Path=/",
        "safe_key": "safe_value",
        "nested": {
            "token": "ghp_" + "1234567890abcdefghijklmnopqrstuvwxyz",
            "number": 42,
        },
    }

    scrubbed = _scrub_sensitive_data(raw_payload)

    # Sensitive keys and patterns must be redacted
    assert scrubbed["aws_key"] == "[REDACTED_AWS_KEY]"
    assert scrubbed["authorization"] == "[REDACTED]"
    assert scrubbed["db_password"] == "[REDACTED]"
    assert scrubbed["cookie"] == "[REDACTED]"
    assert scrubbed["nested"]["token"] == "[REDACTED]"

    # Non-sensitive keys are preserved
    assert scrubbed["safe_key"] == "safe_value"
    assert scrubbed["nested"]["number"] == 42


def test_env_secret_provider(monkeypatch):
    """Verify EnvSecretProvider retrieves environment variables cleanly."""
    monkeypatch.setenv("TEST_SECRET_VAR", "my-secret-val-123")
    provider = EnvSecretProvider()

    assert provider.get_secret("TEST_SECRET_VAR") == "my-secret-val-123"
    assert provider.get_secret("NON_EXISTENT_VAR") is None
    assert provider.get_secret("NON_EXISTENT_VAR", default="fallback") == "fallback"


def test_aws_secrets_manager_provider():
    """Verify AWSSecretsManagerProvider interacts with boto3 client and caches values."""
    mock_boto_client = MagicMock()
    mock_boto_client.get_secret_value.return_value = {
        "SecretString": json.dumps({"db_password": "super-safe-rds-pass"})
    }

    provider = AWSSecretsManagerProvider(client=mock_boto_client)
    val = provider.get_secret("mcp-sentinel/db")

    assert val == '{"db_password": "super-safe-rds-pass"}'
    # Second call uses cache
    val2 = provider.get_secret("mcp-sentinel/db")
    assert val2 == val
    assert mock_boto_client.get_secret_value.call_count == 1


@pytest.mark.asyncio
async def test_cors_origin_restriction():
    """Verify CORS headers respect origin configuration."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Preflight OPTIONS request with configured localhost origin
        resp = await client.options(
            "/api/auth/me",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert resp.status_code == 200
        assert resp.headers.get("access-control-allow-origin") == "http://localhost:3000"

        # Request with disallowed external origin
        disallowed_origin = "https://malicious-attacker-site.com"
        resp2 = await client.options(
            "/api/auth/me",
            headers={
                "Origin": disallowed_origin,
                "Access-Control-Request-Method": "GET",
            },
        )
        # Should NOT echo back the malicious origin
        assert resp2.headers.get("access-control-allow-origin") != disallowed_origin


def test_policy_engine_fails_closed_without_context():
    """Verify policy engine fails closed when context is absent."""
    engine = PolicyEngine()
    decision = engine.evaluate(context=None)

    # Must fail closed: never ALLOW
    assert decision.decision != SecurityDecisionEnum.ALLOW
    assert decision.decision in (SecurityDecisionEnum.REQUIRE_APPROVAL, SecurityDecisionEnum.DENY)
    assert "missing" in decision.reason.lower() or "failing closed" in decision.reason.lower()
