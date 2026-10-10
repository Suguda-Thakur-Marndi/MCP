"""
Integration Repository for MCP Sentinel Multi-Software Gateway.
Manages database persistence for integrations, encrypted credentials,
and external/custom MCP servers.
"""

from __future__ import annotations

from typing import Any, Optional

import asyncpg

from mcp_sentinel.connectors.models import (
    ConnectorCredentials,
    IntegrationStatus,
)
from mcp_sentinel.connectors.vault import get_vault
from mcp_sentinel.database.connection import get_db_pool


class IntegrationRepository:
    """
    CRUD repository for integrations, credentials (encrypted at rest),
    and registered MCP servers.
    """

    def __init__(self, pool: Optional[asyncpg.Pool] = None) -> None:
        self._pool = pool
        self._vault = get_vault()

    async def _get_pool(self) -> asyncpg.Pool:
        if self._pool is not None and not self._pool._closed:
            return self._pool
        return await get_db_pool()

    # -------------------------------------------------------------------------
    # Integrations
    # -------------------------------------------------------------------------

    async def list_integrations(self) -> list[dict[str, Any]]:
        pool = await self._get_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT id, name, category, logo, status, auth_type,
                       connection_endpoint, protocol_type, description,
                       is_enabled, created_at, updated_at
                FROM integrations
                ORDER BY name ASC
                """
            )
            return [dict(r) for r in rows]

    async def get_integration(self, integration_id: str) -> Optional[dict[str, Any]]:
        pool = await self._get_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT id, name, category, logo, status, auth_type,
                       connection_endpoint, protocol_type, description,
                       is_enabled, created_at, updated_at
                FROM integrations
                WHERE id = $1
                """,
                integration_id,
            )
            return dict(row) if row else None

    async def update_status(self, integration_id: str, status: IntegrationStatus) -> None:
        pool = await self._get_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE integrations
                SET status = $1, updated_at = NOW()
                WHERE id = $2
                """,
                status.value,
                integration_id,
            )

    async def upsert_integration(
        self,
        integration_id: str,
        name: str,
        category: str,
        logo: str,
        status: str,
        auth_type: str,
        connection_endpoint: str,
        protocol_type: str,
        description: str,
        is_enabled: bool = True,
    ) -> dict[str, Any]:
        pool = await self._get_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO integrations (
                    id, name, category, logo, status, auth_type,
                    connection_endpoint, protocol_type, description, is_enabled
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    category = EXCLUDED.category,
                    logo = EXCLUDED.logo,
                    status = EXCLUDED.status,
                    auth_type = EXCLUDED.auth_type,
                    connection_endpoint = EXCLUDED.connection_endpoint,
                    protocol_type = EXCLUDED.protocol_type,
                    description = EXCLUDED.description,
                    is_enabled = EXCLUDED.is_enabled,
                    updated_at = NOW()
                RETURNING *
                """,
                integration_id,
                name,
                category,
                logo,
                status,
                auth_type,
                connection_endpoint,
                protocol_type,
                description,
                is_enabled,
            )
            return dict(row)

    # -------------------------------------------------------------------------
    # Encrypted Credentials (Never exposed in plaintext to logs/frontend)
    # -------------------------------------------------------------------------

    async def save_credentials(
        self,
        integration_id: str,
        credentials: ConnectorCredentials,
    ) -> None:
        """Encrypts secrets with CredentialVault before storing in database."""
        pool = await self._get_pool()
        enc_access = self._vault.encrypt(credentials.access_token) if credentials.access_token else None
        enc_refresh = self._vault.encrypt(credentials.refresh_token) if credentials.refresh_token else None
        enc_api_key = self._vault.encrypt(credentials.api_key) if credentials.api_key else None

        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO integration_credentials (
                    integration_id, encrypted_access_token, encrypted_refresh_token,
                    encrypted_api_key, token_type, scopes, expires_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (integration_id) DO UPDATE SET
                    encrypted_access_token = EXCLUDED.encrypted_access_token,
                    encrypted_refresh_token = EXCLUDED.encrypted_refresh_token,
                    encrypted_api_key = EXCLUDED.encrypted_api_key,
                    token_type = EXCLUDED.token_type,
                    scopes = EXCLUDED.scopes,
                    expires_at = EXCLUDED.expires_at,
                    updated_at = NOW()
                """,
                integration_id,
                enc_access,
                enc_refresh,
                enc_api_key,
                credentials.token_type,
                credentials.scopes,
                credentials.expires_at,
            )

    async def get_credentials(self, integration_id: str) -> Optional[ConnectorCredentials]:
        """Loads and decrypts credentials for in-memory connector usage."""
        pool = await self._get_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT encrypted_access_token, encrypted_refresh_token,
                       encrypted_api_key, token_type, scopes, expires_at
                FROM integration_credentials
                WHERE integration_id = $1
                """,
                integration_id,
            )
            if not row:
                return None

            access_token = self._vault.decrypt(row["encrypted_access_token"]) if row["encrypted_access_token"] else None
            refresh_token = self._vault.decrypt(row["encrypted_refresh_token"]) if row["encrypted_refresh_token"] else None
            api_key = self._vault.decrypt(row["encrypted_api_key"]) if row["encrypted_api_key"] else None

            return ConnectorCredentials(
                access_token=access_token,
                refresh_token=refresh_token,
                api_key=api_key,
                token_type=row["token_type"],
                scopes=list(row["scopes"]),
                expires_at=row["expires_at"],
            )

    async def delete_credentials(self, integration_id: str) -> None:
        pool = await self._get_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                "DELETE FROM integration_credentials WHERE integration_id = $1",
                integration_id,
            )

    # -------------------------------------------------------------------------
    # MCP Servers
    # -------------------------------------------------------------------------

    async def list_mcp_servers(self) -> list[dict[str, Any]]:
        pool = await self._get_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT id, name, transport, endpoint, status, auth_method,
                       environment, latency_ms, server_version, protocol_version,
                       created_at, last_heartbeat
                FROM mcp_servers
                ORDER BY name ASC
                """
            )
            return [dict(r) for r in rows]

    async def upsert_mcp_server(
        self,
        server_id: str,
        name: str,
        transport: str,
        endpoint: str,
        status: str = "ONLINE",
        auth_method: str = "Bearer Token",
        environment: str = "production",
        latency_ms: int = 0,
        server_version: str = "1.0.0",
        protocol_version: str = "2024-11-05",
    ) -> dict[str, Any]:
        pool = await self._get_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO mcp_servers (
                    id, name, transport, endpoint, status, auth_method,
                    environment, latency_ms, server_version, protocol_version
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    transport = EXCLUDED.transport,
                    endpoint = EXCLUDED.endpoint,
                    status = EXCLUDED.status,
                    auth_method = EXCLUDED.auth_method,
                    environment = EXCLUDED.environment,
                    latency_ms = EXCLUDED.latency_ms,
                    server_version = EXCLUDED.server_version,
                    protocol_version = EXCLUDED.protocol_version,
                    last_heartbeat = NOW()
                RETURNING *
                """,
                server_id,
                name,
                transport,
                endpoint,
                status,
                auth_method,
                environment,
                latency_ms,
                server_version,
                protocol_version,
            )
            return dict(row)
