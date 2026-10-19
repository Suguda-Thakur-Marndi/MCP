# MCP Sentinel — Operational & Verification Scripts

This directory contains database lifecycle management scripts, end-to-end security verification suites, connector test harnesses, and runtime diagnostic tools for MCP Sentinel.

---

## Script Index by Purpose

### 1. Database Lifecycle & Data Management

| Script | Purpose | Execution Command | Requirements |
|---|---|---|---|
| [`init_db.py`](file:///scripts/init_db.py) | Executes all 12 database migrations sequentially (001–012) to provision tables, indices, and least-privilege roles. | `python scripts/init_db.py` | `DATABASE_URL` |
| [`seed_database.py`](file:///scripts/seed_database.py) | Seeds isolated synthetic customer records, mock purchase orders, and administrative audit notes. | `python scripts/seed_database.py` | `DATABASE_URL` |
| [`db_status.py`](file:///scripts/db_status.py) | Inspects active database connectivity and outputs table row counts. | `python scripts/db_status.py` | `DATABASE_URL` |

### 2. End-to-End Security & Integration Verification Suites

| Script | Purpose | Execution Command | Requirements |
|---|---|---|---|
| [`verify_startup.py`](file:///scripts/verify_startup.py) | Multi-component startup probe validating FastMCP server, FastAPI backend, auth, policies, and integrations. | `python scripts/verify_startup.py` | Local or Docker environment |
| [`verify_google_oauth.py`](file:///scripts/verify_google_oauth.py) | Comprehensive 10-point test suite for Google OAuth 2.0 PKCE, OIDC claims, session management, and anti-account-takeover defense. | `python scripts/verify_google_oauth.py` | Isolated (In-memory fallback supported) |
| [`verify_integrations_connections.py`](file:///scripts/verify_integrations_connections.py) | 11-suite end-to-end test of Notion integration token, user-authorized OAuth, Supabase pooler, and credential scrubbing. | `python scripts/verify_integrations_connections.py` | Optional `NOTION_API_KEY` |
| [`verify_notion_security.py`](file:///scripts/verify_notion_security.py) | Validates Notion read tools, UUID formatting, non-existent resource sanitization, read-only capability gating, and zero secret leakage. | `python scripts/verify_notion_security.py` | Live Notion credentials or mock |
| [`verify_notion_write_security.py`](file:///scripts/verify_notion_write_security.py) | 10-point security suite for Notion `archive_page`, validating dual-custody approval, SHA-256 cryptographic binding, and replay rejection. | `python scripts/verify_notion_write_security.py` | None (standalone mock & crypto) |
| [`verify_approval_security_lifecycle.py`](file:///scripts/verify_approval_security_lifecycle.py) | Validates the complete 6-step human-in-the-loop approval lifecycle, segregation of duties, parameter tamper rejection, and HMAC verification. | `python scripts/verify_approval_security_lifecycle.py` | `DATABASE_URL` |
| [`verify_console_flow.py`](file:///scripts/verify_console_flow.py) | Simulates the out-of-band console approval flow: execution halt -> human authorization -> replay prevention. | `python scripts/verify_console_flow.py` | `DATABASE_URL` |
| [`verify_db_permissions.py`](file:///scripts/verify_db_permissions.py) | Verifies least-privilege PostgreSQL roles (`mcp_readonly`, `mcp_writer`, `mcp_destructive`). | `python scripts/verify_db_permissions.py` | `DATABASE_URL` |
| [`verify_live_database_workflows.py`](file:///scripts/verify_live_database_workflows.py) | Validates durable idempotency, live approval consumption, and transactional rollbacks. | `python scripts/verify_live_database_workflows.py` | `DATABASE_URL` |
| [`verify_supabase_connection.py`](file:///scripts/verify_supabase_connection.py) | Validates direct and connection-pooled connectivity to Supabase PostgreSQL over TLS. | `python scripts/verify_supabase_connection.py` | `SUPABASE_DATABASE_URL` |

### 3. Tool Discovery & MCP Server Probes

| Script | Purpose | Execution Command | Requirements |
|---|---|---|---|
| [`manual_mcp_verification.py`](file:///scripts/manual_mcp_verification.py) | Connects to FastMCP server instance, verifies tool schema discovery, structured filtering, and destructive tool blocking. | `python scripts/manual_mcp_verification.py` | `DATABASE_URL` |

---

## Running Verification Suites

All verification scripts are standalone and portable. To execute any verification suite:

```bash
# Verify system startup health
python scripts/verify_startup.py

# Verify Google OAuth 2.0 & PKCE
python scripts/verify_google_oauth.py

# Verify Notion & Supabase connections
python scripts/verify_integrations_connections.py

# Verify Notion write-security & cryptographic binding
python scripts/verify_notion_write_security.py
```
