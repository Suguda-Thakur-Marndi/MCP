# MCP-Sentinel Release Notes

**Release Candidate Version:** `v1.0.0-rc.1`  
**Release Date:** September 18, 2026  
**Git Commit:** `93b9ac377a043f272c0d9e6dec6c30ee077f5041`  
**Release Status:** READY FOR RELEASE CANDIDATE  

---

## 1. Executive Summary & Highlights

**MCP-Sentinel v1.0.0-rc.1** is the first official release candidate of the enterprise security middleware and execution platform for the Model Context Protocol (MCP). It establishes an authoritative, deterministic defense-in-depth layer between generative AI agents (Google Gemini) and relational enterprise databases (PostgreSQL).

### Core Highlights:
- **Server-Side Authoritative Policy Engine**: Deterministic 0–100 risk scoring and rule evaluation completely decouple security decisions from LLM non-determinism.
- **Cryptographic Human-in-the-Loop (HITL) Gating**: High-risk and destructive actions cannot execute autonomously. Operations require human approval cryptographically bound via SHA-256 to canonical parameters, with single-use atomic consumption preventing replay attacks.
- **Enterprise Identity & Access Control**: Unified Google OAuth 2.0 / OIDC identity validation, HTTP-only secure cookie sessions, CSRF headers, and multi-factor RBAC/ABAC role enforcement (`admin`, `approver`, `operator`, `viewer`).
- **LangGraph Agent Orchestration**: Cyclic agent graph utilizing `gemini-2.5-flash` with hard iteration boundaries (`MAX_AGENT_ITERATIONS=10`) and tool execution caps (`MAX_TOOL_CALLS=15`).
- **84-Scenario Automated Adversarial Evaluation**: Comprehensive security benchmark testing 84 adversarial scenarios across 20 distinct OWASP and agent threat categories, achieving a 100.0% Pass Rate and 0.0% Attack Success Rate.
- **Next.js 16 Dark-Themed Security Console**: Real-time approval queues, searchable audit trails, agent interaction interface, and telemetry dashboards.
- **Enterprise Production Architecture**: Multi-stage Docker containerization with non-root execution, Prometheus observability at `/metrics`, health probes (`/health/live`, `/health/ready`), and complete AWS ECS/RDS deployment automation.

---

## 2. Documented Security Controls

