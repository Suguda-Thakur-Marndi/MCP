# MCP-Sentinel Architecture & Engineering Blueprint

> **System:** MCP-Sentinel Enterprise AI Security Platform  
> **Status:** Production-Ready (Phase 15 Verified)  
> **Architecture Style:** Clean Modular Layered Architecture (Zero Trust)  

---

## 1. System Overview & Principles

MCP-Sentinel is a defense-in-depth security gateway and governance platform for AI agents operating over the Model Context Protocol (MCP). It intercepts, evaluates, gates, and audits every tool execution before database or external service interaction occurs.

### Non-Negotiable Core Principles

1. **LLM is Untrusted**: Language model responses and external tool outputs are treated as untrusted user input, never as an authorization boundary.
2. **Fail-Closed by Design**: In the presence of errors, timeouts, or ambiguous policies, execution is strictly denied (`DENY`).
3. **Defense-in-Depth Pipeline**: Authorization passes through 9 distinct server-enforced stages:
   `Identity Verification` → `Integration Check` → `Schema Validation` → `Policy Engine` → `Multi-Factor Risk Scoring` → `Cryptographic Human Gating` → `Execution` → `Result Sanitization` → `Tamper-Proof Audit Logging`.
4. **Zero Stack Trace Leakage**: Internal database schemas, connection strings, Python traces, and error payloads are never exposed to clients.
5. **No Mock Fallbacks in Production**: Production environments strictly reject test tokens, mock credentials, and unauthorized developer bypasses.

---

## 2. Architectural Boundaries & Dependency Direction

The backend enforces strict inward dependency flow:

```
┌─────────────────────────────────────────────────────────────┐
│                       Presentation Layer                    │
│            Next.js 16 App Router (Stitch Design System)     │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS / SSE
┌──────────────────────────────▼──────────────────────────────┐
│                        API Routers                          │
│     mcp_sentinel.api.routers (12 Domain Routers)            │
│     Correlation IDs, RBAC Dependencies, Schema Validation   │
└──────────────────────────────┬──────────────────────────────┘
                               │ Inward dependency
┌──────────────────────────────▼──────────────────────────────┐
│                    Domain Services Layer                    │
│     mcp_sentinel.services (Approval, Audit, Customer, etc.) │
│     Business logic, State Machines, Policy Evaluation       │
└──────────────────────────────┬──────────────────────────────┘
                               │ Inward dependency
┌──────────────────────────────▼──────────────────────────────┐
│                      Repository Layer                       │
│     mcp_sentinel.repositories (asyncpg Data Access)         │
│     Parameterized SQL ($1, $2), FOR UPDATE Row Locking      │
└──────────────────────────────┬──────────────────────────────┘
                               │ Data Access
┌──────────────────────────────▼──────────────────────────────┐
│                PostgreSQL 16 Enterprise Database             │
└─────────────────────────────────────────────────────────────┘
```

### Dependency Rules

- **API Routers** depend only on **Services**, **Schemas**, and **Security Contexts**. They never issue raw SQL queries.
- **Services** orchestrate business workflows and depend on **Repositories**, **Schemas**, and **Policy/Risk Engines**.
- **Repositories** interact strictly with **Database Pools** using parameterized SQL statements.
- **Connectors** implement external software gateways (e.g., FastMCP, GitHub, Slack) and adhere to standard `BaseConnector` interfaces.
- **Schemas** are pure Pydantic models with zero outward dependencies.

---

## 3. Centralized Exception Hierarchy & API Error Envelope

All domain errors derive from `SentinelError`, carrying an explicit HTTP status code and clean client-facing messages:

### Exception Class Hierarchy

```
SentinelError (base class, HTTP 400)
├── SecurityValidationError (HTTP 422)
├── AuthorizationDeniedError (HTTP 403)
├── SecurityViolationError (HTTP 403)
├── PolicyViolationError (HTTP 403)
├── ApprovalRequiredError (HTTP 403)
├── NotFoundError (HTTP 404)
├── ConflictError (HTTP 409)
├── RateLimitExceededError (HTTP 429)
├── UpstreamProviderError (HTTP 502)
├── ExecutionTimeoutError (HTTP 504)
├── ConfigurationError (HTTP 500)
└── DatabaseOperationError (HTTP 500)
```

### Unified API Error Contract

Every HTTP error response emitted by FastAPI conforms to a standardized, backward-compatible JSON schema:

```json
{
  "status": "error",
  "error_type": "NotFoundError",
  "message": "Tool 'github.nonexistent' was not found.",
  "detail": "Tool 'github.nonexistent' was not found.",
  "request_id": "req-9b37c02b-a590-48e2",
  "details": null
}
```

