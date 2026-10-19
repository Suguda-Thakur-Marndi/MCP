"""
Centralized Configuration and Secret Management for MCP-Sentinel.
Adheres to Security Rule #5: Never store secrets in source code.
Uses Pydantic Settings for strongly-typed, environment-driven configuration.
"""

import os
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
        env_file=os.environ.get("ENV_FILE", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # Core Database & Real Data Integration Configuration
    DATABASE_URL: Optional[str] = Field(
        default=None,
        description="PostgreSQL DSN string. Single source of truth for database connections.",
    )
    SUPABASE_DATABASE_URL: Optional[str] = Field(
        default=None,
        description="Supabase PostgreSQL connection string (alias/fallback for DATABASE_URL).",
    )
    SUPABASE_URL: Optional[str] = Field(
        default=None,
        description="Supabase project URL (e.g. https://xyz.supabase.co).",
    )
    SUPABASE_ANON_KEY: Optional[str] = Field(
        default=None,
        description="Supabase anonymous API key.",
    )
    SUPABASE_PROJECT_REF: Optional[str] = Field(
        default=None,
        description="Supabase project reference ID.",
    )
    PRODUCTION_DOMAIN: Optional[str] = Field(
        default=None,
        description="Public domain name for production EC2 deployment (e.g. sentinel.yourdomain.com).",
    )
    NOTION_API_KEY: Optional[str] = Field(
        default=None,
        description="Notion workspace integration secret key.",
    )
    NOTION_API_TOKEN: Optional[str] = Field(
        default=None,
        description="Notion workspace integration secret token alias.",
    )
    NOTION_CLIENT_ID: Optional[str] = Field(
        default=None,
        description="Notion OAuth Client ID for user-authorized workspace connections.",
    )
    NOTION_CLIENT_SECRET: Optional[str] = Field(
        default=None,
        description="Notion OAuth Client Secret. Never logged, printed, or exposed.",
    )
    NOTION_REDIRECT_URI: str = Field(
        default="http://localhost:8000/api/integrations/notion/oauth/callback",
        description="Notion OAuth redirect URI callback endpoint.",
    )
    NOTION_WRITE_ENABLED: bool = Field(
        default=False,
        description="Gate for Notion write/destructive capabilities. Defaults to False (read-only).",
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
        default=1,
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
        default=30.0,
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
        ge=0.01,
        le=120.0,
        description="Per-tool call execution timeout in seconds.",
    )
    AGENT_EXECUTION_TIMEOUT_SECONDS: float = Field(
        default=60.0,
        ge=0.01,
        le=300.0,
        description="Upper bound timeout for single agent reasoning turn in seconds.",
    )
    MAX_CONCURRENT_TOOL_EXECUTIONS: int = Field(
        default=20,
        ge=1,
        le=100,
        description="Maximum concurrent tool executions in Gateway to prevent resource exhaustion.",
    )
    MAX_CONCURRENT_AGENT_RUNS: int = Field(
        default=10,
        ge=1,
        le=50,
        description="Maximum concurrent AI agent reasoning runs.",
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
    APPROVAL_HMAC_SECRET: str = Field(
        default="sentinel-approval-hmac-secret-min-32chars",
        description="Cryptographic HMAC secret used to sign and verify Human-in-the-Loop approval tickets.",
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

    @field_validator("ALLOWED_CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Any) -> list[str]:
        if isinstance(v, str):
            v = v.strip()
            if v.startswith("[") and v.endswith("]"):
                import json
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [orig.strip() for orig in v.split(",") if orig.strip()]
        return v

    @field_validator("ALLOWED_GOOGLE_DOMAINS", mode="before")
    @classmethod
    def parse_google_domains(cls, v: Any) -> list[str]:
        if isinstance(v, str):
            v = v.strip()
            if v.startswith("[") and v.endswith("]"):
                import json
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [d.strip() for d in v.split(",") if d.strip()]
        return v

    @model_validator(mode="after")
    def sync_session_and_cors(self) -> "Settings":
        # 1. Establish single source of truth for database connection
        if not self.DATABASE_URL and self.SUPABASE_DATABASE_URL:
            self.DATABASE_URL = self.SUPABASE_DATABASE_URL
        elif self.DATABASE_URL and not self.SUPABASE_DATABASE_URL:
            self.SUPABASE_DATABASE_URL = self.DATABASE_URL

        if not self.DATABASE_URL or not self.DATABASE_URL.strip():
            raise ValueError("DATABASE_URL (or SUPABASE_DATABASE_URL) must be provided.")

        self.DATABASE_URL = self.DATABASE_URL.strip()
        parsed_db = urllib.parse.urlparse(self.DATABASE_URL)
        if parsed_db.scheme not in ("postgresql", "postgres"):
            raise ValueError(
                f"Invalid database scheme '{parsed_db.scheme}'. Must be 'postgresql' or 'postgres'."
            )
        if not parsed_db.hostname:
            raise ValueError("DATABASE_URL must specify a valid hostname.")

        # Ensure sslmode=require is set for Supabase cloud connections if missing
        if (
            ("supabase.co" in (parsed_db.hostname or "") or "supabase.com" in (parsed_db.hostname or ""))
            and "sslmode=" not in (parsed_db.query or "")
        ):
            sep = "&" if parsed_db.query else ""
            new_query = f"{parsed_db.query}{sep}sslmode=require"
            self.DATABASE_URL = urllib.parse.urlunparse(
                (parsed_db.scheme, parsed_db.netloc, parsed_db.path, parsed_db.params, new_query, parsed_db.fragment)
            )
            self.SUPABASE_DATABASE_URL = self.DATABASE_URL

        # 2. Synchronize JWT secret with session secret alias
        if self.SESSION_SECRET:
            default_keys = {
                "sentinel-production-jwt-secret-key-change-me-32chars",
                "change-me-in-production-min-32-chars",
            }
            if not self.JWT_SECRET_KEY or self.JWT_SECRET_KEY in default_keys:
                self.JWT_SECRET_KEY = self.SESSION_SECRET

        # 3. Synchronize Notion tokens
        if not self.NOTION_API_KEY and self.NOTION_API_TOKEN:
            self.NOTION_API_KEY = self.NOTION_API_TOKEN
        if self.NOTION_API_KEY and not self.NOTION_API_TOKEN:
            self.NOTION_API_TOKEN = self.NOTION_API_KEY

        # 4. Propagate PRODUCTION_DOMAIN automatically to URLs and CORS
        if self.PRODUCTION_DOMAIN and self.PRODUCTION_DOMAIN.strip():
            raw_domain = self.PRODUCTION_DOMAIN.strip().replace("http://", "").replace("https://", "").rstrip("/")
            if raw_domain and raw_domain != "sentinel.yourdomain.com":
                https_url = f"https://{raw_domain}"
                if self.FRONTEND_URL in ("http://localhost:3000", "https://sentinel.yourdomain.com"):
                    self.FRONTEND_URL = https_url
                if self.BACKEND_URL in ("http://localhost:8000", "https://sentinel.yourdomain.com"):
                    self.BACKEND_URL = https_url
                if self.GOOGLE_REDIRECT_URI in (
                    "http://localhost:8000/api/auth/google/callback",
                    "https://sentinel.yourdomain.com/api/auth/google/callback",
                ):
                    self.GOOGLE_REDIRECT_URI = f"{https_url}/api/auth/google/callback"
                if self.NOTION_REDIRECT_URI in (
                    "http://localhost:8000/api/integrations/notion/oauth/callback",
                    "https://sentinel.yourdomain.com/api/integrations/notion/oauth/callback",
                ):
                    self.NOTION_REDIRECT_URI = f"{https_url}/api/integrations/notion/oauth/callback"
                if https_url not in self.ALLOWED_CORS_ORIGINS:
                    self.ALLOWED_CORS_ORIGINS.append(https_url)
                if self.APP_ENV == "production":
                    self.SESSION_COOKIE_SECURE = True

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
    def masked_notion_api_key(self) -> str:
        """
        Returns masked representation of the Notion API key.
        Never returns full secret value.
        """
        token = self.NOTION_API_KEY or self.NOTION_API_TOKEN
        if not token:
            return "not_configured"
        if len(token) <= 8:
            return "***"
        return f"{token[:4]}...***"

    @property
    def masked_notion_client_secret(self) -> str:
        """
        Returns masked representation of the Notion OAuth Client Secret.
        Never returns full secret value.
        """
        if not self.NOTION_CLIENT_SECRET:
            return "not_configured"
        if len(self.NOTION_CLIENT_SECRET) <= 8:
            return "***"
        return f"{self.NOTION_CLIENT_SECRET[:4]}...***"

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

    def validate_production_startup(self) -> None:
        """
        Enforces strict fail-fast validation when operating in production.
        Prevents starting the production API with default secrets, test auth,
        wildcard CORS, or insecure cookie configurations.
        """
        if self.APP_ENV in ("production", "staging"):
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
                    f"{self.APP_ENV.capitalize()} configuration failure: JWT_SECRET_KEY must be a strong, non-default string of at least 32 characters."
                )

            if "*" in self.ALLOWED_CORS_ORIGINS:
                raise ValueError(
                    f"{self.APP_ENV.capitalize()} configuration failure: Wildcard origin '*' is forbidden in ALLOWED_CORS_ORIGINS when credentials are enabled."
                )

            if self.APP_ENV == "production" and not self.SESSION_COOKIE_SECURE:
                raise ValueError(
                    "Production configuration failure: SESSION_COOKIE_SECURE must be True in production."
                )

            if self.ENABLE_TEST_AUTH:
                raise ValueError(
                    f"{self.APP_ENV.capitalize()} configuration failure: ENABLE_TEST_AUTH must be False in {self.APP_ENV}."
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
