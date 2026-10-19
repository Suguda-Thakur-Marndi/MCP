"""
Regression tests for Settings parsing of complex environment variables.
Specifically validates ALLOWED_GOOGLE_DOMAINS and ALLOWED_CORS_ORIGINS.
"""

import json

import pytest
from pydantic import ValidationError

from mcp_sentinel.config.settings import Settings


def test_allowed_google_domains_default():
    """Verify default ALLOWED_GOOGLE_DOMAINS is an empty list."""
    settings = Settings(
        DATABASE_URL="postgresql://postgres:pass@localhost:5432/mcp_test",
        ALLOWED_GOOGLE_DOMAINS="",
    )
    assert settings.ALLOWED_GOOGLE_DOMAINS == []


def test_allowed_google_domains_empty_and_whitespace():
    """Verify empty string and whitespace normalize to empty list."""
    for empty_val in ["", "   ", "\t"]:
        settings = Settings(
            DATABASE_URL="postgresql://postgres:pass@localhost:5432/mcp_test",
            ALLOWED_GOOGLE_DOMAINS=empty_val,
        )
        assert settings.ALLOWED_GOOGLE_DOMAINS == []


def test_allowed_google_domains_comma_separated():
    """Verify comma-separated string parsing and lowercasing."""
    settings = Settings(
        DATABASE_URL="postgresql://postgres:pass@localhost:5432/mcp_test",
        ALLOWED_GOOGLE_DOMAINS="Company.COM, partner.org , Sub.Domain.NET ",
    )
    assert settings.ALLOWED_GOOGLE_DOMAINS == [
        "company.com",
        "partner.org",
        "sub.domain.net",
    ]


def test_allowed_google_domains_single_string():
    """Verify single domain string without commas."""
    settings = Settings(
        DATABASE_URL="postgresql://postgres:pass@localhost:5432/mcp_test",
        ALLOWED_GOOGLE_DOMAINS="corp.example.com",
    )
    assert settings.ALLOWED_GOOGLE_DOMAINS == ["corp.example.com"]


def test_allowed_google_domains_json_array():
    """Verify valid JSON array string parsing."""
    json_val = json.dumps(["Corp.Example.com", "Partner.org"])
    settings = Settings(
        DATABASE_URL="postgresql://postgres:pass@localhost:5432/mcp_test",
        ALLOWED_GOOGLE_DOMAINS=json_val,
    )
    assert settings.ALLOWED_GOOGLE_DOMAINS == ["corp.example.com", "partner.org"]


def test_allowed_google_domains_native_list():
    """Verify native Python list remains supported."""
    settings = Settings(
        DATABASE_URL="postgresql://postgres:pass@localhost:5432/mcp_test",
        ALLOWED_GOOGLE_DOMAINS=["DomainA.com", "DomainB.com"],
    )
    assert settings.ALLOWED_GOOGLE_DOMAINS == ["domaina.com", "domainb.com"]


def test_allowed_google_domains_malformed_json_missing_bracket():
    """Verify descriptive ValidationError on unclosed JSON array."""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            DATABASE_URL="postgresql://postgres:pass@localhost:5432/mcp_test",
            ALLOWED_GOOGLE_DOMAINS="[company.com",
        )
    assert "Malformed JSON array for ALLOWED_GOOGLE_DOMAINS" in str(exc_info.value)


def test_allowed_google_domains_malformed_json_syntax():
    """Verify descriptive ValidationError on invalid JSON syntax."""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            DATABASE_URL="postgresql://postgres:pass@localhost:5432/mcp_test",
            ALLOWED_GOOGLE_DOMAINS="[invalid, json]",
        )
    assert "Malformed JSON array for ALLOWED_GOOGLE_DOMAINS" in str(exc_info.value)


def test_allowed_cors_origins_comma_separated():
    """Verify comma-separated origins are parsed properly."""
    settings = Settings(
        DATABASE_URL="postgresql://postgres:pass@localhost:5432/mcp_test",
        ALLOWED_CORS_ORIGINS="https://app.example.com, https://console.example.com",
    )
    assert "https://app.example.com" in settings.ALLOWED_CORS_ORIGINS
    assert "https://console.example.com" in settings.ALLOWED_CORS_ORIGINS


def test_allowed_cors_origins_json_array():
    """Verify JSON array origins are parsed properly."""
    json_origins = json.dumps(["https://custom.domain.com"])
    settings = Settings(
        DATABASE_URL="postgresql://postgres:pass@localhost:5432/mcp_test",
        ALLOWED_CORS_ORIGINS=json_origins,
    )
    assert "https://custom.domain.com" in settings.ALLOWED_CORS_ORIGINS


def test_allowed_cors_origins_malformed_json():
    """Verify descriptive ValidationError on malformed JSON array for CORS."""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            DATABASE_URL="postgresql://postgres:pass@localhost:5432/mcp_test",
            ALLOWED_CORS_ORIGINS="[malformed",
        )
    assert "Malformed JSON array for ALLOWED_CORS_ORIGINS" in str(exc_info.value)
