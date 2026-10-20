# SentinelCore — Operational & Verification Scripts

This directory contains database lifecycle management scripts, production deployment automation, end-to-end security verification suites, and runtime diagnostic tools for SentinelCore.

---

## Directory Organization

```text
scripts/
├── deployment/       # EC2 host setup, manual deployment, and AWS Secrets sync
├── database/         # Schema migrations (001-012), data seeding, and DB health status
└── maintenance/      # Startup verification, OAuth tests, and security harnesses
```

---

## Categorized Script Index

### 1. Deployment Scripts (`scripts/deployment/`)

| Script | Purpose | Preferred Command |
|---|---|---|
| [`deploy_ec2.sh`](file:///scripts/deployment/deploy_ec2.sh) | Production deployment automation: pre-flight checks, compose validation, local container builds, DB pre-checks, and health checks. | `./scripts/deployment/deploy_ec2.sh` |
| [`ec2_setup.sh`](file:///scripts/deployment/ec2_setup.sh) | EC2 host initialization: configures swapfile, installs Docker Engine, Compose plugin, AWS CLI v2. | `sudo bash scripts/deployment/ec2_setup.sh` |
| [`aws_secrets_sync.sh`](file:///scripts/deployment/aws_secrets_sync.sh) | Securely synchronizes secrets from AWS Secrets Manager to host `.env`. | `sudo bash scripts/deployment/aws_secrets_sync.sh` |

### 2. Database Scripts (`scripts/database/`)

| Script | Purpose | Preferred Command |
|---|---|---|
| [`init_db.py`](file:///scripts/database/init_db.py) | Safely applies schema migrations (001–012) sequentially. Supports `--check-only` and `--no-seed`. | `python scripts/database/init_db.py` |
| [`seed_database.py`](file:///scripts/database/seed_database.py) | Seeds synthetic customer, order, and audit note records. | `python scripts/database/seed_database.py` |
| [`db_status.py`](file:///scripts/database/db_status.py) | Checks database connectivity and outputs table row counts. | `python scripts/database/db_status.py` |

### 3. Maintenance & Security Verification Suites (`scripts/maintenance/`)

| Script | Purpose | Preferred Command |
|---|---|---|
| [`verify_startup.py`](file:///scripts/maintenance/verify_startup.py) | Multi-component startup probe validating FastMCP server, FastAPI backend, auth, policies, and integrations. | `python scripts/maintenance/verify_startup.py` |
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

---

## Backward Compatibility Note

All scripts can also be invoked directly from the root `scripts/` directory (e.g. `python scripts/init_db.py`, `python scripts/verify_startup.py`, `./scripts/deploy_ec2.sh`) to ensure existing documentation and operator muscle memory are fully preserved.
