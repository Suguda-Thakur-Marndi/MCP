"""
Centralized Configuration and Secret Management for MCP-Sentinel.
Adheres to Security Rule #5: Never store secrets in source code.
Uses Pydantic Settings for strongly-typed, environment-driven configuration.
"""

import urllib.parse
from typing import Any, Literal, Optional

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables and .env file.
    Sensitive credentials are never hard-coded and are redacted in string outputs.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # Core Database Configuration
    DATABASE_URL: str = Field(
        ...,
        description="PostgreSQL DSN string. Required. Must not be empty.",
    )
    EVAL_DATABASE_URL: Optional[str] = Field(
        default=None,
        description="Isolated evaluation database URL. Defaults to mcp_sentinel_eval.",
    )

    # Environment & Logging
    APP_ENV: Literal["development", "staging", "production", "test"] = Field(
        default="development",
        description="Application runtime environment.",
    )
    LOG_LEVEL: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = Field(
        default="INFO",
        description="Application logging verbosity.",
    )

    # Server Metadata
    MCP_SERVER_NAME: str = Field(
        default="MCP-Sentinel",
        description="Name of the MCP server instance.",
    )
    MCP_SERVER_VERSION: str = Field(
        default="0.1.0",
        description="Version of the MCP server implementation.",
    )

    # Connection Pooling Settings
    DB_POOL_MIN_SIZE: int = Field(
        default=2,
        ge=1,
        le=20,
        description="Minimum pool connection count.",
    )
    DB_POOL_MAX_SIZE: int = Field(
        default=10,
        ge=2,
        le=50,
        description="Maximum pool connection count.",
    )
    DB_POOL_TIMEOUT_SECONDS: float = Field(
        default=10.0,
        gt=0.0,
        le=60.0,
        description="Acquire connection timeout in seconds.",
    )
    DB_COMMAND_TIMEOUT_SECONDS: float = Field(
        default=15.0,
        gt=0.0,
        le=120.0,
        description="Individual command/query execution timeout in seconds.",
    )

    # Security & Guardrail Limits
    MAX_QUERY_LIMIT: int = Field(
        default=100,
        ge=1,
        le=1000,
        description="Upper bound for returned customer records per query.",
    )
    DEFAULT_QUERY_LIMIT: int = Field(
        default=50,
        ge=1,
        le=100,
        description="Default limit if unspecified.",
    )
    MAX_AUDIT_NOTE_LENGTH: int = Field(
        default=2000,
        ge=10,
        le=10000,
        description="Maximum characters permitted in customer audit notes.",
    )
    MAX_REASON_LENGTH: int = Field(
        default=500,
        ge=5,
        le=2000,
        description="Maximum characters permitted in destructive action reason.",
    )
    APPROVAL_TICKET_TTL_SECONDS: int = Field(
        default=3600,
        ge=60,
        description="Time-to-live for gating approval tickets in seconds.",
    )

    # Phase 3: AI Agent & LLM Configuration
    GEMINI_API_KEY: str | None = Field(
        default=None,
        description="Google Gemini API key. Never logged, printed, or exposed.",
    )
    GEMINI_MODEL: str = Field(
        default="gemini-2.5-flash",
        description="Gemini model identifier for agent reasoning.",
    )
    MAX_AGENT_ITERATIONS: int = Field(
        default=10,
        ge=1,
        le=50,
        description="Maximum reasoning/tool-calling loop iterations for loop protection.",
    )
    MAX_TOOL_CALLS: int = Field(
        default=15,
        ge=1,
        le=100,
        description="Maximum total tool executions permitted per agent conversation turn.",
    )
    AGENT_ID: str = Field(
        default="gemini-agent-v1",
        description="Stable identifier for the AI agent actor in logs and correlation.",
    )
    TOOL_TIMEOUT_SECONDS: float = Field(
        default=15.0,
        ge=1.0,
        le=120.0,
        description="Per-tool call execution timeout in seconds.",
    )
    MCP_SERVER_URL: str | None = Field(
        default=None,
        description="Optional URL for remote MCP server transport. None defaults to in-process.",
    )

    # Phase 5 & 6: Authentication & Security Tokens
    JWT_SECRET_KEY: str = Field(
        default="sentinel-production-jwt-secret-key-change-me-32chars",
        description="Secret key for signing internal Sentinel JWT session tokens.",
    )
    JWT_ALGORITHM: str = Field(
        default="HS256",
        description="Algorithm for signing JWT session tokens.",
    )
    JWT_EXPIRATION_MINUTES: int = Field(
        default=60,
        ge=5,
        le=43200,
        description="Expiration time for Sentinel session JWTs in minutes.",
    )
    GOOGLE_CLIENT_ID: str | None = Field(
        default=None,
        description="Google OAuth/OIDC Client ID. When set, verifies Google ID tokens in production.",
    )
    GOOGLE_CLIENT_SECRET: str | None = Field(
        default=None,
        description="Google OAuth Client Secret. Never logged, printed, or exposed.",
    )
    GOOGLE_REDIRECT_URI: str = Field(
        default="http://localhost:8000/api/auth/google/callback",
        description="Google OAuth Redirect URI callback endpoint.",
    )
    GITHUB_OAUTH_CLIENT_ID: Optional[str] = Field(
        default=None,
        description="GitHub OAuth App Client ID.",
    )
    GITHUB_OAUTH_CLIENT_SECRET: Optional[str] = Field(
        default=None,
        description="GitHub OAuth App Client Secret. Never logged, printed, or exposed.",
    )
    GITHUB_OAUTH_REDIRECT_URI: str = Field(
        default="http://localhost:8000/api/integrations/github/callback",
        description="GitHub OAuth Redirect URI callback endpoint.",
    )
    ALLOWED_GOOGLE_DOMAINS: list[str] = Field(
        default_factory=list,
        description="Allowlist of email domains permitted to log in (empty allows all in dev/test).",
    )
    ENABLE_TEST_AUTH: bool = Field(
        default=True,
        description="Allows mock Google OIDC tokens in test/development environments.",
    )
    SESSION_COOKIE_NAME: str = Field(
        default="sentinel_session",
        description="Cookie name for HTTP-only application session tokens.",
    )
    SESSION_COOKIE_SECURE: bool = Field(
        default=False,
        description="Whether session cookies require HTTPS. Set to True in production.",
    )
    SESSION_COOKIE_HTTPONLY: bool = Field(
        default=True,
        description="Ensures session cookies cannot be accessed via JavaScript.",
    )
    SESSION_COOKIE_SAMESITE: Literal["lax", "strict", "none"] = Field(
        default="lax",
        description="SameSite policy for session cookies to mitigate CSRF.",
    )
    SESSION_EXPIRATION_HOURS: int = Field(
        default=12,
        ge=1,
        le=168,
        description="Maximum lifetime for database-tracked user sessions in hours.",
    )
    CSRF_PROTECTION_ENABLED: bool = Field(
        default=True,
        description="Enforces CSRF header token validation on state-changing cookie requests.",
    )
    ALLOWED_CORS_ORIGINS: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:8000",
            "http://127.0.0.1:8000",
        ],
        description="Explicit allowed CORS origins. Wildcards combined with credentials are prohibited.",
    )
    FRONTEND_URL: str = Field(
        default="http://localhost:3000",
        description="Base URL for the Next.js frontend web console.",
    )
    BACKEND_URL: str = Field(
        default="http://localhost:8000",
        description="Base URL for the FastAPI backend gateway.",
    )
    SESSION_SECRET: str | None = Field(
        default=None,
        description="Optional alias for JWT_SECRET_KEY.",
    )

    # Phase 4: Policy & Risk Engine Configuration
    RISK_LOW_MAX: int = Field(
        default=24,
        ge=0,
        le=100,
        description="Upper risk score threshold for LOW risk classification.",
    )
    RISK_MEDIUM_MAX: int = Field(
        default=49,
        ge=0,
        le=100,
        description="Upper risk score threshold for MEDIUM risk classification.",
    )
    RISK_HIGH_MAX: int = Field(
        default=74,
        ge=0,
        le=100,
        description="Upper risk score threshold for HIGH risk classification.",
    )
    RISK_CRITICAL_MAX: int = Field(
        default=100,
        ge=0,
        le=100,
        description="Upper risk score threshold for CRITICAL risk classification.",
    )
    BULK_OPERATION_THRESHOLD: int = Field(
        default=100,
        ge=1,
        description="Threshold at which operation scope escalates risk to bulk scale.",
    )
    CRITICAL_OPERATION_THRESHOLD: int = Field(
        default=1000,
        ge=1,
        description="Threshold at which operation scope escalates risk to critical scale.",
    )
    DEFAULT_POLICY_ID: str = Field(
        default="sentinel-core-policy",
        description="Identifier of the default security policy.",
    )
    DEFAULT_POLICY_VERSION: str = Field(
        default="1.0.0",
        description="Version string of the active security policy.",
    )

    @field_validator("DATABASE_URL")
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("DATABASE_URL cannot be empty.")
        parsed = urllib.parse.urlparse(v)
        if parsed.scheme not in ("postgresql", "postgres"):
            raise ValueError(
                f"Invalid database scheme '{parsed.scheme}'. Must be 'postgresql' or 'postgres'."
            )
        if not parsed.hostname:
            raise ValueError("DATABASE_URL must specify a valid hostname.")
        return v.strip()

    @model_validator(mode="after")
    def sync_session_and_cors(self) -> "Settings":
        if self.SESSION_SECRET:
            default_keys = {
                "sentinel-production-jwt-secret-key-change-me-32chars",
                "change-me-in-production-min-32-chars",
            }
            if not self.JWT_SECRET_KEY or self.JWT_SECRET_KEY in default_keys:
                self.JWT_SECRET_KEY = self.SESSION_SECRET
        if self.FRONTEND_URL and self.FRONTEND_URL not in self.ALLOWED_CORS_ORIGINS:
            self.ALLOWED_CORS_ORIGINS.append(self.FRONTEND_URL)
        return self

    @property
    def masked_database_url(self) -> str:
        """
        Returns the DATABASE_URL with user credentials securely masked.
        Safe for logging, metrics, and diagnostics.
        """
        try:
            parsed = urllib.parse.urlparse(self.DATABASE_URL)
            netloc = parsed.hostname or "localhost"
            if parsed.port:
                netloc = f"{netloc}:{parsed.port}"
            if parsed.username:
                netloc = f"{parsed.username}:***@{netloc}"
            return urllib.parse.urlunparse(
                (parsed.scheme, netloc, parsed.path, parsed.params, parsed.query, parsed.fragment)
            )
        except Exception:
            return "postgresql://***:***@masked/masked"

    @property
    def evaluation_database_url(self) -> str:
        """
        Returns the isolated database URL used exclusively for security evaluation.
        Defaults to 'mcp_sentinel_eval' on the same server, ensuring complete isolation from production/dev.
        """
        if self.EVAL_DATABASE_URL:
            return self.EVAL_DATABASE_URL
        try:
            parsed = urllib.parse.urlparse(self.DATABASE_URL)
            return urllib.parse.urlunparse(
                (
                    parsed.scheme,
                    parsed.netloc,
                    "/mcp_sentinel_eval",
                    parsed.params,
                    parsed.query,
                    parsed.fragment,
                )
            )
        except Exception:
            return self.DATABASE_URL

    @property
    def masked_evaluation_database_url(self) -> str:
        """
        Returns the evaluation database URL with credentials safely masked.
        """
        try:
            parsed = urllib.parse.urlparse(self.evaluation_database_url)
            netloc = parsed.hostname or "localhost"
            if parsed.port:
                netloc = f"{netloc}:{parsed.port}"
            if parsed.username:
                netloc = f"{parsed.username}:***@{netloc}"
            return urllib.parse.urlunparse(
                (parsed.scheme, netloc, parsed.path, parsed.params, parsed.query, parsed.fragment)
            )
        except Exception:
            return "postgresql://***:***@masked/mcp_sentinel_eval"

    @property
    def masked_gemini_api_key(self) -> str:
        """
        Returns masked representation of the Gemini API key.
        Never returns full secret value.
        """
        if not self.GEMINI_API_KEY:
            return "not_configured"
        if len(self.GEMINI_API_KEY) <= 8:
            return "***"
        return f"{self.GEMINI_API_KEY[:4]}...***"

    @property
    def masked_google_client_secret(self) -> str:
        """
        Returns masked representation of Google Client Secret.
        Never returns full secret value.
        """
        if not self.GOOGLE_CLIENT_SECRET:
            return "not_configured"
        if len(self.GOOGLE_CLIENT_SECRET) <= 8:
            return "***"
        return f"{self.GOOGLE_CLIENT_SECRET[:4]}...***"

    @property
    def masked_github_client_secret(self) -> str:
        """
        Returns masked representation of GitHub Client Secret.
        Never returns full secret value.
        """
        if not self.GITHUB_OAUTH_CLIENT_SECRET:
            return "not_configured"
        if len(self.GITHUB_OAUTH_CLIENT_SECRET) <= 8:
            return "***"
        return f"{self.GITHUB_OAUTH_CLIENT_SECRET[:4]}...***"

    def validate_production_startup(self) -> None:
        """
        Enforces strict fail-fast validation when operating in production.
        Prevents starting the production API with default secrets, test auth,
        wildcard CORS, or insecure cookie configurations.
        """
        if self.APP_ENV == "production":
            insecure_jwt_defaults = {
                "sentinel-production-jwt-secret-key-change-me-32chars",
                "change-me-in-production-min-32-chars",
                "secret",
                "jwtsecret",
            }
            if (
                not self.JWT_SECRET_KEY
                or self.JWT_SECRET_KEY in insecure_jwt_defaults
                or len(self.JWT_SECRET_KEY) < 32
            ):
                raise ValueError(
                    "Production configuration failure: JWT_SECRET_KEY must be a strong, non-default string of at least 32 characters."
                )

            if "*" in self.ALLOWED_CORS_ORIGINS:
                raise ValueError(
                    "Production configuration failure: Wildcard origin '*' is forbidden in ALLOWED_CORS_ORIGINS when credentials are enabled."
                )

            if not self.SESSION_COOKIE_SECURE:
                raise ValueError(
                    "Production configuration failure: SESSION_COOKIE_SECURE must be True in production."
                )

            if self.ENABLE_TEST_AUTH:
                raise ValueError(
                    "Production configuration failure: ENABLE_TEST_AUTH must be False in production."
                )

    def get_public_config(self) -> dict[str, Any]:
        """
        Returns strictly public, safe configuration properties for client presentation.
        Never exposes database credentials, JWT secrets, or internal keys.
        """
        return {
            "app_env": self.APP_ENV,
            "server_name": self.MCP_SERVER_NAME,
            "server_version": self.MCP_SERVER_VERSION,
            "agent_id": self.AGENT_ID,
            "gemini_model": self.GEMINI_MODEL,
            "google_client_id": self.GOOGLE_CLIENT_ID,
            "frontend_url": self.FRONTEND_URL,
            "backend_url": self.BACKEND_URL,
            "allowed_cors_origins": self.ALLOWED_CORS_ORIGINS,
            "csrf_protection_enabled": self.CSRF_PROTECTION_ENABLED,
            "session_cookie_samesite": self.SESSION_COOKIE_SAMESITE,
        }

    def __repr__(self) -> str:
        return (
            f"Settings(app_env={self.APP_ENV!r}, log_level={self.LOG_LEVEL!r}, "
            f"database_url={self.masked_database_url!r}, server={self.MCP_SERVER_NAME!r}, "
            f"agent_id={self.AGENT_ID!r}, gemini_key={self.masked_gemini_api_key!r}, "
            f"google_client_id={self.GOOGLE_CLIENT_ID!r})"
        )


_settings: Settings | None = None


def get_settings() -> Settings:
    """
    Returns the singleton Settings instance.
    Lazy initialization on first call.
    """
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings


def reset_settings_for_testing(new_settings: Settings | None = None) -> None:
    """
    Resets or overrides settings singleton. Used in tests.
    """
    global _settings
    _settings = new_settings


def validate_production_startup(settings: Settings | None = None) -> None:
    """
    Validates production configuration fail-fast rules.
    If settings is None, uses get_settings().
    """
    cfg = settings or get_settings()
    cfg.validate_production_startup()
