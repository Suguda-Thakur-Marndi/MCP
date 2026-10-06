# MCP-Sentinel

> **Enterprise-Grade Secure Model Context Protocol (MCP) Server with Real PostgreSQL Data, Cryptographic Human-in-the-Loop Gating, and AI Client Compatibility**

[![CI/CD](https://github.com/mcp-sentinel/mcp-sentinel/actions/workflows/ci.yml/badge.svg)](.github/workflows/ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Python 3.12+](https://img.shields.io/badge/python-3.12%2B-blue.svg)](https://www.python.org/)
[![Model Context Protocol](https://img.shields.io/badge/MCP-Standard%20JSON--RPC-blue.svg)](https://modelcontextprotocol.io/)
[![FastMCP](https://img.shields.io/badge/FastMCP-4.0%2B-green.svg)](https://github.com/jlowin/fastmcp)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16%2F18-336791.svg)](https://www.postgresql.org/)
[![Tests Passing](https://img.shields.io/badge/Pytest-446%20Passed%2C%200%20Failed-brightgreen.svg)](tests/)

---

## 1. What the Project Is

**MCP-Sentinel is a secure Model Context Protocol (MCP) server first.**

Its primary purpose is to expose controlled access to **REAL DATA SOURCES** (relational PostgreSQL enterprise customer and order records) and governed business tools to AI clients (such as **Claude Desktop**, **Cursor**, and compliant MCP agents), while maintaining strict **Human-in-the-Loop (HITL) authorization gating** over all destructive or sensitive mutations.

It is **NOT** a standalone chatbot, a generic SaaS mock platform, or an insecure prompt wrapper. It is a hardened protocol server implementing defense-in-depth across every layer: zero trust, no raw SQL execution, parameterized query enforcement, untrusted prompt injection tagging, cryptographic SHA-256 parameter binding, and tamper-proof audit trails.

---

## 2. Why MCP is Used

The Model Context Protocol (MCP) is the industry standard protocol enabling Large Language Models (LLMs) to discover and interact with external data and execution tools in a structured, typed, and vendor-neutral manner.

By implementing an authoritative MCP server:
- AI clients such as Claude Desktop and Cursor automatically discover tools (`tools/list`), data schemas (`resources/list`), and operational prompts (`prompts/list`).
- The LLM reasoning engine is decoupled from database persistence.
- The server itself acts as the authoritative security enforcement point: client hints are never trusted, and dangerous actions are halted before touching database tables.

---

## 3. System Architecture & Project Boundary

```
                     AI CLIENTS
               ┌──────────┴──────────┐
               ↓                     ↓
        Claude Desktop             Cursor
               │                     │
               └──────────┬──────────┘
                          ↓
               MODEL CONTEXT PROTOCOL
               (stdio / stream-http)
                          ↓
                  ┌───────────────┐
                  │  MCP SERVER   │
                  │  (FastMCP)    │
                  │               │
                  │ • Tools       │
                  │ • Resources   │
                  │ • Prompts     │
                  │ • Validation  │
                  │ • Permissions │
                  └───────┬───────┘
                          │
               ┌──────────┴──────────┐
               ↓                     ↓
          READ OPERATIONS       WRITE / DESTRUCTIVE
               │                     │
               │               HUMAN-IN-THE-LOOP
               │               APPROVAL GATING
               │                     │
               └──────────┬──────────┘
                          ↓
                  REAL DATA SOURCES
               ┌──────────┼──────────┐
               ↓                     ↓
          PostgreSQL 16/18       External Connectors
          (Customers/Orders)     (GitHub/Slack/Drive)*
```
*\*External SaaS connectors are implemented for OAuth/API integrations but require user-provided credentials.*

---

## 4. Supported AI Clients

| Client | Transport | Tool Discovery | Resource Reading | Prompt Execution | Supported |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Claude Desktop** | `stdio` (JSON-RPC) | Yes (`tools/list`) | Yes (`resources/list`) | Yes (`prompts/list`) | ✅ Native |
| **Cursor IDE** | `stdio` / `sse` | Yes (`tools/list`) | Yes (`resources/list`) | Yes (`prompts/list`) | ✅ Native |
| **Custom MCP Clients** | `stdio` / `stream-http` | Yes | Yes | Yes | ✅ Standard |

---

## 5. MCP Tool Catalog

Every tool is exposed through the MCP protocol with strict Pydantic parameter schemas, input sanitation, and server-side policy evaluation:

| Tool | Operation | Risk Level | Data Source | Auth Required | HITL Approval Required | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `query_customer_records` | Structured parameterized filter & pagination | LOW | PostgreSQL | Yes | No | **IMPLEMENTED (Real)** |
| `get_customer` | Single customer profile lookup | LOW | PostgreSQL | Yes | No | **IMPLEMENTED (Real)** |
| `get_customer_orders` | Customer order history pagination | LOW | PostgreSQL | Yes | No | **IMPLEMENTED (Real)** |
| `get_order` | Single order transaction lookup | LOW | PostgreSQL | Yes | No | **IMPLEMENTED (Real)** |
| `append_customer_audit_note` | Administrative note append (passive) | MEDIUM | PostgreSQL | Yes | No | **IMPLEMENTED (Real)** |
| `update_customer` | Allowlisted field updates (`status`, `country`) | MEDIUM | PostgreSQL | Yes | No | **IMPLEMENTED (Real)** |
| `delete_customer` | Permanent customer deletion | CRITICAL | PostgreSQL | Yes | **YES (Mandatory Ticket)** | **IMPLEMENTED (Real)** |
| `purge_inactive_customer_data` | Dormant account retention purge | CRITICAL | PostgreSQL | Yes | **YES (Mandatory Ticket)** | **IMPLEMENTED (Real)** |

---

## 6. MCP Resources

The MCP server exposes real, structured data schemas and active governance policies as standard MCP resources:

| Resource URI | MIME Type | Description | Status |
| :--- | :--- | :--- | :--- |
| `schema://customers` | `application/json` | Read-only schema projection, allowed filter keys, and status enums for customer records | **IMPLEMENTED** |
| `schema://orders` | `application/json` | Read-only schema projection and transaction fields for purchase orders | **IMPLEMENTED** |
| `security://policy` | `application/json` | Authoritative security policies, principles, risk tiers, and approval requirements | **IMPLEMENTED** |

---

## 7. MCP Prompts

The MCP server provides operational templates pre-configured with prompt injection boundaries:

| Prompt Name | Required Arguments | Purpose | Status |
| :--- | :--- | :--- | :--- |
| `customer_investigation_brief` | `customer_id` | Guides AI clients to look up customer profile and order history while enforcing untrusted data delimiters | **IMPLEMENTED** |
| `destructive_operation_approval_request` | `tool_name`, `target_id`, `reason` | Guides AI clients to format and stage a Human-in-the-Loop approval request before attempting deletion | **IMPLEMENTED** |

---

## 8. Real Data Sources & Implementation Status

| Data Source | Type | Real / Mock | Working | Connection Details | Current Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **PostgreSQL 16/18** | Relational Database | **REAL** | **YES** | Local instance via `asyncpg` connection pool with ACID guarantees | **IMPLEMENTED** |
| **GitHub REST API** | Developer Platform | Real Connector Code | Unconfigured | `https://api.github.com` (Requires user OAuth token / PAT in `.env`) | **IMPLEMENTED BUT UNCONFIGURED** |
| **Slack Web API** | Messaging Platform | Real Connector Code | Unconfigured | `https://slack.com/api` (Requires Bot Token `xoxb-...`) | **IMPLEMENTED BUT UNCONFIGURED** |
| **Google Drive v3** | Cloud Storage | Real Connector Code | Unconfigured | `https://www.googleapis.com/drive/v3` (Requires OAuth 2.0 Token) | **IMPLEMENTED BUT UNCONFIGURED** |
| **Canva Remote MCP** | Design Platform | Real Connector Code | Unconfigured | `https://mcp.canva.com/mcp` (Requires Canva Developer Token) | **IMPLEMENTED BUT UNCONFIGURED** |
| **Notion** | Workspace Notes | None | No | Not present in codebase | **NOT IMPLEMENTED** |
| **Supabase** | Cloud Postgres/BaaS | None | No | Not present in codebase | **NOT IMPLEMENTED** |

---

## 9. Human-in-the-Loop (HITL) Gating Lifecycle

Sensitive and destructive actions (`delete_customer`, `purge_inactive_customer_data`) CANNOT be executed autonomously by any AI client.

```
AI CLIENT (Claude / Cursor)
    │
    ├─► Call `delete_customer(customer_id="CUST-000001", approval_ticket=None)`
    │
MCP SERVER (SecurityGate)
    │
    ├─► Intercepted: Operation is DESTRUCTIVE (Risk Score: 70+)
    ├─► Create `approval_requests` entry in PostgreSQL:
    │     • ticket_id: Cryptographically random token (e.g. `TICKET-DELETE_CUSTOMER-...`)
    │     • parameter_hash: SHA-256(canonical JSON of parameters)
    │     • status: PENDING
    │     • expires_at: NOW + 3600 seconds
    │
    └─► Return: `{"status": "rejected", "approval_required": true, "ticket_id": "TICKET-..."}`
        [Zero database changes occur]

HUMAN OPERATOR
    │
    ├─► Reviews parameters, risk score, and justification
    └─► Approves ticket: status -> APPROVED (via Security Console or ApprovalService)

AI CLIENT (Claude / Cursor)
    │
    ├─► Retry with ticket: `delete_customer(customer_id="CUST-000001", approval_ticket="TICKET-...")`
    │
MCP SERVER (SecurityGate & Service)
    │
    ├─► Validates ticket is APPROVED
    ├─► Re-computes SHA-256 of parameters (detects parameter tampering post-approval)
    ├─► Validates target_id, tool_name, and environment
    ├─► Atomically marks ticket: APPROVED -> EXECUTING -> COMPLETED
    ├─► Executes parameterized SQL DELETE in PostgreSQL
    ├─► Records audit event in `audit_events`
    └─► Return: `{"status": "success", "deleted_count": 1}`

REPLAY ATTEMPT
    │
    └─► Attempting to reuse ticket is instantly BLOCKED (Ticket status == COMPLETED)
```

---

## 10. Security Model & Defensive Guardrails

- **Zero Raw SQL Tools**: Absolutely no `execute_sql`, `run_query`, or raw query concatenation. All database operations strictly use parameterized asyncpg SQL (`$1, $2`).
- **Prompt Injection Isolation**: External database contents and customer notes are wrapped in untrusted data delimiters (`[UNTRUSTED_TOOL_DATA: ...]`). Server-side policy checks run before tool handlers execute and cannot be bypassed by prompts.
- **Pure Stdio JSON-RPC Channel**: All application logging is routed strictly to `sys.stderr`. Standard output (`sys.stdout`) is reserved purely for valid JSON-RPC 2.0 frames, preventing client parse crashes.
- **Data Minimization**: Field projection lists exclude internal system columns and credentials.
- **Fail-Closed Execution**: If any authorization parameter, ticket status, or input schema is invalid, the operation defaults to rejection.
- **Sanitized Errors**: Technical Python stack traces and database DSNs are never returned to clients; only sanitized `safe_message` strings are returned.

---

## 11. Setup & Installation

### Prerequisites
- Python 3.12+ (or 3.10+)
- PostgreSQL 16+ running locally or in Docker
- Virtual environment (`.venv`)

### Installation Steps

```bash
# 1. Clone repository
git clone https://github.com/mcp-sentinel/mcp-sentinel.git
cd mcp-sentinel

# 2. Activate virtual environment
# Windows:
.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment variables
cp .env.example .env

# 5. Initialize database migrations
python scripts/init_db.py

# 6. Seed synthetic customer dataset
python scripts/seed_database.py
```

---

## 12. Environment Variables

Key configuration variables in `.env`:

```ini
# Application Environment
APP_ENV=development
LOG_LEVEL=INFO

# Database Connection (PostgreSQL)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mcp_sentinel_db
DB_POOL_MIN_SIZE=2
DB_POOL_MAX_SIZE=10

# MCP Server Configuration
MCP_SERVER_NAME=MCP-Sentinel
MCP_SERVER_VERSION=1.0.0-rc.1
MCP_TRANSPORT=stdio

# Guardrail Boundaries
MAX_QUERY_LIMIT=100
DEFAULT_QUERY_LIMIT=50
APPROVAL_TICKET_TTL_SECONDS=3600
```

---

## 13. How to Run the MCP Server

### Method A: Direct Command (Default: stdio transport)
```bash
python -m mcp_sentinel.server.app
```

### Method B: Docker Container
```bash
docker build -t mcp-sentinel -f docker/Dockerfile .
docker run --rm -i --network="host" -e DATABASE_URL="postgresql://postgres:postgres@localhost:5432/mcp_sentinel_db" mcp-sentinel
```

---

## 14. How to Connect Claude Desktop

Add MCP-Sentinel to your Claude Desktop configuration file:

- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "mcp-sentinel": {
      "command": "C:\\Users\\sugud\\OneDrive\\Documents\\MCP\\.venv\\Scripts\\python.exe",
      "args": [
        "-m",
        "mcp_sentinel.server.app"
      ],
      "cwd": "C:\\Users\\sugud\\OneDrive\\Documents\\MCP",
      "env": {
        "DATABASE_URL": "postgresql://postgres:postgres@localhost:5432/mcp_sentinel_db",
        "APP_ENV": "development",
        "LOG_LEVEL": "INFO"
      }
    }
  }
}
```
*Note: Replace `command` and `cwd` paths with the absolute paths on your workstation.*

---

## 15. How to Connect Cursor

Create or edit `.cursor/mcp.json` in your workspace root:

```json
{
  "mcpServers": {
    "mcp-sentinel": {
      "command": "C:\\Users\\sugud\\OneDrive\\Documents\\MCP\\.venv\\Scripts\\python.exe",
      "args": [
        "-m",
        "mcp_sentinel.server.app"
      ],
      "cwd": "C:\\Users\\sugud\\OneDrive\\Documents\\MCP",
      "env": {
        "DATABASE_URL": "postgresql://postgres:postgres@localhost:5432/mcp_sentinel_db",
        "APP_ENV": "development",
        "LOG_LEVEL": "INFO"
      }
    }
  }
}
```

Once configured:
1. Open Cursor Settings -> Features -> MCP Servers.
2. Confirm `mcp-sentinel` is detected with 8 tools, 3 resources, and 2 prompts.
3. Test tool execution directly from the Cursor composer/chat.

---

## 16. How to Test & Validate

Execute live verification scripts and automated test suites:

```bash
# 1. End-to-End MCP Protocol stdio test (tools, resources, prompts, real data, HITL)
python scripts/test_mcp_protocol_e2e.py

# 2. FastMCP Tool Manual Verification
python scripts/manual_mcp_verification.py

# 3. Release Candidate Live Demos (Read, Write, Destructive HITL, Replay Defense, Prompt Injection)
python scripts/run_release_demos.py

# 4. Full Pytest Suite (447 tests)
pytest -q
```

---

## 17. Production Deployment & Monitoring

- **Docker Multi-Container Stack**: Pre-configured `docker-compose.yml` orchestrates PostgreSQL, FastAPI backend, Next.js console, and Prometheus metrics.
- **Prometheus Metrics**: Scrapable `/metrics` endpoint exports HTTP latency, DB connection pool status, and gating counters.
- **Health Checks**: Decoupled `/health/live` and `/health/ready` probes for container orchestrators.
- **Audit Logs**: Immutable SQL events recorded in `audit_events` with SHA-256 request correlation IDs.

---

## 18. Known Limitations & Roadmap

- **External Connectors**: GitHub, Slack, Google Drive, and Canva connectors are implemented with full REST/OAuth handling, but operate in unconfigured state until active client secrets are supplied.
- **Notion & Supabase Connectors**: Not currently present in this codebase (planned for future releases).
- **In-Memory Approvals in Stdio Mode**: When running as an isolated stdio process without the Next.js console active, approval sign-off is completed via the database repository (`ApprovalRepository.decide_approval`) or API endpoint (`POST /api/approvals/{ticket_id}/approve`).

---

## License

Apache License 2.0. See [LICENSE](LICENSE) for details.
