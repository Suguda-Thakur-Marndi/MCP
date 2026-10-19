# MCP Sentinel — Enterprise Security Gateway & Gated MCP Runtime

[![FastMCP](https://img.shields.io/badge/FastMCP-v4.0+-blue.svg)](https://github.com/jlowin/fastmcp)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-16.3-black.svg)](https://nextjs.org)
[![Python](https://img.shields.io/badge/Python-3.12%20%7C%203.13-3776AB.svg)](https://python.org)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

**MCP Sentinel** is a production-hardened Security Gateway, Governance Proxy, and Tool Execution Runtime built for the [Model Context Protocol (MCP)](https://modelcontextprotocol.io). It establishes a zero-trust boundary between autonomous AI agents and enterprise production systems (PostgreSQL, Supabase, Notion), enforcing deterministic policy evaluation, cryptographic parameter binding, and out-of-band Human-in-the-Loop (HITL) approval gating before any destructive or high-risk mutation can occur.

---

## Key Capabilities & Security Invariants

- **Zero-Trust Agent Boundary**: Client annotations, agent prompts, and self-supplied security claims (`is_admin=True`, `decision="ALLOW"`, `risk_score=0`) are discarded and ignored. All authorizations are strictly evaluated server-side.
- **Cryptographic Parameter Binding**: Destructive operations stage an approval ticket cryptographically bound to `SHA-256(canonical_json(parameters))`. An approval granted for arguments $A$ strictly rejects modified arguments $B$.
- **Anti-Replay & Single-Use Gating**: Every approval ticket requires a valid HMAC-SHA256 signature and undergoes atomic, transactional consumption. Replay attacks are halted and logged.
- **Segregation of Duties**: Requesters cannot approve their own tickets. The agent cannot grant authorizations, and human approvers must hold the `approvals:approve_destructive` RBAC permission.
- **Zero Credential Exposure**: Automatic scrubbing of database passwords, Notion API tokens (`ntn_...`, `secret_...`), AWS access keys (`AKIA...`), and JWT bearer tokens from all logs, error messages, and API responses.
- **Multi-Software Tool Routing**: Canonical gateway for Notion API (pages, databases, and approval-gated page archiving) and Supabase PostgreSQL with pooled TLS connections.
- **Dark Observatory Web Console**: Real-time operational security console built with Next.js 16 (Turbopack), Tailwind CSS, and Lucide icons for reviewing pending tickets, inspecting audit trails, managing integrations, and monitoring pool health.

---

## System Architecture

```mermaid
graph TD
    subgraph AI Client Layer
        LLM[AI Agent / Claude Desktop / Cursor]
    end

    subgraph Security Boundary
        MCP[FastMCP Server : stdio / sse<br/><code>mcp_sentinel/server/app.py</code>]
        Gate[SecurityGate Middleware<br/><code>mcp_sentinel/security/middleware.py</code>]
        Policy[Policy & Risk Engine<br/><code>mcp_sentinel/security/policy/engine.py</code>]
    end

    subgraph Human Authorization Escrow
        API[FastAPI Security Backend : 8000<br/><code>mcp_sentinel/api/app.py</code>]
        Console[Next.js Security Console : 3000<br/><code>web/</code>]
        Human((Security Officer))
    end

    subgraph Enterprise Backends
        PG[(PostgreSQL / Supabase)]
        Notion[(Notion Official API)]
    end

    LLM -->|Invokes Tool| MCP
    MCP --> Gate
    Gate --> Policy
    Policy -->|Read / Low Risk| PG
    Policy -->|Destructive / Critical Risk| API
    API --> Console
    Console --> Human
    Human -->|Authorizes Ticket| API
    API -->|Signed Ticket HMAC| LLM
    LLM -->|Retries with Ticket| MCP
    MCP -->|Verifies & Consumes Ticket| PG
    MCP -->|Notion Operations| Notion
```

---

## Canonical Entry Points

| Service | Canonical Entry Point | Default Port | Transport / Protocol |
|---|---|---|---|
| **FastAPI REST API** | [`mcp_sentinel.api.app:app`](file:///mcp_sentinel/api/app.py) | `8000` | HTTP / JSON REST |
| **FastMCP Gateway** | [`mcp_sentinel.server.app`](file:///mcp_sentinel/server/app.py) | N/A | `stdio` (default) or `sse` |
| **Next.js Security Console** | [`web/`](file:///web) | `3000` | HTTP / Web Console |

---

## Repository Structure

```
.
├── mcp_sentinel/              # Canonical Backend Python Package
│   ├── api/                   # FastAPI application & route controllers
│   │   ├── app.py             # Root FastAPI application & lifecycle
│   │   └── routers/           # Sub-routers (approvals, audit, auth, health, integrations, tools)
│   ├── config/                # Centralized settings & secrets management
│   │   ├── secrets.py         # Secret masking and credential isolation
│   │   └── settings.py        # Strongly typed Pydantic application settings
│   ├── connectors/            # External enterprise software connectors
│   │   ├── base.py            # Base connector abstraction
│   │   ├── models.py          # Connector models, credentials, and statuses
│   │   ├── notion.py          # Notion REST API connector (4 tools)
│   │   ├── registry.py        # Central connector discovery & lifecycle registry
│   │   ├── supabase.py        # Supabase PostgreSQL pool connector
│   │   └── vault.py           # Encrypted local credential vault
│   ├── database/              # PostgreSQL schema, pool, and migrations
│   │   ├── connection.py      # Async connection pooling (asyncpg)
│   │   ├── migrations/        # 12 sequential schema migrations (001–012)
│   │   └── seed/              # Synthetic seed data
│   ├── observability/         # Metrics and distributed tracing
│   │   ├── metrics.py         # Prometheus application metrics
│   │   └── tracing.py         # OpenTelemetry tracing
│   ├── repositories/          # Database access repositories
│   │   ├── approval_repository.py
│   │   ├── audit_repository.py
│   │   ├── customer_repository.py
│   │   ├── idempotency_repository.py
│   │   ├── integration_repository.py
│   │   ├── order_repository.py
│   │   ├── session_repository.py
│   │   ├── tool_repository.py
│   │   └── user_repository.py
│   ├── schemas/               # Pydantic validation schemas
│   │   ├── approval.py        # Approval requests, state machines, and parameter hashing
│   │   ├── audit.py           # Audit events and query schemas
│   │   ├── common.py          # Common enums and pagination models
│   │   ├── customer.py        # Customer filters and projection models
│   │   └── order.py           # Purchase order schemas
│   ├── security/              # Security gateway, authentication, and policy engine
│   │   ├── audit_logger.py    # Structured audit logging & credential scrubbing
│   │   ├── correlation.py     # Request and trace correlation propagation
│   │   ├── exceptions.py      # Authoritative security exceptions
│   │   ├── gating.py          # Dual-custody approval gating logic
│   │   ├── headers.py         # Security headers middleware
│   │   ├── middleware.py      # SecurityGate evaluation middleware
│   │   ├── rate_limiter.py    # Token-bucket rate limiter middleware
│   │   ├── auth/              # RBAC, ABAC, OIDC, and JWT handlers
│   │   ├── decisions/         # Decision and risk tier models
│   │   ├── policy/            # Authoritative policy engine, rules, and evaluator
│   │   └── risk/              # Deterministic risk scoring engine & factors
│   ├── server/                # Canonical FastMCP server
│   │   └── app.py             # 12 registered enterprise tools, resources, and prompts
│   ├── services/              # Business logic services
│   └── tools/                 # Tool handlers, schemas, and implementations
├── tests/                     # Automated Test Suite (Pytest)
│   ├── conftest.py            # Test fixtures and isolated test environment setup
│   └── unit/                  # Component-organized unit tests
│       ├── test_approval_crypto.py
│       ├── test_audit_logger.py
│       ├── test_auth_rbac.py
│       ├── test_connectors.py
│       ├── test_mcp_tools.py
│       ├── test_policy_engine.py
│       └── test_risk_engine.py
├── scripts/                   # Operational and verification test harnesses
│   ├── README.md              # Detailed guide for all 14 operational scripts
│   ├── init_db.py             # Schema migration runner
│   ├── seed_database.py       # Test data seeder
│   └── verify_*.py            # End-to-end security & integration verification suites
├── web/                       # Dark Observatory Security Console (Next.js 16)
│   ├── app/                   # App Router pages and layouts
│   ├── components/            # Reusable UI and layout components
│   ├── hooks/                 # React data-fetching hooks (useAuth, useApiQuery)
│   ├── lib/                   # API client and formatting utilities
│   ├── types/                 # Shared TypeScript interfaces & types
│   └── Dockerfile             # Multi-stage production container for frontend
├── docker/                    # Docker infrastructure
│   ├── Dockerfile             # FastMCP runtime container
│   └── Dockerfile.api         # FastAPI backend container
├── monitoring/                # Observability configuration (Prometheus & Grafana)
├── .env.example               # Root environment configuration template
├── docker-compose.yml         # Production multi-container composition
└── pyproject.toml             # Python packaging and tool configuration
```

---

## Getting Started

### 1. Prerequisites

- **Python**: `>= 3.10` (Tested on Python 3.12 and 3.13)
- **Node.js**: `>= 20.0`
- **PostgreSQL**: `16+` (or Supabase project)
- **Docker & Docker Compose** (optional for containerized deployment)

### 2. Environment Configuration

Copy the template configuration file:

```bash
cp .env.example .env
```

Review `.env` and set your credentials. All secrets are pre-configured with secure development placeholders. **Never commit real credentials to source control.**

### 3. Backend Setup

```bash
# Create and activate Python virtual environment
python -m venv .venv
source .venv/bin/activate       # On Linux/macOS
.venv\Scripts\activate          # On Windows

# Install dependencies (including dev and test packages)
pip install -r requirements.txt

# Initialize database schema and migrations
python scripts/init_db.py

# Seed synthetic test records
python scripts/seed_database.py
```

### 4. Running Backend Services

**Start FastAPI REST Gateway (Port 8000):**
```bash
python -m uvicorn mcp_sentinel.api.app:app --host 0.0.0.0 --port 8000 --reload
```

**Start FastMCP Server (stdio mode for AI agents):**
```bash
python -m mcp_sentinel.server.app
```

### 5. Frontend Console Setup

```bash
cd web
npm install
npm run dev
```

Navigate to `http://localhost:3000` to open the Dark Observatory Security Console.

---

## Claude Desktop & Cursor Integration

To connect Claude Desktop or Cursor to MCP Sentinel, configure your MCP client configuration:

**`claude_desktop_config.json`:**
```json
{
  "mcpServers": {
    "mcp-sentinel": {
      "command": "/path/to/.venv/bin/python",
      "args": ["-m", "mcp_sentinel.server.app"],
      "cwd": "/path/to/mcp-sentinel",
      "env": {
        "DATABASE_URL": "postgresql://postgres:postgres@localhost:5432/mcp_sentinel_db",
        "APP_ENV": "development",
        "LOG_LEVEL": "INFO"
      }
    }
  }
}
```

---

## Automated Testing & Quality Assurance

### Run Unit Test Suite (Pytest)

The test suite covers policy evaluation, risk scoring, RBAC permissions, JWT validation, cryptographic parameter hashing, HMAC signatures, secret redaction, and tool inventories:

```bash
pytest -v
```

### Run Python Linting & Formatting Check (Ruff)

```bash
ruff check mcp_sentinel/ scripts/ tests/
ruff format --check mcp_sentinel/ scripts/ tests/
```

### Run Frontend Lint & Build Checks

```bash
cd web
npm run lint
npm run type-check
npm run build
```

### Run End-to-End Security Verification Suites

MCP Sentinel provides standalone verification suites:

```bash
# Component startup verification
python scripts/verify_startup.py

# Google OAuth 2.0 PKCE and OIDC verification
python scripts/verify_google_oauth.py

# Notion & Supabase integration connection verification
python scripts/verify_integrations_connections.py

# Notion write-security & dual-custody approval verification
python scripts/verify_notion_write_security.py
```

---

---

## Containerized Deployment & Environments

MCP Sentinel supports both local multi-container development and automated AWS production deployment:

### 1. Local Development Stack (Docker Compose)
Spins up the FastAPI API, Next.js Web Console, and an isolated local PostgreSQL 16 container:
```bash
docker compose up --build
```
- **`sentinel-postgres`**: PostgreSQL 16 on internal loopback `127.0.0.1:5432` (`sentinel-net`).
- **`sentinel-api`**: FastAPI backend on port `8000` with `/health/live` probe.
- **`sentinel-web`**: Next.js console on port `3000`.

### 2. Production Deployment (AWS EC2 & External Supabase)
In production, PostgreSQL is hosted externally on Supabase (connecting over TLS). Services are built and run directly on the EC2 host via Docker Compose:
```bash
# Build production images locally from source
docker compose -f docker-compose.prod.yml build

# Start production services in detached mode
docker compose -f docker-compose.prod.yml up -d --remove-orphans
```

---

## Manual Production Deployment on AWS EC2

MCP Sentinel is deployed manually on AWS EC2 Ubuntu instances using SSH, Git, and Docker Compose without automated CI/CD dependencies:

```
[Developer / Operator] ──(SSH)──> [AWS EC2 Ubuntu Host]
                                           │
                                     git pull origin main
                                           │
                               docker compose -f docker-compose.prod.yml build
                                           │
                               docker compose -f docker-compose.prod.yml up -d
                                           │
                             ┌─────────────┴─────────────┐
                             v                           v
                  [sentinel-api: 8000]        [sentinel-web: 3000]
                             │                           │
                             └─────────────┬─────────────┘
                                           v
                                [Optional Caddy Proxy: 443]
                                           │
                                           v
                               [External Supabase (TLS)]
```

For step-by-step instructions—including instance initialization, host `.env` configuration, health verification, rollbacks, and Caddy TLS setup—see the [Manual EC2 Deployment Guide](file:///docs/MANUAL_EC2_DEPLOYMENT.md).

---

## Preserved Integrations & Security Controls

1. **Notion Official API Integration**:
   - Tools: `search_pages`, `get_page`, `query_database`, and `archive_page`.
   - Least privilege: Defaults to read-only (`NOTION_WRITE_ENABLED=false`).
   - `archive_page` strictly mandates verified dual-custody approval.
2. **Supabase PostgreSQL Engine**:
   - TLS-enforced connection pooling with bounded limits.
   - Least-privilege roles: `mcp_readonly`, `mcp_writer`, `mcp_destructive`.
3. **Google OAuth 2.0 / OIDC Identity**:
   - RFC 7636 PKCE ($S256$) with encrypted HMAC state tokens.
   - HttpOnly, SameSite session cookies.
   - Anti-account-takeover defense preventing unsafe cross-provider email linking.
4. **Authoritative Policy & Risk Engine**:
   - 9 built-in security rules (`RULE-001` through `RULE-009`).
   - 4 risk tiers: `LOW` ($\le 24$), `MEDIUM` ($25-49$), `HIGH` ($50-74$), `CRITICAL` ($75-100$).
5. **Auditing & Telemetry**:
   - Immutable audit log repository with request and trace correlation IDs.
   - Real-time Prometheus metrics endpoint at `/metrics`.

---

## License

This project is licensed under the Apache License 2.0. See [LICENSE](LICENSE) for details.
