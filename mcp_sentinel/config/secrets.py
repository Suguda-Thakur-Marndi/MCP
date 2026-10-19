"""
Production Secret Management Abstraction for MCP-Sentinel.
Provides a unified interface for loading secrets from environment variables (local/test)
or AWS Secrets Manager (production) using IAM role / Workload Identity.
Zero secrets are logged or printed during startup.
"""

import json
import logging
import os
from abc import ABC, abstractmethod
from typing import Any, Optional

logger = logging.getLogger("mcp_sentinel.config.secrets")


class SecretProvider(ABC):
    """Abstract base class for secret resolution."""

    @abstractmethod
    def get_secret(self, key: str, default: Optional[str] = None) -> Optional[str]:
        """Retrieves a single secret value by key."""
        pass

    @abstractmethod
    def get_secret_dict(self, secret_id: str) -> dict[str, Any]:
        """Retrieves and parses a JSON-formatted secret payload."""
        pass


class EnvSecretProvider(SecretProvider):
    """Resolves secrets from standard environment variables (development, staging, test)."""

    def get_secret(self, key: str, default: Optional[str] = None) -> Optional[str]:
        return os.environ.get(key, default)

    def get_secret_dict(self, secret_id: str) -> dict[str, Any]:
        val = os.environ.get(secret_id)
        if not val:
            return {}
        try:
            return json.loads(val)
        except Exception:
            return {}


class AWSSecretsManagerProvider(SecretProvider):
    """
    Resolves secrets from AWS Secrets Manager using IAM role / Workload Identity.
    Does NOT require hard-coded AWS credentials.
    Gracefully degrades to environment variables if boto3 is not installed or service is unreachable.
    """

    def __init__(self, region_name: Optional[str] = None, client: Any = None):
        self._region = region_name or os.environ.get("AWS_REGION", "us-east-1")
        self._cache: dict[str, Any] = {}
        self._client: Any = client
        self._initialized = client is not None

    def _get_client(self) -> Any:
        if not self._initialized:
            try:
                import boto3  # Optional AWS SDK
                from botocore.config import Config

                boto_config = Config(
                    connect_timeout=5,
                    read_timeout=5,
                    retries={"max_attempts": 2, "mode": "standard"},
                )
                self._client = boto3.client(
                    "secretsmanager", region_name=self._region, config=boto_config
                )
            except ImportError:
                logger.info("boto3 not installed; AWSSecretsManagerProvider will use env fallback.")
                self._client = None
            except Exception as exc:
                logger.warning(
                    "Failed to initialize AWS Secrets Manager client (%s); using env fallback.", exc
                )
                self._client = None
            self._initialized = True
        return self._client

    def get_secret(self, key: str, default: Optional[str] = None) -> Optional[str]:
        # Check in-memory cache
        if key in self._cache:
            return self._cache[key]

        client = self._get_client()
        if client is not None:
            try:
                resp = client.get_secret_value(SecretId=key)
                secret_val = resp.get("SecretString", default)
                self._cache[key] = secret_val
                return secret_val
            except Exception as exc:
                logger.debug(
                    "AWS Secrets Manager lookup failed for '%s' (%s); falling back to env.",
                    key,
                    exc,
                )

        # Fallback to environment variable
        val = os.environ.get(key, default)
        self._cache[key] = val
        return val

    def get_secret_dict(self, secret_id: str) -> dict[str, Any]:
        if secret_id in self._cache and isinstance(self._cache[secret_id], dict):
            return self._cache[secret_id]

        raw = self.get_secret(secret_id)
        if not raw:
            return {}
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                self._cache[secret_id] = parsed
                return parsed
        except Exception:
            pass
        return {}


# Module singleton
_provider: Optional[SecretProvider] = None


def get_secret_provider() -> SecretProvider:
    """Returns the configured SecretProvider singleton."""
    global _provider
    if _provider is None:
        use_aws = os.environ.get("USE_AWS_SECRETS_MANAGER", "false").lower() in ("true", "1")
        if use_aws:
            _provider = AWSSecretsManagerProvider()
        else:
            _provider = EnvSecretProvider()
    return _provider


def set_secret_provider_for_testing(provider: Optional[SecretProvider]) -> None:
    """Overrides the secret provider singleton for testing."""
    global _provider
    _provider = provider
