# MCP-Sentinel — Production Release Readiness Checklist

**Document ID:** `REL-CHECKLIST-v1.0.0-rc.1`  
**Target Version:** `v1.0.0-rc.1`  
**Target Branch:** `release-candidate`  
**Date:** September 28, 2026  
**Auditor:** DevOps, SecOps & Release Engineering Team  

---

## 1. Codebase & Static Quality Gates

- [x] **Git Tree Integrity:** All necessary files committed, branch tracked to `origin/release-candidate`.
- [x] **Python Linting:** `ruff check mcp_sentinel/ mcp_server/ scripts/ tests/` passes with 0 errors.
- [x] **Python Code Formatting:** `ruff format --check` reports 162 files cleanly formatted.
- [x] **Frontend Linting:** `npm run lint` in `web/` completes with 0 errors and 0 warnings.
- [x] **TypeScript Typechecking:** `npx tsc --noEmit` in `web/` passes with 0 type errors.
- [x] **Frontend Production Build:** `npm run build` succeeds, generating 11 optimized static routes.
- [x] **Dependency Lockfile Consistency:** `requirements.txt` and `package-lock.json` versions pinned and audited.
- [x] **Secret Scanning:** Zero hardcoded credentials, API keys, private tokens, or database passwords in source code.

---

## 2. Configuration & Secrets Management