| Defense Layer | Implemented Control | Verified Invariant |
| :--- | :--- | :--- |
| **Transport & Edge** | FastAPI Security Middleware | Strict CORS allowlist, HTTP-Only SameSite cookies, mandatory CSRF headers on mutations, IP rate limiting. |
| **Authentication** | Google OIDC + Test Mode | Token signature verification, domain restriction (`ALLOWED_GOOGLE_DOMAINS`), JWT expiration (60 min). |
| **Authorization** | Authoritative RBAC/ABAC | Strict role hierarchy; frontend hiding is non-authoritative; backend verifies permissions before every tool call. |
| **Agent Guardrails** | LangGraph Cyclic State Graph | Maximum 10 agent reasoning loops, maximum 15 tool executions, XML boundary demarcation against prompt injection. |
| **Policy & Risk** | Deterministic Risk Engine | Risk score computed from base tool impact + target criticality + volume; 4 risk tiers (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`). |
| **HITL Gating** | SHA-256 Parameter Digest Binding | Ticket bound to $\text{SHA-256}(\text{tool} \parallel \text{target\_id} \parallel \text{params})$; constant-time comparison via `hmac.compare_digest`. |
| **Replay Protection** | Atomic Lifecycle State Machine | Single-use tickets (`PENDING` $\to$ `APPROVED` $\to$ `CONSUMED`); consumption inside same DB transaction as execution; zero replay permitted. |
| **Database Security** | PostgreSQL Parameterized SQL | 100% parameterized queries via `asyncpg` (`$1`, `$2`); zero dynamic query construction; zero raw SQL execution tools. |
| **Audit & Forensics** | Immutable Audit Trail | Every request, policy decision, approval event, and rejection logged with `request_id`, `trace_id`, and scrubbing of sensitive data. |

---

## 3. Adversarial Security Evaluation Summary

- **Evaluation Run ID:** `eval-1789739130-39d76924`
- **Benchmark Dataset:** `security-eval-phase10.json` (v1.0.0, 84 cases)
- **Model Evaluated:** `gemini-2.5-flash` / Mock Provider Verification

| KPI / Metric | Secured Result | Baseline Result | Benchmark Target | Verdict |
| :--- | :---: | :---: | :---: | :---: |
| **Total Test Cases** | **84** | 84 | $\ge 50$ | **PASS** |
| **Overall Pass Rate** | **100.0%** (84/84) | 48.8% (41/84) | $\ge 98.0\%$ | **PASS** |
| **Security Gating Recall (SGR)** | **100.0%** (38/38) | 0.0% (0/38) | $100.0\%$ | **PASS** |
| **Attack Success Rate (ASR)** | **0.0%** (0/36) | 91.7% (33/36) | $\le 1.0\%$ | **PASS** |
| **Destructive Action Prevention** | **100.0%** (12/12) | 0.0% (0/12) | $100.0\%$ | **PASS** |
| **SQL Injection Bypass Rate** | **0.0%** (0/5) | 80.0% (4/5) | $0.0\%$ | **PASS** |
| **Direct Prompt Injection ASR** | **0.0%** (0/6) | 100.0% (6/6) | $0.0\%$ | **PASS** |
| **Indirect Prompt Injection ASR** | **0.0%** (0/4) | 100.0% (4/4) | $0.0\%$ | **PASS** |
| **Approval Bypass Rate** | **0.0%** (0/4) | 100.0% (4/4) | $0.0\%$ | **PASS** |
| **Privilege Escalation Bypass** | **0.0%** (0/3) | 100.0% (3/3) | $0.0\%$ | **PASS** |
| **False Positive Rate (FPR)** | **0.0%** (0/25) | 0.0% (0/25) | $\le 5.0\%$ | **PASS** |

---

## 4. Test Suite Validation

- **Pytest Full Suite:** 388 / 388 tests passing (100% pass rate) in 42.17s.
- **Frontend Quality:** Static site generation for 8 routes succeeded; 0 TypeScript errors; 0 ESLint warnings.
- **Static Code Analysis:** `ruff check` passed cleanly across `mcp_sentinel/`, `scripts/`, and `tests/`.

---

## 5. Known Limitations

1. **LLM Provider Latency**: End-to-end agent response times are subject to upstream Gemini API latency (typically 800ms–2500ms depending on prompt size and tool chain length).
2. **PostgreSQL Specificity**: Row-level locking (`SELECT ... FOR UPDATE`) is tailored for PostgreSQL ACID semantics. Deploying with other relational databases requires validating lock compatibility.
3. **In-Memory Rate Limiting**: The current rate limiter runs in-process. For horizontally scaled multi-node deployments, an external distributed cache (Redis / Valkey) should back the rate limiter.
4. **Interactive Approval Timeout**: Unapproved approval tickets expire after 1 hour (`APPROVAL_TICKET_TTL_SECONDS=3600`). If an operator fails to approve within this window, the agent must re-issue the request.

---

## 6. Deployment Requirements

### System Requirements:
- **Operating System:** Linux (Ubuntu 22.04+ / Alpine), macOS, or Windows Server
- **Python Runtime:** Python 3.12 or 3.13
- **Node.js Runtime:** Node.js 20.x or 22.x LTS
- **Database Engine:** PostgreSQL 16 or 18 (Multi-AZ recommended for production)
- **Container Platform:** Docker 24+ and Docker Compose v2+

### Production Configuration Requirements:
- Set `APP_ENV=production` (disables interactive OpenAPI documentation and test mocks).
- Set `ENABLE_TEST_AUTH=false` (enforces strict Google OIDC identity token validation).
- Set `SESSION_COOKIE_SECURE=true` (enforces HTTPS transmission for session cookies).
- Configure a cryptographically random `JWT_SECRET_KEY` (minimum 64 hex characters).
- Maintain least-privilege AWS IAM roles and private VPC subnet isolation.

---

## 7. Breaking Changes

- **None**: This is the baseline Release Candidate (`v1.0.0-rc.1`).
