# Maintenance & Verification Scripts (`scripts/maintenance/`)

This directory contains standalone security test harnesses, verification suites, and diagnostic tools for MCP Sentinel.

## Verification Suites Index

| Script | Purpose | Execution Command |
|---|---|---|
| [`verify_startup.py`](file:///scripts/maintenance/verify_startup.py) | Comprehensive 10-point startup probe validating FastMCP server, FastAPI backend, auth, policies, and integrations. | `python scripts/maintenance/verify_startup.py` |
| [`verify_google_oauth.py`](file:///scripts/maintenance/verify_google_oauth.py) | 10-point test suite for Google OAuth 2.0 PKCE, OIDC claims, session management, and anti-account-takeover defense. | `python scripts/maintenance/verify_google_oauth.py` |
| [`verify_integrations_connections.py`](file:///scripts/maintenance/verify_integrations_connections.py) | 11-suite end-to-end test of Notion integration token, user-authorized OAuth, Supabase pooler, and credential scrubbing. | `python scripts/maintenance/verify_integrations_connections.py` |
| [`verify_notion_security.py`](file:///scripts/maintenance/verify_notion_security.py) | Validates Notion read tools, UUID formatting, non-existent resource sanitization, read-only capability gating, and zero secret leakage. | `python scripts/maintenance/verify_notion_security.py` |
| [`verify_notion_write_security.py`](file:///scripts/maintenance/verify_notion_write_security.py) | 10-point security suite for Notion `archive_page`, validating dual-custody approval, SHA-256 cryptographic binding, and replay rejection. | `python scripts/maintenance/verify_notion_write_security.py` |
| [`verify_approval_security_lifecycle.py`](file:///scripts/maintenance/verify_approval_security_lifecycle.py) | Validates the complete 6-step human-in-the-loop approval lifecycle, segregation of duties, parameter tamper rejection, and HMAC verification. | `python scripts/maintenance/verify_approval_security_lifecycle.py` |
| [`verify_console_flow.py`](file:///scripts/maintenance/verify_console_flow.py) | Simulates the out-of-band console approval flow: execution halt -> human authorization -> replay prevention. | `python scripts/maintenance/verify_console_flow.py` |
| [`verify_db_permissions.py`](file:///scripts/maintenance/verify_db_permissions.py) | Verifies least-privilege PostgreSQL roles (`mcp_readonly`, `mcp_writer`, `mcp_destructive`). | `python scripts/maintenance/verify_db_permissions.py` |
| [`verify_live_database_workflows.py`](file:///scripts/maintenance/verify_live_database_workflows.py) | Validates durable idempotency, live approval consumption, and transactional rollbacks. | `python scripts/maintenance/verify_live_database_workflows.py` |
| [`verify_supabase_connection.py`](file:///scripts/maintenance/verify_supabase_connection.py) | Validates direct and connection-pooled connectivity to Supabase PostgreSQL over TLS. | `python scripts/maintenance/verify_supabase_connection.py` |
| [`manual_mcp_verification.py`](file:///scripts/maintenance/manual_mcp_verification.py) | Connects to FastMCP server instance, verifies tool schema discovery, structured filtering, and destructive tool blocking. | `python scripts/maintenance/manual_mcp_verification.py` |

> [!NOTE]
> Backward-compatible execution from repository root via `python scripts/verify_*.py` is fully preserved.