- `message`: Used by frontend consoles, custom clients, and notifications.
- `detail`: Maintained for 100% compatibility with standard FastAPI OpenAPI and Swagger specifications.
- `request_id`: Binds client errors directly to server logs and OpenTelemetry traces.
- `internal_details`: Logged server-side at `ERROR` level, strictly stripped before serialization.

---

## 4. Frontend Architecture (Next.js 16 Security Console)

The web console is organized into modular routes, custom hooks, reusable components, and API clients:

### Folder Structure

```
web/
├── app/                  # Next.js 16 App Router (17 verified routes)
│   ├── page.tsx          # Real-time Security Operations Dashboard
│   ├── agent/            # Zero-Trust Agent Reasoning Playground
│   ├── agent-runs/       # Execution Tracing & State Machine Timeline
│   ├── approvals/        # Dual-Custody Approval Queue & Decision Console
│   ├── audit/            # Tamper-Evident Audit Trail & Filter Engine
│   ├── auth/             # Session & Identity Management
│   ├── evaluation/       # Automated Attack Simulation & Security Benchmarks
│   ├── health/           # Real-Time Service Health & Database Pool Probes
│   ├── integrations/     # Multi-Software Gateway Connectors
│   ├── mcp-servers/      # FastMCP Server Discovery & Tool Registry
│   ├── policies/         # ABAC/RBAC Dynamic Security Policy Editor
│   ├── risk/             # Risk Vector Analytics & Anomaly Detection
│   ├── settings/         # System Parameters & Non-Root Environment Config
│   └── tools/            # Enterprise Tool Registry & Safe Execution Sandbox
├── components/
│   ├── layout/           # AppShell, TopBar, Sidebar, GlobalSearchModal
│   └── ui/               # Badges, DataTable (sorting, filtering), FeedbackStates
├── hooks/                # Architectural State & Mutation Management
│   ├── useApiQuery.ts    # Unmount-safe async query hook with AbortController
│   ├── useApiMutation.ts # Duplicate execution guard (idempotency safety)
│   ├── useAuth.ts        # Centralized RBAC permissions & session management
│   └── index.ts          # Consolidated exports
└── lib/
    ├── api.ts            # Typed HTTP Client with enhanced ApiError handling
    └── utils.ts          # Stitch design system utilities and badge tokens
```

### Server State & Mutation Conventions

- **Server-State Management**: Handled via `useApiQuery` with automatic cleanup, unmount guards, and background polling.
- **Mutation Safety**: Handled via `useApiMutation` with in-flight mutex guards to eliminate duplicate approvals or double submissions.
- **Design Integrity**: Fully preserves the approved Google Stitch UI token palette (`surface-container-lowest`, `label-mono`, `primary`, `secondary`, `error`).

---

## 5. Security Controls & Human Gating Pipeline

### 1. Dual-Custody Approval Protocol (NIST 800-53 AC-3)

- **Parameter Binding**: Execution arguments are recursively sorted and hashed using canonical JSON with SHA-256 (`parameter_hash`).
- **Cryptographic Signatures**: Approval tickets are HMAC-SHA256 signed using a dedicated server secret.
- **Replay Protection**: Completed approval tickets transition atomically from `APPROVED → EXECUTING → COMPLETED` using PostgreSQL row locks (`SELECT ... FOR UPDATE`). Replay attempts immediately return `ConflictError` (409) or `SecurityViolationError` (403).
- **Anti-Self-Approval**: Requesters cannot approve their own actions (`requester_id != approver_id`).

### 2. Authentication & Production Hardening

- **JWT / OIDC**: Supports production RS256/HS256 JWT tokens and Google OIDC verification.
- **Fail-Closed Startup**: In production (`APP_ENV=production`), the application halts startup if:
  - `ENABLE_TEST_AUTH=true`.
  - Insecure defaults or short secrets (<32 chars) are detected.
  - Wildcard CORS origins (`*`) are combined with credentials.
  - Secure cookies (`COOKIE_SECURE=false`) are disabled.

---

## 6. Verification & Test Evidence

| Verification Layer | Tool / Command | Evidence | Status |
|--------------------|----------------|----------|--------|
| **Python Linting** | `ruff check mcp_sentinel/ tests/` | 0 errors across all modules | ✅ PASSED |
| **Backend Test Suite** | `pytest -q` | 478 passed, 0 failures | ✅ PASSED |
| **Frontend Type Checking** | `tsc --noEmit` | 0 TypeScript errors | ✅ PASSED |
| **Frontend Production Build** | `next build` | 17/17 routes compiled successfully | ✅ PASSED |
| **Docker Containers** | Multi-stage Dockerfiles | Non-root users (`sentinel`, `nextjs`) | ✅ VERIFIED |