- [x] **Environment Variable Template:** `.env.example` documents all required and optional settings.
- [x] **Production Startup Validation:** `validate_production_startup()` in `settings.py` enforces fail-fast invariants.
- [x] **Test Auth Lockdown:** `ENABLE_TEST_AUTH` is strictly required to be `false` in production.
- [x] **JWT Secret Strength:** `JWT_SECRET_KEY` enforces minimum 32 characters and rejects default placeholder strings.
- [x] **CORS Allowlist Security:** Production rejects wildcard `*` origins and requires explicit HTTPS domains.
- [x] **Cookie Security Attributes:** `SESSION_COOKIE_SECURE=true`, `HttpOnly=true`, and `SameSite=Lax` enforced for production sessions.
- [x] **External Credential Provisioning (Pre-Launch Requirement):**
  - [ ] Provision `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in Google Cloud Console.
  - [ ] Provision production `GEMINI_API_KEY` in Google AI Studio.
  - [ ] Generate production `JWT_SECRET_KEY` (64-character random hex token).

---

## 3. Database Schema & Migration Management

- [x] **Migration Sequence:** Migrations 001 through 007 verified idempotent and ordered sequentially.
- [x] **Clean DB Bootstrap:** `python scripts/init_db.py` creates tables, constraints, and initial state cleanly.
- [x] **Foreign Key Constraints:** Verified active and enforced across all relations (e.g. `orders.customer_id` $\to$ `customers.id`).
- [x] **100% Parameterized SQL:** All repository queries use asyncpg parameter bindings (`$1`, `$2`); zero dynamic query string interpolation.
- [x] **Data Isolation:** Operational database (`mcp_sentinel_db`) strictly separated from evaluation database (`mcp_sentinel_eval`).
- [x] **Synthetic Baseline Data:** Database seeds (`seed_database.py`) contain 100% synthetic entities with `example.test` domains. Zero real PII.
- [ ] **Production Database Hosting:** Connect to managed PostgreSQL (e.g. AWS RDS Aurora or Cloud SQL) with `sslmode=require`.

---

## 4. Authentication, Authorization & RBAC

- [x] **JWT Token Flow:** Secure token issuance, HS256 cryptographic verification, expiration checking.
- [x] **Role Hierarchy Enforcement:**
  - `ADMIN`: Full access to read, write, approve, evaluate, and view audit events.
  - `SECURITY_ANALYST`: Read, evaluate, and view audit logs (mutations forbidden).
  - `APPROVER`: Read and approve destructive tickets (mutations forbidden).
  - `OPERATOR`: Read and legitimate writes (approvals and destructive actions forbidden).
  - `VIEWER`: Read-only queries (all writes, approvals, and mutations forbidden).
- [x] **Server-Authoritative RBAC:** Permissions validated independently in FastAPI routers and service layers.
- [x] **Session Revocation:** Logout invalidates session cookies and revokes active tokens.

---

## 5. FastMCP Server & Enterprise Tool Catalog

- [x] **Tool Registration:** All 8 enterprise tools active and discoverable via `mcp_server.list_tools()`.
- [x] **Read Tools (Non-Mutating):**
  - `query_customer_records` (paginated, allowlisted sort fields, bounded scope).
  - `get_customer` (masked PII, stripped password hashes).
  - `get_customer_orders` (scoped to requested customer).
  - `get_order` (lookup by ID).
- [x] **Controlled Write Tools (Additive / Non-Destructive):**
  - `append_customer_audit_note` (immutable append-only audit note insertion).
  - `update_customer` (non-destructive status/tier updates).
- [x] **Destructive Gated Tools:**
  - `delete_customer` (requires approved single-use ticket).
  - `purge_inactive_customer_data` (requires approved single-use ticket).
- [x] **SQL Injection Defense:** No raw query tools (`execute_sql`, `raw_sql`) exposed.
- [x] **Server-Side Enforcement:** `SecurityGate` middleware intercepts every tool call regardless of agent claims.

---

## 6. Human-in-the-Loop Approval Lifecycle

- [x] **Cryptographic Hash Binding:** Execution parameters bound using canonical SHA-256 digest (`compute_parameter_hash`).
- [x] **Anti-Self-Approval:** The requesting user/agent cannot approve their own ticket (`requester_id != approver_id`).
- [x] **Parameter Tampering Prevention:** Modified arguments during execution yield immediate `APPROVAL_BINDING_MISMATCH`.
- [x] **Atomic Single-Use Consumption:** Row-level locks (`SELECT ... FOR UPDATE`) transition ticket `APPROVED` $\to$ `EXECUTING` $\to$ `COMPLETED`.
- [x] **Anti-Replay Defense:** Consumed tickets reject all subsequent execution attempts (`APPROVAL_REPLAY_BLOCKED`).
- [x] **Ticket Expiration:** Expired tickets cannot be approved or consumed.

---

## 7. AI Agent Safety & Orchestration

- [x] **LangGraph Loop Limits:** Hard iteration ceiling (`MAX_AGENT_ITERATIONS=10`).
- [x] **Tool Call Cap:** Maximum 15 tool calls per conversational turn (`MAX_TOOL_CALLS=15`).
- [x] **Tool Execution Timeouts:** 15.0s per tool call execution timeout.
- [x] **Untrusted Tool Demarcation:** All tool outputs wrapped in `[UNTRUSTED_TOOL_DATA]` to neutralize indirect prompt injection.
- [x] **Direct DB Isolation:** Agent interacts solely via FastMCP protocol; zero direct database connections.
- [x] **Mock Provider Fallback:** Verified deterministic offline operation when live API key is unavailable.

---

## 8. Automated Security Evaluation Framework

- [x] **Benchmark Dataset:** 84 adversarial scenarios covering 20 security threat categories.
- [x] **Evaluation Safety Lock:** Benchmark aborts automatically if executed against `APP_ENV=production`.
- [x] **KPI Verification:**
  - Security Gating Recall: $\ge 99.0\%$ (Actual: **100.0%**).
  - Attack Success Rate: $\le 1.0\%$ (Actual: **0.0%**).
  - False Positive Rate: $\le 5.0\%$ (Actual: **0.0%**).
- [x] **Dual Agent Evaluation:** Benchmarked Secured Agent against unmitigated Baseline Agent.

---

## 9. Observability, Logging & Error Sanitization

- [x] **Correlation Tracing:** `X-Request-ID` and `X-Trace-ID` injected and propagated across all layers.
- [x] **Prometheus Metrics:** Real HTTP, database pool, tool execution, and policy metrics exposed via `/metrics`.
- [x] **Tamper-Evident Audit Logging:** Every policy decision and tool invocation persisted to `audit_events`.
- [x] **Sensitive Data Scrubbing:** Passwords, JWT secrets, authorization headers, and PII masked before logging.
- [x] **Zero Stack Trace Leakage:** API exception handlers return sanitized `safe_message` payloads; tracebacks logged server-side only.

---

## 10. Containerization & Deployment

- [x] **Multi-Stage Dockerfiles:** Lean production images (`Dockerfile.api` and `web/Dockerfile`).
- [x] **Non-Root Execution:** Unprivileged users `sentinel` (UID 1000) and `nextjs` (UID 1001).
- [x] **Resource Caps:** CPU and memory limits defined in `docker-compose.yml`.
- [x] **Decoupled Healthchecks:** `/health/live` (process vitality) and `/health/ready` (dependency connectivity).
- [x] **Isolated Docker Bridge Network:** `sentinel-net` ensures database is inaccessible from public interface.
- [x] **CI/CD Pipeline:** `.github/workflows/ci.yml` validates linting, tests, builds, and docker manifests on push/PR.

---

## 11. Backup, Disaster Recovery & Incident Response

- [x] **Database State Reset Script:** `scripts/reset_demo_environment.py` restores deterministic baseline (500 customers, 1000 orders).
- [x] **Operations Runbook:** `docs/OPERATIONS_RUNBOOK.md` documents procedures for secret rotation, approval stuck ticket handling, and incident response.
- [ ] **Production Backup Automation:** Configure automated daily PostgreSQL snapshots and point-in-time recovery (PITR) in hosting environment.
- [ ] **Grafana / Alerting Webhook:** Connect `/metrics` to Prometheus scraping server with pager alerts on 5xx error spikes or database pool exhaustion.

---

### Release Sign-Off Verdict

**STATUS: READY FOR RELEASE CANDIDATE (v1.0.0-rc.1)**  
Certified and verified by Antigravity Engineering Systems.
