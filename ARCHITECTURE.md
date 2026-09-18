# MCP-Sentinel Architecture

> **Version:** 1.0.0 | **Environment:** Production | **Last Updated:** 2026-09

---

## 1. System Overview

MCP-Sentinel is a production-grade AI agent security platform built on the Model Context Protocol (MCP). It enforces **defense-in-depth** across every layer: authentication, authorization, policy evaluation, risk scoring, cryptographic human approval gating, SQL injection prevention, and tamper-proof audit logging.

### Core Design Principles

| Principle | Implementation |
|-----------|---------------|
| **LLM is not a security boundary** | All security controls (auth, RBAC, policy, risk, approvals, DB) enforce independently of the model |
| **Fail-closed** | Every gate raises typed `SentinelError` descendants; errors default to DENY, never silently pass |
| **Zero trust** | Every request is authenticated and authorized regardless of origin |
| **Least privilege** | RBAC/ABAC roles grant minimum required permissions per action |
| **No stack trace leakage** | All API error handlers strip internal details; only `safe_message` is returned |
| **Real implementations** | No mocks in production paths — real PostgreSQL, real cryptography, real OIDC, real policy |

---

## 2. System Layers

```
┌─────────────────────────────────────────────────────────────────┐
│  Next.js Security Console (web/:3000)                           │
│  Dashboard │ Approvals │ Agent Chat │ Tools │ Policies │ Audit  │
└──────────────────────┬──────────────────────────────────────────┘
                       │ HTTPS REST + SSE
┌──────────────────────▼──────────────────────────────────────────┐
│  FastAPI Unified Backend (mcp_sentinel.api:8000)                │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────┐    │
│  │ Auth MW     │  │ Request ID  │  │ CORS Middleware       │    │
│  │ (JWT/OIDC)  │  │ Correlation │  │ (localhost:3000 only) │    │
│  └─────────────┘  └─────────────┘  └──────────────────────┘    │
│                                                                  │
│  Routers: /api/auth /api/agent /api/approvals /api/audit        │
│           /api/dashboard /api/policies /api/security /health    │
└──────────────────────┬──────────────────────────────────────────┘
                       │ Internal Python calls
┌──────────────────────▼──────────────────────────────────────────┐
│  LangGraph Agent Orchestrator (mcp_sentinel.agent)              │
│  Google Gemini API │ Provider Abstraction │ Loop Guard (N=10)    │
└──────────────────────┬──────────────────────────────────────────┘
                       │ MCP Protocol (in-process)
┌──────────────────────▼──────────────────────────────────────────┐
│  FastMCP Server (mcp_sentinel.server) — 8 Enterprise Tools      │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ SecurityGate (Pre-execution Hook — runs on EVERY call)    │  │
│  │  PolicyEngine → RiskEngine (0-100 multi-factor scoring)   │  │
│  │  ApprovalGating (cryptographic parameter hash binding)    │  │
│  └───────────────────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────────────────┘
                       │ Service Layer calls
┌──────────────────────▼──────────────────────────────────────────┐
│  Service Layer (CustomerService, OrderService, ApprovalService)  │
└──────────────────────┬──────────────────────────────────────────┘
                       │ Parameterized SQL ($1, $2, ...)
┌──────────────────────▼──────────────────────────────────────────┐
│  Repository Layer (asyncpg pool, FOR UPDATE row locking)        │
└──────────────────────┬──────────────────────────────────────────┘
                       │ TCP
┌──────────────────────▼──────────────────────────────────────────┐
│  PostgreSQL 16 (Migrations 001–004, Synthetic Enterprise Data)  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Authentication & Authorization

### Authentication Flow

```
Client Request
    │
    ├─► Authorization: Bearer <JWT>
    │       └─► decode_access_token() — PyJWT HS256 verification
    │               └─► AuthUser(id, email, name, role)
    │
    └─► X-Test-User-Role header (only when ENABLE_TEST_AUTH=true)
            └─► Dev/CI shortcut (disabled in production)
