# MCP Sentinel — Enterprise Security Gateway & Gated MCP Runtime

[![FastMCP](https://img.shields.io/badge/FastMCP-v4.0+-blue.svg)](https://github.com/jlowin/fastmcp)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-16.4-black.svg)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19.2-61DAFB.svg)](https://react.dev)
[![Python](https://img.shields.io/badge/Python-3.12%20%7C%203.13-3776AB.svg)](https://python.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-336791.svg)](https://www.postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg)](https://www.docker.com)
[![Terraform](https://img.shields.io/badge/Terraform-AWS%20IaC-844FBA.svg)](https://www.terraform.io)
[![Tests](https://img.shields.io/badge/Tests-46%20Passed-brightgreen.svg)](tests/)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

**MCP Sentinel** is an enterprise-grade Security Gateway, Governance Proxy, and Tool Execution Runtime engineered specifically for the [Model Context Protocol (MCP)](https://modelcontextprotocol.io). It establishes a hardened **Zero-Trust Boundary** between autonomous AI agents (Claude Desktop, Cursor, LangChain, CrewAI, AutoGen) and enterprise production backends (PostgreSQL, Supabase, Notion API).

MCP Sentinel ensures that autonomous AI agents cannot execute destructive mutations, alter customer lifecycles, or exfiltrate private records without strict server-side policy evaluation, multi-factor risk scoring, cryptographic parameter binding, and out-of-band **Human-in-the-Loop (HITL)** approval gating.

---

## Table of Contents

1. [Executive Summary & The Problem Space](#executive-summary--the-problem-space)
2. [The 10 Immutable Security Principles](#the-10-immutable-security-principles)
3. [System Architecture & Runtime Flow](#system-architecture--runtime-flow)
4. [Dual Transport Modes: stdio vs HTTP/SSE](#dual-transport-modes-stdio-vs-httpsse)
5. [Authoritative Policy & Risk Evaluation Engine](#authoritative-policy--risk-evaluation-engine)
6. [Dual-Custody Cryptographic Approval Protocol](#dual-custody-cryptographic-approval-protocol)
7. [MCP Tools, Resources & Prompts Catalog](#mcp-tools-resources--prompts-catalog)
8. [Enterprise Connectors & Gateway Registry](#enterprise-connectors--gateway-registry)
9. [FastAPI REST API Surface](#fastapi-rest-api-surface)
10. [Dark Observatory Web Console](#dark-observatory-web-console)
11. [Database Schema & Sequential Migrations](#database-schema--sequential-migrations)
12. [Operational Scripts & Verification Test Harnesses](#operational-scripts--verification-test-harnesses)
13. [Getting Started & Local Development](#getting-started--local-development)
14. [Claude Desktop & Cursor IDE Integration](#claude-desktop--cursor-ide-integration)
15. [Automated Testing & Code Quality Assurance](#automated-testing--code-quality-assurance)
16. [Production Deployment & Cloud Operations](#production-deployment--cloud-operations)
17. [Configuration & Environment Variables](#configuration--environment-variables)
18. [Repository Structure](#repository-structure)
19. [License & Governance](#license--governance)

---

## Executive Summary & The Problem Space

Autonomous AI agents equipped with Model Context Protocol (MCP) clients can invoke server-side tools directly against production databases and enterprise APIs. Traditional MCP implementations introduce severe enterprise risks:

- **Uncontrolled Destructive Mutations**: An LLM hallucination or prompt injection can invoke `delete_customer` or `purge_inactive_customer_data` across entire production datasets.
- **Client-Side Claim Spoofing**: Untrusted LLM agents can supply client hints (`is_admin=True`, `read_only=True`, `decision="ALLOW"`), bypassing naive perimeter proxies.
- **Arbitrary SQL Execution**: Exposing raw SQL execution tools (`execute_sql`, `raw_sql`) enables SQL injection, schema dropping, and data exfiltration.
- **Parameter Tampering & Replay Attacks**: An approval granted for operation $A$ (e.g. deleting test customer #999) can be repurposed by an attacker to execute operation $B$ (deleting enterprise customer #1).
- **Credential & PII Leakage**: Unsanitized database stack traces and error messages expose API tokens, connection strings, and sensitive customer records.

**MCP Sentinel solves these challenges** by placing an authoritative, server-enforced security proxy directly at the tool gateway. Every tool call is intercepted, stripped of untrusted client assertions, evaluated through a deterministic risk matrix and declarative policy rulebook, and held in escrow when risk thresholds are exceeded.

---

## The 10 Immutable Security Principles

MCP Sentinel is governed by 10 immutable security principles, enforced at the compiler, middleware, database, and operational levels:

| # | Principle | Enforcement Mechanism |
|---|---|---|
| **Rule #1** | **Never trust the AI agent** | The AI agent is an untrusted entity outside the security perimeter. Client-supplied flags (`is_admin=True`, `read_only=True`, `decision="ALLOW"`, `risk_score=0`) are stripped and discarded. All authorizations are strictly evaluated server-side. |
| **Rule #2** | **Never trust tool annotations as the sole boundary** | FastMCP tool annotations (`destructive_hint=False`) are treated as client advisory metadata only. The server's authoritative risk engine independently recalculates risk and gates execution. |
| **Rule #3** | **Dual-custody approval for destructive operations** | High-risk operations (`delete_customer`, `purge_inactive_customer_data`, `archive_page`) strictly mandate out-of-band human authorization before execution. |
| **Rule #4** | **Never execute arbitrary SQL** | Direct SQL execution (`execute_sql`, `raw_sql`) is strictly prohibited. All queries execute through strictly parameterized prepared statements with schema allow-lists. |
| **Rule #5** | **Parameter-bound cryptographic tickets** | Approval tickets are cryptographically bound to `SHA-256(canonical_json(parameters))`. An approval granted for arguments $A$ strictly rejects modified arguments $B$. |
| **Rule #6** | **Durable single-use idempotency** | Approved tickets can only be consumed once. Replay attempts are rejected atomically at the database layer via `idempotency_keys` and logged as security violations. |
| **Rule #7** | **The MCP server itself must enforce security** | Security enforcement lives directly inside [`SecurityGate`](file:///mcp_sentinel/security/middleware.py) and [`FastMCP`](file:///mcp_sentinel/server/app.py), independent of any upstream agent framework or reverse proxy. |
| **Rule #8** | **Append-only immutable audit trail** | Every security evaluation, authorization decision, tool execution, and rejection is persisted in an append-only, tamper-evident audit ledger with correlation IDs. |
| **Rule #9** | **Zero secret & stack trace leakage** | Database passwords, Notion API tokens (`ntn_...`, `secret_...`), AWS credentials (`AKIA...`), and JWT tokens are scrubbed from all logs, error responses, and tool payloads. |
| **Rule #10** | **Fail closed** | If any security check, database query, policy rule, or cryptographic verification encounters an error or timeout, the operation defaults to immediate denial (`DENY`). |

### Role-Based Access Control (RBAC)

MCP Sentinel enforces a 3-tier Role-Based Access Control model:

```
┌──────────────────────────────────────────────────────────────────┐
│                             ADMIN                                │
│ Full Read/Write, Policy Editing, User Management, Approvals      │
├──────────────────────────────────────────────────────────────────┤
│                            OPERATOR                              │
│ Read Customer/Order Data, Review Audit Logs, Submit Operations   │
├──────────────────────────────────────────────────────────────────┤
│                             VIEWER                               │
│ Read-only Access to Non-Sensitive Metadata; Blocked Mutations    │
└──────────────────────────────────────────────────────────────────┘
```

- **`admin`**: Full access to all tools, REST endpoints, user administration, connector token configuration, policy overrides, and cryptographic approval signing (`approvals:approve_destructive`).
- **`operator`**: Can execute read tools (`get_customer`, `query_customer_records`, `get_order`), append audit notes, stage approval requests, and view audit trails. Cannot self-approve tickets.
- **`viewer`**: Read-only access to customer metadata, orders, and system health status. Blocked from mutation endpoints and approval actions.

---

## System Architecture & Runtime Flow

MCP Sentinel is partitioned into five distinct, loosely coupled architectural tiers:

```mermaid
graph TD
    subgraph AI Client Layer
        LLM[AI Agent / Claude Desktop / Cursor / LangChain]
    end

    subgraph Security Gateway Perimeter
        MCP[FastMCP Server Runtime<br/><code>mcp_sentinel/server/app.py</code>]
        Gate[SecurityGate Interceptor<br/><code>mcp_sentinel/security/middleware.py</code>]
        Risk[Risk Scoring Engine<br/><code>mcp_sentinel/security/risk/engine.py</code>]
        Policy[Policy Rule Evaluator<br/><code>mcp_sentinel/security/policy/engine.py</code>]
    end

    subgraph Human Authorization Escrow
        API[FastAPI Security Backend : 8000<br/><code>mcp_sentinel/api/app.py</code>]
        Console[Dark Observatory Console : 3000<br/><code>web/</code>]
        Officer((Security Officer / Human Approver))
    end

    subgraph Persistence & Ledger
        DB[(PostgreSQL 16 / Supabase TLS)]
        Audit[(Append-Only Audit Ledger)]
        Idemp[(Durable Idempotency Store)]
    end

    subgraph Enterprise Backends
        Notion[(Notion Official REST API)]
        PostgresDB[(Production Postgres Database)]
    end

    LLM -->|1. Tool Invocation| MCP
    MCP --> Gate
    Gate --> Risk
    Risk --> Policy
    Policy -->|2a. Safe Read / Low Risk| PostgresDB
    Policy -->|2b. Destructive / Critical Risk| API
    API --> Console
    Console --> Officer
    Officer -->|3. Authorize Ticket| API
    API -->|4. Signed HMAC Ticket| LLM
    LLM -->|5. Retry with Approval Ticket| MCP
    MCP --> Gate
    Gate -->|6. Verify Hash & Consume Idempotency| Idemp
    Gate -->|7. Execute Mutation| PostgresDB
    Gate -->|8. Notion Mutation| Notion
    Gate -.->|Audit Event| Audit
```

### Complete 7-Step Cryptographic Execution Sequence

1. **Agent Invocation**: The AI agent issues an MCP tool call (e.g. `delete_customer(customer_id="CUST-000001")`).
2. **Perimeter Interception**: [`SecurityGate`](file:///mcp_sentinel/security/middleware.py) intercepts the call, sets a unique correlation ID, and sanitizes untrusted caller headers.
3. **Deterministic Risk Scoring**: [`RiskEngine`](file:///mcp_sentinel/security/risk/engine.py) computes a clamped score ($0-100$) and assigns a tier (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`) based on base risk, sensitivity, scope, and environment.
4. **Policy Evaluation**: [`PolicyEngine`](file:///mcp_sentinel/security/policy/engine.py) matches the request against priority rules (`RULE-001` to `RULE-010`).
5. **Human Escrow Staging**: If the operation is destructive (`delete_customer`, `archive_page`) and unapproved, the server generates a staged ticket cryptographically bound to `SHA-256(canonical_json(parameters))` and returns `APPROVAL_REQUIRED` with the ticket ID to the agent.
6. **Out-of-Band Sign-off**: A human security officer inspects the request parameters, reason, and risk profile in the Dark Observatory Web Console and approves it. The server stamps the ticket with an `HMAC-SHA256` signature.
7. **Atomic Verification & Consumption**: The agent retries execution supplying `approval_ticket`. The server verifies that the current arguments match the canonical hash, checks the HMAC signature, consumes the ticket atomically via `idempotency_keys`, executes the backend mutation, and commits an immutable audit record.

---

## Dual Transport Modes: stdio vs HTTP/SSE

MCP Sentinel natively supports two complementary transport mechanisms:

```
┌──────────────────────────────────┐      ┌──────────────────────────────────┐
│        Standard I/O (stdio)      │      │         HTTP / SSE Transport     │
├──────────────────────────────────┤      ├──────────────────────────────────┤
│ • Transport: Local process pipes │      │ • Transport: HTTP Server-Sent Ev │
│ • Target: Claude Desktop, Cursor │      │ • Target: Networked Agent Fleet  │
│ • Network Exposure: Zero         │      │ • Network Exposure: Reverse Prox │
│ • Launch: python -m              │      │ • Launch: MCP_TRANSPORT=sse      │
│   mcp_sentinel.server.app        │      │   uvicorn mcp_sentinel.api:app   │
└──────────────────────────────────┘      └──────────────────────────────────┘
```

- **`stdio` Mode (Default)**: Optimized for local AI agent desktop environments (Claude Desktop, Cursor IDE). The agent spawns the MCP Sentinel Python process locally and communicates via stdin/stdout. No network sockets are opened, eliminating remote network attack vectors.
- **`sse` / HTTP Mode**: Configured by setting `MCP_TRANSPORT=sse`. Optimized for microservice clusters, Docker Compose topologies, and multi-agent orchestrators communicating over secured TLS networks.

---

## Authoritative Policy & Risk Evaluation Engine

### Multi-Factor Deterministic Risk Engine

Risk is not estimated by an LLM. It is deterministically calculated by [`RiskEngine`](file:///mcp_sentinel/security/risk/engine.py) using the following authoritative formula:

$$\text{Total Risk} = \text{Base Risk} + W_{\text{destructive}} + W_{\text{side\_effect}} + W_{\text{sensitivity}} + W_{\text{environment}} + W_{\text{scope}}$$

Where factors are strictly weighted:
- **Base Tool Risk**: $10$ (read-only), $20$ (append note), $25$ (controlled update), $30$ (delete), $45$ (purge / archive).
- **Destructive Weight**: $+25$ points if operation mutates or destroys records.
- **External Side-Effect Weight**: $+10$ points if external APIs or webhooks are triggered.
- **Data Sensitivity Weight**: `PUBLIC` ($0$), `INTERNAL` ($5$), `CONFIDENTIAL` ($5$), `SENSITIVE` ($10$), `RESTRICTED` ($25$).
- **Environment Weight**: `development` ($0$), `test` ($0$), `staging` ($10$), `production` ($20$).
- **Scope Factor**: Scaled according to record volume ($+10$ for bulk $>100$, $+25$ for critical $>1000$).
- **Clamping**: Deterministically bounded between $0$ and $100$.

#### Risk Tiers & Thresholds

| Risk Level | Score Range | Default Action | Approval Requirement |
|---|---|---|---|
| **`LOW`** | $0 - 24$ | `ALLOW` | Executed immediately without human intervention |
| **`MEDIUM`** | $25 - 49$ | `ALLOW` / `REQUIRE_APPROVAL` | Permitted for controlled updates; gated if sensitivity is restricted |
| **`HIGH`** | $50 - 74$ | `REQUIRE_APPROVAL` | Mandatory human sign-off; single-use HMAC token required |
| **`CRITICAL`** | $75 - 100$ | `REQUIRE_APPROVAL` / `DENY` | High-volume purges, production deletions; dual-custody mandatory |

### The 10 Declarative Policy Rules

Evaluated in strict priority order by [`PolicyEngine`](file:///mcp_sentinel/security/policy/engine.py):

| Rule ID | Priority | Rule Name | Target Decision | Condition / Description |
|---|---|---|---|---|
| **`RULE-006`** | 1100 | `fail_closed_missing_context` | `DENY` | Security context is incomplete, missing `tool_name`, or missing `request_id`. Fails closed. |
| **`RULE-003`** | 1000 | `deny_unauthorized_operation` | `DENY` | Actor lacks required RBAC role permissions for the targeted tool. |
| **`RULE-004`** | 950 | `deny_unauthorized_restricted_resource` | `DENY` | Tool accesses `RESTRICTED` data classification without explicit elevated credentials. |
| **`RULE-007`** | 900 | `fail_closed_unknown_high_risk_tool` | `DENY` | Unregistered or dynamically discovered tool marked destructive or risk $\ge 50$. Fails closed. |
| **`RULE-005`** | 850 | `bulk_critical_operation_requires_approval` | `REQUIRE_APPROVAL` | Operation record count $\ge 1000$ without verified approval ticket. |
| **`RULE-001`** | 800 | `destructive_requires_approval` | `REQUIRE_APPROVAL` | High-risk destructive operation (`delete_customer`, `archive_page`) missing verified approval ticket. |
| **`RULE-002`** | 750 | `production_critical_requires_approval` | `REQUIRE_APPROVAL` | Any operation in `production` environment with `CRITICAL` risk tier. |
| **`RULE-010`** | 300 | `allow_verified_approved_destructive` | `ALLOW` | Destructive operation presenting a valid, unconsumed, parameter-bound approval ticket. |
| **`RULE-008`** | 200 | `allow_safe_low_risk_read` | `ALLOW` | Safe, non-destructive read query with `LOW` risk profile. |
| **`RULE-009`** | 100 | `allow_controlled_write_dev` | `ALLOW` | Controlled, non-destructive mutation in development or staging environment with low/medium risk. |

---

## Dual-Custody Cryptographic Approval Protocol

To prevent parameter tampering, token reuse, and replay attacks, MCP Sentinel implements a dual-custody cryptographic protocol:

```
[Agent Invokes Destructive Tool]
               │
               v
  Canonicalize JSON(params) ──> SHA-256 Hash ──> Staged Ticket in DB
                                                       │
                                                       v
                                            [Human Approver Signs]
                                                       │
                                                       v
                                            HMAC-SHA256(Ticket ID + Hash, Secret)
                                                       │
                                                       v
 [Agent Retries with Signed Ticket] <──────────────────┘
               │
               v
 Verify Parameters Match SHA-256 Hash
               │
               v
 Verify HMAC-SHA256 Signature
               │
               v
 Atomic DB Consumption (idempotency_keys) ──> [Tool Executes Backend Mutation]
```

### 1. Canonical Parameter Hashing

When an approval ticket is staged, all raw input arguments are stripped of internal metadata, sorted lexicographically by key, and serialized into deterministic canonical JSON:

$$\text{Parameter Hash} = \text{SHA-256}(\text{canonical\_json}(\text{parameters}))$$

If an agent attempts to execute an approved ticket for customer ID `CUST-000001` using modified parameters `CUST-000002`, the hash validation fails immediately and the execution is aborted.

### 2. Cryptographic HMAC-SHA256 Signatures

When an authorized security officer approves a staged ticket via the console or REST API, the backend signs the ticket using the server's master secret:

$$\text{Signature} = \text{HMAC-SHA256}(\text{ticket\_id} \mathbin{\Vert} \text{":"} \mathbin{\Vert} \text{parameter\_hash}, \text{APPROVAL\_HMAC\_SECRET})$$

Agents cannot forge approval tokens, as the signing secret is never exposed to the client or agent layer.

### 3. Durable Single-Use Idempotency

Once a signed ticket is verified, it is consumed inside an atomic database transaction against the `idempotency_keys` table. Any attempt to replay the same ticket token results in a unique key collision error, halts execution, and logs a security violation in the audit trail.

---

## MCP Tools, Resources & Prompts Catalog

The canonical FastMCP server runtime ([`mcp_sentinel/server/app.py`](file:///mcp_sentinel/server/app.py)) registers **12 enterprise tools**, **3 read-only resources**, and **2 security-hardened prompts**:

### 1. Enterprise Customer & Order Tools

| Tool Name | Type | Risk Tier | Approval Required? | Description & Allowed Arguments |
|---|---|---|---|---|
| **`query_customer_records`** | Read | `LOW` | No | Parameterized queries against customer records. Accepts `filters` (`status`, `country`, `customer_id`, `tier`), `limit` ($\le 100$), `offset`, `sort_by`, `sort_order`. |
| **`get_customer`** | Read | `LOW` | No | Retrieves customer master profile by internal numeric ID or enterprise code (`CUST-000001`). Safe not-found handling. |
| **`get_customer_orders`** | Read | `LOW` | No | Retrieves purchase order history for a specific customer ID with bounded pagination (`limit`, `offset`). |
| **`get_order`** | Read | `LOW` | No | Retrieves single order details by internal ID or enterprise order number (`ORD-XXXXXX`). |
| **`append_customer_audit_note`** | Write | `MEDIUM` | No | Appends an administrative audit note to a customer. Parameterized input treated strictly as untrusted data. |
| **`update_customer`** | Write | `MEDIUM` / `CRITICAL` | Dynamic | Updates customer attributes (`status`, `country`). High-impact statuses (`suspended`, `closed`, `banned`) trigger approval gating. |
| **`delete_customer`** | Destructive | `CRITICAL` | **Yes (Mandatory)** | Permanently deletes a customer record and cascade-cleans associated data. Requires valid, unconsumed approval ticket. |
| **`purge_inactive_customer_data`** | Destructive | `CRITICAL` | **Yes (Mandatory)** | Bulk compliance purge of inactive customers by ID or `inactivity_days`. Supports `dry_run=True` simulation. |

### 2. Notion API Integration Tools

| Tool Name | Type | Risk Tier | Approval Required? | Description & Allowed Arguments |
|---|---|---|---|---|
| **`search_pages`** | Read | `LOW` | No | Searches pages and databases in the authorized Notion workspace by `query`, `filter_value` (`page` or `database`), and pagination cursor. |
| **`get_page`** | Read | `LOW` | No | Retrieves full metadata, parent hierarchy, and properties for a specified Notion page UUID. Validates UUID formatting. |
| **`query_database`** | Read | `LOW` | No | Queries structured database records with structured filters, sorting criteria, and page size controls. |
| **`archive_page`** | Destructive | `CRITICAL` | **Yes (Mandatory)** | Archives or trashes an authorized Notion page. Strictly gated by `NOTION_WRITE_ENABLED=true` and an approved ticket. |

### 3. Read-Only MCP Resources

- **`schema://customers`**: Returns the complete read-only data model, accessible field projections, allowed filter criteria, and security classification for enterprise customer records.
- **`schema://orders`**: Returns the projection schema, allowed filter parameters, and commercial confidentiality tier for customer purchase transactions.
- **`security://policy`**: Exposes the authoritative server-side security policy, active principles, risk scoring tiers, and approval requirements.

### 4. Security-Hardened MCP Prompts

- **`customer_investigation_brief`**: Generates a structured prompt instructing the AI agent to investigate customer profiles and order history while embedding strict **Prompt Injection Defenses** (instructing the model that database text is untrusted data and must never be interpreted as agent instructions).
- **`destructive_operation_approval_request`**: Formats a structured approval briefing containing the tool name, target identifier, and business justification to stage a ticket before attempting destructive deletion.

---

## Enterprise Connectors & Gateway Registry

MCP Sentinel integrates directly with enterprise backends through modular, least-privilege connectors managed by [`ConnectorRegistry`](file:///mcp_sentinel/connectors/registry.py):

### 1. Supabase & PostgreSQL Connection Pooler

- **Pooled TLS Execution**: Utilizes `asyncpg` with bounded connection pool sizing (`DB_POOL_MIN_SIZE=2`, `DB_POOL_MAX_SIZE=10`) and command timeouts.
- **Prepared Statement Isolation**: Dynamic SQL string formatting is strictly rejected. All queries use parameterized placeholders (`$1, $2, ...`).
- **PostgreSQL Least-Privilege Roles**:
  * `mcp_readonly`: Granted `SELECT` on `customers`, `orders`, and `audit_notes`.
  * `mcp_writer`: Granted `SELECT`, `INSERT`, `UPDATE` on non-sensitive columns.
  * `mcp_destructive`: Dedicated role used solely when executing verified approval tickets.

### 2. Notion Official REST API Connector

- **Token & OAuth Dual Support**: Supports administrator-configured internal integration tokens (`NOTION_API_KEY`) and user-authorized OAuth 2.0 flows.
- **Write-Capability Circuit Breaker**: Defaults to strict read-only mode (`NOTION_WRITE_ENABLED=false`). Destructive tools like `archive_page` fail closed if write access is disabled.
- **Error Sanitization & Zero Leakage**: Unsanitized Notion internal errors and API bearer tokens are scrubbed before returning error payloads to agents.

### 3. Encrypted Local Credential Vault

Connector tokens and secrets can be securely stored in the local SQLite/PostgreSQL credential vault ([`mcp_sentinel/connectors/vault.py`](file:///mcp_sentinel/connectors/vault.py)), encrypted using symmetric Fernet encryption derived from `SESSION_SECRET`.

---

## FastAPI REST API Surface

The FastAPI backend ([`mcp_sentinel/api/app.py`](file:///mcp_sentinel/api/app.py)) exposes a comprehensive REST API powering the Dark Observatory Console, external orchestrators, and automated CI/CD pipelines:

### REST Routing Map

```
/api
├── /auth
│   ├── GET  /google/login         # Initiate Google OAuth 2.0 PKCE flow
│   ├── GET  /google/callback      # Exchange PKCE auth code for session
│   ├── POST /test-session         # Test session switcher (dev/staging only)
│   ├── GET  /me                   # Current authenticated user & permissions
│   └── POST /logout               # Invalidate session cookie
├── /approvals
│   ├── GET  /                     # List approval tickets (filter by status)
│   ├── POST /                     # Stage a new approval ticket
│   ├── GET  /{ticket_id}          # Inspect ticket parameters & canonical hash
│   ├── POST /{ticket_id}/approve  # Authorize ticket & generate HMAC signature
│   ├── POST /{ticket_id}/reject   # Reject ticket with security rationale
│   └── POST /verify               # Verify ticket signature & validity
├── /audit
│   └── GET  /                     # Filter append-only audit trail
├── /policies
│   ├── GET  /rules                # Inspect active policy rules & priorities
│   └── POST /simulate             # Dry-run simulate policy evaluation
├── /tools
│   ├── GET  /                     # Enumerate registered tools & schemas
│   └── POST /execute              # Execute tool through HTTP REST gateway
├── /integrations
│   ├── GET  /                     # Connector health & capability status
│   ├── POST /notion/test          # Test Notion API token connectivity
│   └── POST /supabase/test        # Test Supabase PostgreSQL pool connectivity
├── /mcp-servers
│   └── GET  /                     # Inspect active MCP server instances
└── /dashboard
    └── GET  /stats                # Real-time metrics & risk distributions
/health
├── GET /live                      # Liveness probe (zero DB dependency)
└── GET /ready                     # Readiness probe (verifies database pool)
/metrics                           # Prometheus application metrics
```

---

## Dark Observatory Web Console

The Dark Observatory Console ([`web/`](file:///web)) is a high-performance, real-time security management interface built with **Next.js 16 (Turbopack)**, **React 19**, **Tailwind CSS v4**, and **Lucide Icons**:

### Console Features

- **Command Center Dashboard (`/`)**: Displays real-time security telemetry, active agent count, risk tier distributions, pending approval badges, and recent audit activity.
- **Approval Escrow Desk (`/approvals`)**: Dedicated queue for reviewing staged operations. Inspects canonical parameter JSON, displays SHA-256 hashes, highlights risk justifications, and provides one-click approval or rejection.
- **Audit Trail Explorer (`/audit`)**: High-throughput log viewer supporting instant search by correlation ID, actor, tool name, date range, and execution status.
- **Integrations Hub (`/integrations`)**: Operational status, token validation, capability toggling (`NOTION_WRITE_ENABLED`), and connection latency metrics for Notion and Supabase.
- **Policy & Risk Inspector (`/policies`)**: Visual policy rulebook displaying priorities, condition triggers, target decisions, and deterministic risk weights.
- **Tool Discovery Catalog (`/tools`)**: Interactive registry of all registered and discovered MCP tools with live JSON schema inspectors.
- **Observability & Health Monitor (`/health`)**: Component status, database connection pool utilization, latency metrics, and memory diagnostics.

---

## Database Schema & Sequential Migrations

MCP Sentinel employs **12 sequential, forward-compatible SQL migrations** located in [`mcp_sentinel/database/migrations/`](file:///mcp_sentinel/database/migrations/):

```
001_initial_schema.sql                      # Base customers table & audit timestamps
002_least_privilege_roles.sql               # PostgreSQL security roles (readonly, writer, destructive)
003_enterprise_orders_audit_schema.sql      # Orders table & customer audit notes
004_production_security_approvals_auth.sql  # Approval requests table & initial auth schema
005_approval_state_machine_lifecycle.sql    # Approval state constraints (PENDING, APPROVED, CONSUMED)
006_production_auth_users_sessions.sql      # Users, sessions, and RBAC role bindings
007_security_evaluation_schema.sql          # Policy evaluation logs & risk factor records
008_multi_software_connector_gateway.sql    # Integrations, credentials vault & discovered tools
009_audit_events_append_only.sql            # Append-only immutable audit ledger with correlation IDs
010_approval_hmac_signature.sql             # HMAC-SHA256 signature column on approval tickets
011_durable_idempotency.sql                 # Idempotency keys table for single-use ticket consumption
012_prune_out_of_scope_tables.sql           # Schema cleanup removing deprecated legacy tables
```

### Core Schema Entity Model

```
┌──────────────────┐       ┌──────────────────────┐       ┌────────────────────────┐
│    customers     │<──────│        orders        │       │   approval_requests    │
├──────────────────┤       ├──────────────────────┤       ├────────────────────────┤
│ id (PK)          │       │ id (PK)              │       │ ticket_id (PK, UUID)   │
│ customer_code    │       │ order_number (UNIQUE)│       │ tool_name              │
│ name             │       │ customer_id (FK)     │       │ parameter_hash         │
│ email            │       │ status               │       │ hmac_signature         │
│ country          │       │ total_amount         │       │ status                 │
│ status           │       │ currency             │       │ approver_id            │
│ created_at       │       │ created_at           │       │ expires_at             │
└──────────────────┘       └──────────────────────┘       └────────────────────────┘
         │                                                             │
         v                                                             v
┌──────────────────┐       ┌──────────────────────┐       ┌────────────────────────┐
│   audit_notes    │       │     audit_events     │       │    idempotency_keys    │
├──────────────────┤       ├──────────────────────┤       ├────────────────────────┤
│ id (PK)          │       │ id (PK)              │       │ key (PK, VARCHAR)      │
│ customer_id (FK) │       │ correlation_id       │       │ ticket_id              │
│ note_text        │       │ tool_name            │       │ created_at             │
│ author_id        │       │ actor_id             │       │ expires_at             │
│ created_at       │       │ decision / status    │       └────────────────────────┘
└──────────────────┘       └──────────────────────┘
```

---

## Operational Scripts & Verification Test Harnesses

The repository includes a comprehensive suite of operational scripts organized in [`scripts/`](file:///scripts/):

```
scripts/
├── database/         # Schema migrations, data seeding, and DB health
├── deployment/       # EC2 host setup, manual deployment, and AWS Secrets sync
└── maintenance/      # Startup verification, OAuth tests, and security harnesses
```

### 1. Database Lifecycle Scripts (`scripts/database/`)

| Script | Purpose | Execution Command |
|---|---|---|
| [`init_db.py`](file:///scripts/database/init_db.py) | Safely applies schema migrations (001–012) sequentially. Supports `--check-only` and `--no-seed`. | `python scripts/database/init_db.py` |
| [`seed_database.py`](file:///scripts/database/seed_database.py) | Seeds synthetic customer master records, purchase orders, and audit notes. | `python scripts/database/seed_database.py` |
| [`db_status.py`](file:///scripts/database/db_status.py) | Checks database connectivity, connection pool latency, and table row counts. | `python scripts/database/db_status.py` |

### 2. Deployment Automation Scripts (`scripts/deployment/`)

| Script | Purpose | Execution Command |
|---|---|---|
| [`deploy_ec2.sh`](file:///scripts/deployment/deploy_ec2.sh) | Production deployment automation: pre-flight checks, compose validation, local container builds, DB pre-checks, and health checks. | `./scripts/deployment/deploy_ec2.sh` |
| [`ec2_setup.sh`](file:///scripts/deployment/ec2_setup.sh) | EC2 host initialization: configures swapfile, installs Docker Engine, Compose plugin, AWS CLI v2. | `sudo bash scripts/deployment/ec2_setup.sh` |
| [`aws_secrets_sync.sh`](file:///scripts/deployment/aws_secrets_sync.sh) | Securely synchronizes secrets from AWS Secrets Manager to host `.env`. | `sudo bash scripts/deployment/aws_secrets_sync.sh` |

### 3. Security Verification Test Suites (`scripts/maintenance/`)

| Test Suite | Coverage & Security Invariants Tested |
|---|---|
| [`verify_startup.py`](file:///scripts/maintenance/verify_startup.py) | Multi-component startup probe validating FastMCP server, FastAPI backend, auth, policies, and integrations. |
| [`verify_approval_security_lifecycle.py`](file:///scripts/maintenance/verify_approval_security_lifecycle.py) | Validates the complete 6-step human-in-the-loop approval lifecycle, segregation of duties, parameter tamper rejection, and HMAC verification. |
| [`verify_notion_write_security.py`](file:///scripts/maintenance/verify_notion_write_security.py) | 10-point security suite for Notion `archive_page`, validating dual-custody approval, SHA-256 cryptographic binding, and replay rejection. |
| [`verify_google_oauth.py`](file:///scripts/maintenance/verify_google_oauth.py) | 10-point test suite for Google OAuth 2.0 PKCE, OIDC claims, session management, and anti-account-takeover defense. |
| [`verify_integrations_connections.py`](file:///scripts/maintenance/verify_integrations_connections.py) | 11-suite end-to-end test of Notion integration token, user-authorized OAuth, Supabase pooler, and credential scrubbing. |
| [`verify_notion_security.py`](file:///scripts/maintenance/verify_notion_security.py) | Validates Notion read tools, UUID formatting, non-existent resource sanitization, read-only capability gating, and zero secret leakage. |
| [`verify_console_flow.py`](file:///scripts/maintenance/verify_console_flow.py) | Simulates the out-of-band console approval flow: execution halt -> human authorization -> replay prevention. |
| [`verify_db_permissions.py`](file:///scripts/maintenance/verify_db_permissions.py) | Verifies least-privilege PostgreSQL roles (`mcp_readonly`, `mcp_writer`, `mcp_destructive`). |
| [`verify_live_database_workflows.py`](file:///scripts/maintenance/verify_live_database_workflows.py) | Validates durable idempotency, live approval consumption, and transactional rollbacks. |
| [`verify_supabase_connection.py`](file:///scripts/maintenance/verify_supabase_connection.py) | Validates direct and connection-pooled connectivity to Supabase PostgreSQL over TLS. |
| [`manual_mcp_verification.py`](file:///scripts/maintenance/manual_mcp_verification.py) | Connects to FastMCP server instance, verifies tool schema discovery, structured filtering, and destructive tool blocking. |

> [!NOTE]
> All scripts can also be invoked directly from the root `scripts/` directory (e.g. `python scripts/init_db.py`, `python scripts/verify_startup.py`, `./scripts/deploy_ec2.sh`) for operational muscle memory.

---

## Getting Started & Local Development

### Prerequisites

- **Python**: `>= 3.10` (Tested on Python 3.12 and 3.13)
- **Node.js**: `>= 20.0` (with npm)
- **PostgreSQL**: `16+` (or a hosted Supabase project)
- **Docker & Docker Compose** (optional for containerized workflow)

### 1. Clone & Configure Environment

```bash
git clone https://github.com/your-org/mcp-sentinel.git
cd mcp-sentinel

# Copy environment template
cp .env.example .env
```

Review `.env` and set your secrets. Secure development placeholders are pre-populated for local testing.

### 2. Backend Python Setup

```bash
# Create and activate Python virtual environment
python -m venv .venv
source .venv/bin/activate       # On Linux/macOS
.venv\Scripts\activate          # On Windows

# Install production and development dependencies
pip install -r requirements.txt

# Run database schema migrations (001–012)
python scripts/database/init_db.py

# Seed synthetic customer and order data
python scripts/database/seed_database.py
```

### 3. Start Backend Services

**Start FastAPI REST Gateway (Port 8000):**
```bash
uvicorn mcp_sentinel.api.app:app --host 0.0.0.0 --port 8000 --reload
```

**Start FastMCP Server (stdio mode for AI agents):**
```bash
python -m mcp_sentinel.server.app
```

### 4. Start Dark Observatory Web Console

```bash
cd web
npm install
npm run dev
```

Open `http://localhost:3000` in your browser to access the Dark Observatory Console.

---

## Claude Desktop & Cursor IDE Integration

Connect your local AI assistant to MCP Sentinel by adding it to your MCP client configuration:

### 1. Claude Desktop Configuration

Edit your Claude Desktop configuration file:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "mcp-sentinel": {
      "command": "/absolute/path/to/mcp-sentinel/.venv/bin/python",
      "args": ["-m", "mcp_sentinel.server.app"],
      "cwd": "/absolute/path/to/mcp-sentinel",
      "env": {
        "DATABASE_URL": "postgresql://postgres:postgres@localhost:5432/mcp_sentinel_db",
        "APP_ENV": "development",
        "LOG_LEVEL": "INFO",
        "NOTION_WRITE_ENABLED": "false"
      }
    }
  }
}
```

*(On Windows, replace `/absolute/path/to/...` with `C:\\path\\to\\mcp-sentinel\\.venv\\Scripts\\python.exe`)*

### 2. Cursor IDE Configuration

Add to your workspace `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "mcp-sentinel": {
      "command": "python",
      "args": ["-m", "mcp_sentinel.server.app"],
      "env": {
        "DATABASE_URL": "postgresql://postgres:postgres@localhost:5432/mcp_sentinel_db",
        "APP_ENV": "development"
      }
    }
  }
}
```

---

## Automated Testing & Code Quality Assurance

MCP Sentinel maintains strict automated testing and static analysis standards:

### 1. Pytest Unit, Security & Integration Suite

The test suite covers policy evaluation, risk scoring, RBAC permissions, JWT validation, cryptographic parameter hashing, HMAC signatures, secret redaction, and tool inventories:

```bash
# Run all automated tests
pytest -v

# Run with short traceback and summary
pytest -ra -q
```

*Results: **46 passing tests** across unit, security, and integration layers.*

### 2. Static Analysis & Formatting (Ruff)

```bash
# Check linting rules
ruff check mcp_sentinel/ scripts/ tests/

# Verify formatting without modifications
ruff format --check mcp_sentinel/ scripts/ tests/
```

### 3. Frontend Linting & Type-Checking

```bash
cd web
npm run lint
npm run type-check
npm run build
```

---

## Production Deployment & Cloud Operations

MCP Sentinel supports both local multi-container development and automated AWS production deployment:

### 1. Local Development Stack (Docker Compose)

Spins up the FastAPI backend, Next.js Web Console, and an isolated local PostgreSQL 16 container:

```bash
docker compose up --build
```

- **`sentinel-postgres`**: PostgreSQL 16 on internal network (`127.0.0.1:5432`).
- **`sentinel-api`**: FastAPI REST backend on port `8000` with `/health/live` probe.
- **`sentinel-web`**: Dark Observatory Console on port `3000`.

### 2. AWS EC2 Production Architecture

In production, PostgreSQL is hosted externally on Supabase (connecting over TLS). Services are built and run directly on the EC2 host via Docker Compose:

```
[Security Operator / Browser]
              │
          (HTTPS : 443)
              │
              v
     [Caddy Reverse Proxy]
       │               │
 (Port 8000)      (Port 3000)
       │               │
       v               v
 [sentinel-api]   [sentinel-web]
       │
   (TLS Pooler)
       │
       v
 [Supabase Managed PostgreSQL]
```

#### Production Deployment Commands

```bash
# Execute automated production deployment script
./scripts/deployment/deploy_ec2.sh

# Or run compose manually:
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d --remove-orphans
```

For complete step-by-step production setup, swap configuration, domain mapping, Caddy TLS termination, and rollback procedures, refer to the [Manual EC2 Deployment Guide](file:///docs/deployment/MANUAL_EC2_DEPLOYMENT.md).

### 3. Infrastructure as Code (Terraform)

Located in [`infra/terraform/`](file:///infra/terraform/), defining the complete AWS infrastructure:
- **`ec2.tf`**: Ubuntu EC2 instance provisioned with user-data initialization.
- **`ecr.tf`**: AWS Elastic Container Registry for container images.
- **`iam.tf`**: Least-privilege IAM roles and instance profiles.
- **`security_groups.tf`**: Strict firewall rules restricting ports 80/443 to authorized CIDRs.

### 4. Observability & Monitoring

- **Prometheus**: Metrics collection scraping `/metrics` on port 8000 ([`monitoring/prometheus.yml`](file:///monitoring/prometheus.yml)).
- **Alerting Rules**: Pre-configured alert rules for rate-limit violations, high-risk approvals, and API latency ([`monitoring/alert_rules.yml`](file:///monitoring/alert_rules.yml)).
- **Grafana Dashboard**: Ready-to-import security monitoring dashboard ([`monitoring/grafana_dashboard.json`](file:///monitoring/grafana_dashboard.json)).

---

## Configuration & Environment Variables

All settings are strongly typed and validated at application startup using Pydantic Settings ([`mcp_sentinel/config/settings.py`](file:///mcp_sentinel/config/settings.py)):

### Application & Server Settings

| Variable | Type | Default | Description |
|---|---|---|---|
| `APP_ENV` | string | `development` | Runtime environment: `development`, `staging`, `production`, `test`. |
| `LOG_LEVEL` | string | `INFO` | Logging verbosity: `DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL`. |
| `MCP_SERVER_NAME` | string | `MCP-Sentinel` | Human-readable name announced by the FastMCP server. |
| `MCP_TRANSPORT` | string | `stdio` | MCP transport mode: `stdio` or `sse`. |
| `API_PORT` | int | `8000` | Port bound by the FastAPI REST server. |
| `WEB_PORT` | int | `3000` | Port bound by the Next.js web console. |
| `NEXT_PUBLIC_API_URL` | string | `http://localhost:8000` | Public API URL accessed by web console frontend. |

### Database & Pooling

| Variable | Type | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | string | *Required* | PostgreSQL connection string (`postgresql://user:pass@host:5432/db`). |
| `SUPABASE_DATABASE_URL` | string | `None` | Optional Supabase transaction pooler connection string with TLS. |
| `DB_POOL_MIN_SIZE` | int | `2` | Minimum async connection pool connections. |
| `DB_POOL_MAX_SIZE` | int | `10` | Maximum async connection pool connections. |
| `DB_POOL_TIMEOUT_SECONDS` | float | `10.0` | Connection acquisition timeout in seconds. |
| `DB_COMMAND_TIMEOUT_SECONDS` | float | `15.0` | Individual SQL query execution timeout. |

### Integrations (Notion API)

| Variable | Type | Default | Description |
|---|---|---|---|
| `NOTION_API_KEY` | string | `None` | Notion Internal Integration Token (starts with `secret_` or `ntn_`). |
| `NOTION_CLIENT_ID` | string | `None` | Optional Notion OAuth 2.0 Client ID. |
| `NOTION_CLIENT_SECRET` | string | `None` | Optional Notion OAuth 2.0 Client Secret. |
| `NOTION_WRITE_ENABLED` | bool | `false` | Explicit circuit breaker for destructive Notion tools (`archive_page`). |

### Authentication & Cryptography

| Variable | Type | Default | Description |
|---|---|---|---|
| `SESSION_SECRET` | string | *Required* | Master session secret key (minimum 32 characters; used for cookie signing). |
| `JWT_SECRET_KEY` | string | *Required* | Master JWT secret key for access token signing. |
| `APPROVAL_HMAC_SECRET` | string | *Required* | Secret key used exclusively for HMAC-SHA256 signing of approval tickets. |
| `JWT_EXPIRATION_MINUTES`| int | `60` | JWT bearer token validity lifetime. |
| `APPROVAL_TICKET_TTL_SECONDS` | int | `3600` | Staged approval ticket expiration window (1 hour default). |
| `ENABLE_TEST_AUTH` | bool | `true` | Allows test session switching in dev/staging. **Must be false in production**. |
| `GOOGLE_CLIENT_ID` | string | `None` | Google Cloud Console OAuth 2.0 Client ID for PKCE login. |
| `GOOGLE_CLIENT_SECRET` | string | `None` | Google Cloud Console OAuth 2.0 Client Secret. |
| `ALLOWED_GOOGLE_DOMAINS` | list | `[]` | Comma-separated list of allowed email domains (e.g. `company.com`). |

---

## Repository Structure

```
.
├── mcp_sentinel/              # Canonical Backend Python Package
│   ├── api/                   # FastAPI application & route controllers
│   │   ├── app.py             # Root FastAPI application & lifecycle
│   │   ├── middleware/        # Security headers, rate limiting, and correlation middleware
│   │   └── routers/           # Sub-routers (approvals, audit, auth, health, integrations, tools)
│   ├── config/                # Centralized settings & secrets management
│   │   ├── secrets.py         # Secret masking and credential scrubbing
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
│   │   └── seed/              # Synthetic seed data generators
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
├── tests/                     # Automated Test Suite (Pytest: 46 Passed)
│   ├── conftest.py            # Test fixtures and isolated test environment setup
│   ├── fixtures/              # Reusable test payloads and entity fixtures
│   ├── integration/           # Subsystem and FastAPI endpoint integration tests
│   ├── security/              # Access control, zero-trust gating, and boundary tests
│   └── unit/                  # Component-organized unit tests
├── scripts/                   # Operational and verification test harnesses
│   ├── README.md              # Categorized index and operational documentation
│   ├── database/              # Schema migration runner (init_db.py) and data seeder
│   ├── deployment/            # Production host initialization and deployment scripts
│   └── maintenance/           # 11 End-to-end security & integration verification suites
├── docs/                      # Central Documentation Portal
│   ├── architecture/          # System design, data flows, and runtime components
│   ├── security/              # Security principles, threat model, and cryptographic verification
│   ├── development/           # Local environment setup, test execution, and coding standards
│   └── deployment/            # Manual EC2 deployment guide and production runbooks
├── migrations/                # Database migrations manifest and documentation
├── web/                       # Dark Observatory Security Console (Next.js 16)
│   ├── app/                   # App Router pages and layouts
│   ├── components/            # Reusable UI and layout components
│   ├── hooks/                 # React data-fetching hooks (useAuth, useApiQuery)
│   ├── lib/                   # API client and formatting utilities
│   ├── types/                 # Shared TypeScript interfaces & types
│   └── Dockerfile             # Multi-stage production container for frontend
├── docker/                    # Docker infrastructure
│   ├── Dockerfile             # FastMCP runtime container
│   ├── Dockerfile.api         # FastAPI backend container
│   └── Caddyfile              # TLS reverse proxy configuration
├── infra/                     # Infrastructure as Code
│   └── terraform/             # AWS EC2, ECR, IAM, and Security Groups
├── monitoring/                # Observability configuration (Prometheus & Grafana)
│   ├── alert_rules.yml        # Prometheus alerting rules
│   ├── grafana_dashboard.json # Grafana monitoring dashboard
│   └── prometheus.yml         # Prometheus scrape configuration
├── .env.example               # Root environment configuration template
├── docker-compose.prod.yml    # Production multi-container composition
├── docker-compose.staging.yml # Staging multi-container composition
├── docker-compose.yml         # Local development stack
├── pyproject.toml             # Python packaging and tool configuration
└── requirements.txt           # Production Python dependencies
```

---

## License & Governance

MCP Sentinel is open-source software licensed under the **[Apache License 2.0](LICENSE)**.

```
Copyright 2026 MCP Sentinel Authors

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

For security vulnerability disclosures or operational inquiries, please follow the coordinated disclosure policy in [`docs/security/README.md`](file:///docs/security/README.md).
