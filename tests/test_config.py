"""
Category A: Configuration Tests.
Verifies:
- Settings validation and constraints.
- Rejection of missing or invalid DATABASE_URL.
- Zero secret leakage in repr or logs.
"""

import pytest
from pydantic import ValidationError

from mcp_sentinel.config.settings import Settings


def test_missing_database_url_raises_validation_error(monkeypatch):
    """Verifies that missing DATABASE_URL halts initialization (fail closed)."""
    monkeypatch.delenv("DATABASE_URL", raising=False)
    # Also ignore .env file by pointing to non-existent file
    with pytest.raises((ValidationError, ValueError)):
        Settings(_env_file="non_existent.env")


def test_invalid_scheme_database_url_raises_error():
    """Verifies non-PostgreSQL scheme is rejected."""
    with pytest.raises(ValidationError):
        Settings(
            DATABASE_URL="mysql://user:pass@localhost:3306/db",
            _env_file="non_existent.env",
        )


def test_empty_database_url_raises_error():
    """Verifies empty DATABASE_URL is rejected."""
    with pytest.raises(ValidationError):
        Settings(
            DATABASE_URL="",
            _env_file="non_existent.env",
        )


def test_valid_database_url_loads_properly():
    """Verifies valid settings load correctly."""
    settings = Settings(
        DATABASE_URL="postgresql://test_user:super_secret_password@localhost:5000/test_db",
        APP_ENV="test",
        LOG_LEVEL="DEBUG",
        _env_file="non_existent.env",
    )
    assert settings.APP_ENV == "test"
    assert settings.LOG_LEVEL == "DEBUG"
    assert settings.DB_POOL_MIN_SIZE >= 1


def test_database_url_credential_masking():
    """Verifies password is never exposed in masked_database_url or repr."""
    password = "super_secret_password"
    settings = Settings(
        DATABASE_URL=f"postgresql://app_user:{password}@localhost:5000/enterprise_records",
        _env_file="non_existent.env",
    )

    masked = settings.masked_database_url
    assert password not in masked
    assert "***" in masked
    assert "app_user:***@localhost:5000" in masked

    repr_str = repr(settings)
    assert password not in repr_str
    assert "***" in repr_str


def test_settings_bounds_validation():
    """Verifies numeric bounds on limits and pool settings."""
    with pytest.raises(ValidationError):
        Settings(
            DATABASE_URL="postgresql://u:p@localhost:5000/db",
            MAX_QUERY_LIMIT=0,  # ge=1
            _env_file="non_existent.env",
        )

    with pytest.raises(ValidationError):
        Settings(
            DATABASE_URL="postgresql://u:p@localhost:5000/db",
            DB_POOL_MIN_SIZE=0,  # ge=1
            _env_file="non_existent.env",
        )