```

### Role Hierarchy

| Role | Can Read | Can Write | Can Approve | Can Run Security Eval | Can View Audit |
|------|----------|-----------|-------------|----------------------|----------------|
| ADMIN | ✅ | ✅ | ✅ | ✅ | ✅ |
| SECURITY_ANALYST | ✅ | ❌ | ❌ | ✅ | ✅ |
| APPROVER | ✅ | ❌ | ✅ | ❌ | ✅ |
| OPERATOR | ✅ | ✅ | ❌ | ❌ | ❌ |
| VIEWER | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## 4. MCP Tool Catalog

| Tool | Risk Level | Destructive | Approval Required |
|------|-----------|-------------|-------------------|
| `get_customer` | LOW | ❌ | ❌ |
| `query_customer_records` | LOW | ❌ | ❌ |
| `get_customer_orders` | LOW | ❌ | ❌ |
| `get_order` | LOW | ❌ | ❌ |
| `update_customer` | MEDIUM | ❌ | ❌ |
| `append_customer_audit_note` | MEDIUM | ❌ | ❌ |
| `delete_customer` | CRITICAL | ✅ | ✅ |
| `purge_inactive_customer_data` | CRITICAL | ✅ | ✅ |

---

## 5. Human-in-the-Loop Approval Gating

Destructive tool calls undergo a mandatory two-phase lifecycle:

### Phase 1: Request (Agent → Platform)
1. Agent identifies destructive operation needed
2. SecurityGate intercepts → PolicyEngine returns `REQUIRE_APPROVAL`
3. Platform creates `ApprovalRequest` with:
   - `ticket_id`: Cryptographically random 32-char token
   - `parameter_hash`: SHA-256 of canonical JSON of all execution parameters
   - `status`: `PENDING`, `expires_at`: NOW + TTL
4. Agent returns ticket ID to user, halts execution

### Phase 2: Execution (Human → Platform → Agent)
1. Human approver reviews parameters in Security Console
2. Approver calls `POST /api/approvals/{ticket_id}/approve`
   - RBAC: Only ADMIN/APPROVER roles can approve
   - Anti-self-approval: `requester_id != approver_id` enforced at DB level
   - Status transitions `PENDING → APPROVED` with `FOR UPDATE` row lock
3. Agent retries tool call with same parameters + ticket ID
4. `SecurityGate.verify_and_consume_bound()` validates:
   - Ticket exists and is `APPROVED`
   - `parameter_hash` matches (prevents parameter tampering post-approval)
   - `tool_name` matches (prevents ticket reuse across tools)
   - `target_id` matches (prevents ticket reuse across targets)
   - `environment` matches (prevents staging ticket use in production)
   - Not expired
   - Atomically transitions `APPROVED → EXECUTING → COMPLETED`
5. Tool executes, database is modified, audit event logged

### Anti-Replay Defense
- Tickets are **single-use only**: once consumed (`COMPLETED`), all subsequent requests with that ticket ID are rejected
- Parameter hashes bind approval to exact execution parameters — any modification post-approval is detected

---

## 6. Database Schema

```sql
-- Core operational data
customers           -- Enterprise customer records (PII-sensitive)
orders              -- Customer order history

-- Security & governance
audit_events        -- Immutable tamper-evident audit log
gating_approval_tickets  -- Legacy approval tickets (Phase 1-3 compat)
approval_requests   -- Production approval lifecycle (Phase 4+)
users               -- Platform users with roles
```

---

## 7. Security Controls Summary

| Control | Implementation |
|---------|---------------|
| Authentication | JWT HS256 + Google OIDC (optional) |
| Authorization | RBAC + ABAC via `rbac.py` permission matrix |
| Input Validation | Pydantic V2 strict schemas on all API inputs |
| SQL Injection | 100% parameterized queries (`$1, $2`); sort field allowlists |
| Prompt Injection | Untrusted data wrapped in `<UNTRUSTED_DATA>` tags before LLM |
| Approval Gating | SHA-256 parameter hash binding + atomic single-use consumption |
| Audit Logging | Every tool call logged to `audit_events` (ALLOW/BLOCK/REQUIRE_APPROVAL) |
| Error Handling | Only `safe_message` returned; stack traces logged server-side only |
| Rate Limiting | `MAX_AGENT_ITERATIONS=10`, `MAX_TOOL_CALLS=15` per agent turn |
| Secret Management | All secrets via environment variables; `masked_*` properties for logging |
