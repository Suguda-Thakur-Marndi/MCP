"""
Secure Credential Vault for Multi-Software MCP Gateway.
Provides Fernet symmetric encryption and decryption for sensitive tokens at rest.
Never logs or exposes plaintext secrets.
"""

from __future__ import annotations

import base64
import hashlib
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken

from mcp_sentinel.config.settings import get_settings


class CredentialVault:
    """
    Encrypts and decrypts OAuth tokens, refresh tokens, client secrets,
    and API keys before persisting to the database.
    """

    def __init__(self, secret_key: Optional[str] = None) -> None:
        if not secret_key:
            settings = get_settings()
            secret_key = settings.JWT_SECRET_KEY

        # Derive a deterministic 32-byte URL-safe base64 key using SHA256
        key_digest = hashlib.sha256(secret_key.encode("utf-8")).digest()
        self._fernet_key = base64.urlsafe_b64encode(key_digest)
        self._fernet = Fernet(self._fernet_key)

    def encrypt(self, plaintext: str) -> str:
        """Encrypts a plaintext secret into an ASCII ciphertext string."""
        if not plaintext:
            return ""
        encrypted_bytes = self._fernet.encrypt(plaintext.encode("utf-8"))
        return encrypted_bytes.decode("ascii")

    def decrypt(self, ciphertext: str) -> str:
        """Decrypts an ASCII ciphertext string into plaintext."""
        if not ciphertext:
            return ""
        try:
            decrypted_bytes = self._fernet.decrypt(ciphertext.encode("ascii"))
            return decrypted_bytes.decode("utf-8")
        except InvalidToken:
            raise ValueError("Decryption failed: invalid ciphertext or corrupted key")

    @staticmethod
    def mask_secret(secret: Optional[str], visible_chars: int = 4) -> str:
        """
        Safely masks a secret for display in UI/logs.
        Example: 'ghp_abc123456789xyz' -> 'ghp_...9xyz'
        """
        if not secret:
            return "[NONE]"
        clean = secret.strip()
        if len(clean) <= visible_chars * 2:
            return "●●●●●●●●"
        return f"{clean[:visible_chars]}...{clean[-visible_chars:]}"


# Global singleton instance
_default_vault: Optional[CredentialVault] = None


def get_vault() -> CredentialVault:
    global _default_vault
    if _default_vault is None:
        _default_vault = CredentialVault()
    return _default_vault
