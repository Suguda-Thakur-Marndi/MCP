"""
Phase 3 Tests: Configuration, Secrets Redaction, and Limits.
Verifies that:
1. GEMINI_API_KEY is loaded safely from environment/settings.
2. Secrets are strictly masked in settings __repr__ and strings.
3. Audit logger redacts Gemini API keys and sensitive tokens.
4. Agent limit settings (iterations, tool calls, timeouts) are properly validated.
"""

import pytest

from mcp_sentinel.config.settings import Settings, get_settings
from mcp_sentinel.security.audit_logger import redact_secrets


def test_phase3_settings_defaults():
    settings = get_settings()
    assert settings.GEMINI_MODEL == "gemini-2.5-flash"
    assert settings.MAX_AGENT_ITERATIONS == 10
    assert settings.MAX_TOOL_CALLS == 15
    assert settings.AGENT_ID == "gemini-agent-v1"
    assert settings.TOOL_TIMEOUT_SECONDS == 15.0


def test_phase3_settings_masked_gemini_key():
    s = Settings(
        DATABASE_URL="postgresql://user:pass@localhost:5432/db",
        GEMINI_API_KEY="AIzaSyA1234567890abcdefghijklmnopqrstuv",
    )
    # Full secret must never be present in repr
    repr_str = repr(s)
    assert "AIzaSyA1234567890abcdefghijklmnopqrstuv" not in repr_str
    assert "AIza...***" in repr_str
    assert s.masked_gemini_api_key == "AIza...***"

    # None case
    s_none = Settings(
        DATABASE_URL="postgresql://user:pass@localhost:5432/db",
        GEMINI_API_KEY=None,
    )
    assert s_none.masked_gemini_api_key == "not_configured"


def test_phase3_audit_logger_redacts_gemini_keys():
    log_text = (
        "Calling Gemini with key AIzaSyD9876543210zyxwvutsrqponmlkjihgfed and secret=my_secret"
    )
    redacted = redact_secrets(log_text)
    assert "AIzaSyD9876543210zyxwvutsrqponmlkjihgfed" not in redacted
    assert "AIza***REDACTED_API_KEY***" in redacted
    assert "secret=my_secret" not in redacted
    assert "secret=***" in redacted


def test_phase3_audit_logger_redacts_api_key_field():
    log_json = '{"event": "AUTH", "gemini_api_key": "secret_gemini_token_value", "data": "clean"}'
    redacted = redact_secrets(log_json)
    assert "secret_gemini_token_value" not in redacted
    assert '"gemini_api_key": "***"' in redacted


def test_phase3_settings_bounds_validation():
    with pytest.raises(Exception):
        # Negative iterations should fail
        Settings(
            DATABASE_URL="postgresql://user:pass@localhost:5432/db",
            MAX_AGENT_ITERATIONS=-1,
        )

    with pytest.raises(Exception):
        # Excessive iterations should fail
        Settings(
            DATABASE_URL="postgresql://user:pass@localhost:5432/db",
            MAX_AGENT_ITERATIONS=1000,
        )
