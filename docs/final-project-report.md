# MCP-Sentinel — Final Project Report

> **Comprehensive Technical Architecture, Security Governance, Evaluation Benchmarks, and Production Readiness Report**

---

## 1. Project Overview

**MCP-Sentinel** is an enterprise-grade security middleware, execution platform, and automated evaluation framework for the Model Context Protocol (MCP). It bridges generative AI reasoning agents—powered by Google Gemini 2.5 and LangGraph—to enterprise persistence systems (PostgreSQL 16) while enforcing strict server-side policy gating, fine-grained RBAC/ABAC authorization, and cryptographic Human-in-the-Loop (HITL) approval.

The project is fully open-sourced under the Apache 2.0 license and validated against 84 automated adversarial benchmark scenarios, demonstrating a verified 0.0% Attack Success Rate.

---

## 2. Problem Statement

As autonomous AI agents evolve from passive conversational chat interfaces to active operational participants, they are granted access to external tools via protocols like MCP. However, connecting LLMs directly to operational backends introduces critical failure modes:
1. **Probabilistic Execution**: Generative models are inherently non-deterministic; hallucinations or cascading reasoning errors can cause an agent to trigger destructive database operations.
2. **Prompt Injection**: Malicious instructions embedded in user queries or untrusted database fields (indirect prompt injection) can easily override advisory system prompts.
3. **Advisory Client-Side Metadata**: MCP tool annotations (`destructiveHint`, `readOnlyHint`) are purely advisory for client presentation and provide zero backend security.
4. **Relational Data Integrity**: AI-controlled dynamic SQL exposes databases to SQL injection, tenant boundary violations (IDOR), and data exfiltration.

---

## 3. Objectives

The primary engineering objectives of MCP-Sentinel were:
- **Establish Server-Authoritative Gating**: Enforce deterministic security policies external to the LLM reasoning loop.
- **Implement Cryptographic Human Approval**: Ensure that destructive operations cannot execute without an approved, single-use ticket cryptographically bound to request parameters via SHA-256 digests.
- **Eliminate SQL Injection & Raw Queries**: Expose strictly typed business tools with 100% parameterized SQL ($1, $2); zero raw SQL execution endpoints.
- **Enforce Single-Use Concurrency Protections**: Prevent approval replay attacks and concurrency races through PostgreSQL row-level locks.
- **Quantitatively Validate Security**: Build an automated 84-scenario adversarial benchmark framework covering 20 threat categories with objective pre/post database state verification.

---

## 4. Architecture

MCP-Sentinel adopts a defense-in-depth architecture where the AI agent is treated as an **untrusted component**:

```mermaid
flowchart TD
    USER([User / Operator]) --> FRONTEND["Next.js 16 Security Console"]
    FRONTEND -->|HTTP-Only Session Cookie + CSRF| FASTAPI["FastAPI Gateway Engine"]
    FASTAPI -->|JWT & Role Validation| AUTH["Authentication & RBAC Context"]
    AUTH --> AGENT["Gemini 2.5 + LangGraph Agent"]
    AGENT -->|Candidate Tool Call| POLICY["Policy & Risk Engine"]
    
    POLICY -->|Risk Score < 50: Autonomous| MCP["FastMCP Tool Server"]
    POLICY -->|Risk Score >= 50: Gated| APPROVALS["Approval State Machine"]
    
    APPROVALS -->|Issue SHA-256 Bound Ticket| DB[("PostgreSQL 16 Enterprise DB")]
    FRONTEND -.->|Review & Approve| APPROVALS
    APPROVALS -->|Atomically Consume Ticket| MCP
    
    MCP -->|Parameterized SQL ($1, $2)| DB
    
    FASTAPI -.->|Metrics & Correlation UUIDs| OBS["Observability Subsystem"]
    EVAL["Adversarial Eval Harness"] -.->|Continuous Verification| POLICY
```

---

## 5. Technology Stack

- **Backend Gateway**: Python 3.12 / 3.13, FastAPI 0.115+, Pydantic v2, Pydantic-Settings, Uvicorn
- **AI Reasoning**: Google Gemini API (`gemini-2.5-flash`, `gemini-2.5-pro`), LangGraph 1.2+, LangChain Core
- **Tool Protocol**: FastMCP 4.0+, Model Context Protocol Python SDK 2.2+
- **Database Layer**: PostgreSQL 16, asyncpg 0.30+ (connection pooling, parameterized SQL, row-level locks)
- **Frontend Console**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, Radix UI
- **Observability**: Prometheus client, structured JSON logging, Grafana dashboard templates
- **Testing & Tooling**: Pytest 8.0+, Pytest-Asyncio, Ruff 0.8+, pip-audit

---

## 6. Security Architecture

The security architecture is founded on the principle that **the AI agent is never the security authority**:
- **Untrusted Reasoning Isolation**: All inputs to the agent are enclosed within `<untrusted_content>` tags, neutralizing prompt injection hijacking.
- **Deterministic Policy Enforcement**: Policy decisions run purely in backend Python and SQL, immune to LLM hallucination.
- **Defense in Depth**: Every request traverses six independent enforcement layers: Edge Gateway $\to$ Authentication $\to$ Agent Boundaries $\to$ Policy Engine $\to$ Approval Gating $\to$ Parameterized Database Persistence.

---

## 7. MCP Implementation

The Model Context Protocol implementation utilizes FastMCP with strictly defined Pydantic schemas:
- **`get_customer(customer_id: str)`**: Bounded single-record customer profile projection.
- **`query_customer_records(filters: dict, limit: int = 50)`**: Filtered customer search capped at 100 records.
- **`list_orders(customer_id: str)`**: Historical customer order records.
- **`add_customer_note(customer_id: str, note_text: str)`**: Appends a customer compliance note.
- **`update_customer_status(customer_id: str, status: str)`**: Governed customer status modification.
- **`delete_customer(customer_id: str, reason: str)`**: **Destructive**; requires pre-staged approval ticket.
- **`purge_inactive_customer_data(cutoff_date: str)`**: **Destructive** bulk operation; requires pre-staged approval ticket.

---

## 8. Agent Architecture

The AI agent is implemented as a stateful cyclic LangGraph state machine:
- **Deterministic Loop Limits**: `MAX_AGENT_ITERATIONS=10` prevents infinite reasoning loops.
- **Cumulative Tool Caps**: `MAX_TOOL_CALLS=15` limits the total tool executions permitted per conversation turn.
- **Execution Timeouts**: `TOOL_TIMEOUT_SECONDS=15.0` ensures asynchronous operations fail gracefully rather than hanging workers.

---

## 9. Policy/Risk Engine

The Policy & Risk Engine deterministically calculates risk scores (0–100) based on four weighted factors:
1. **Base Action Risk**: Read = 10, Note = 30, Status Update = 60, Delete = 85, Bulk Purge = 95.
2. **Resource Criticality**: Premium customer tier or critical system entities add 10–25 points.
3. **Volume Multiplier**: Bulk operations exceeding threshold limits escalate to maximum severity.
4. **Role Clearance Discount**: Authorized administrators receive operational risk offsets.

**Decision Thresholds**:
- `LOW` (0–24) $\to$ `ALLOW` autonomously.
- `MEDIUM` (25–49) $\to$ `ALLOW` with mandatory audit logging.
- `HIGH` (50–74) $\to$ `REQUIRE_APPROVAL` (Operator/Approver review).
- `CRITICAL` (75–100) $\to$ `REQUIRE_APPROVAL` (Admin/Security Lead authorization).

---

## 10. Human Approval

High-risk operations trigger the Human-in-the-Loop approval state machine:
- **Cryptographic Hash Binding**:
  $$\text{Hash} = \text{SHA-256}(\text{tool\_name} \parallel \text{target\_id} \parallel \text{canonical\_args})$$
  At execution time, the server recalculates the hash from the execution payload using constant-time comparison (`hmac.compare_digest`). Any parameter tampering aborts execution.
- **Atomic Single-Use State Machine**:
  `PENDING` $\to$ `APPROVED` / `REJECTED` / `CANCELLED` $\to$ `CONSUMED`.
  Consumption occurs within the same database transaction as the data mutation using PostgreSQL row-level locks (`SELECT ... FOR UPDATE`), eliminating replay attacks and race conditions.

---

## 11. Authentication and Authorization

- **Authentication**: Validates Google Workspace OIDC tokens with domain allowlists (`ALLOWED_GOOGLE_DOMAINS`). Session tokens are stored in secure, `HttpOnly`, `SameSite=Lax` cookies with HMAC-SHA256 signatures.
- **RBAC Matrix**:
  - `admin`: Full system configuration, policy rules, and ticket approvals.
  - `security_lead`: Review and approve high-risk and critical tickets.
  - `operator`: Business agent queries, customer updates, note submission.
  - `viewer`: Read-only telemetry, audit stream, and dashboard metrics.
- **ABAC Tenant Isolation**: Enforces organizational department matching, eliminating cross-tenant Insecure Direct Object References (IDOR).

---

## 12. Security Evaluation

The automated Security Evaluation Framework (`security-eval-phase10`) evaluates 84 deterministic adversarial scenarios across 20 distinct categories:
- **Categories A–C**: Functional operations (Read, Write, Destructive).
- **Categories D–E**: Direct and Indirect Prompt Injection.
- **Categories F, M**: Tool Abuse and Protocol Security.
- **Categories G–K, O**: Auth Bypass, Approval Bypass, Identity Spoofing, Privilege Escalation, Scope Escalation, IDOR.
- **Categories L, N, P**: Policy Tampering, SQL Injection, Environment Escalation.
- **Categories Q–T**: Replay, Concurrency Races, Agent Loops, Error Data Leakage.

---

## 13. Benchmark Results

In the Phase 10 benchmark (`eval-1789576015-db3922f3`), the Secured System was compared against an unmitigated Baseline Agent:

| Security Metric | Baseline Agent | MCP-Sentinel (Secured) | Benchmark Standard | Verdict |
| :--- | :---: | :---: | :---: | :---: |
| **Total Scenarios Evaluated** | 84 | **84** | $\ge 50$ | **PASS** |
| **Overall Pass Rate** | 14.3% (12/84) | **100.0% (84/84)** | 100.0% | **PASS** |
| **Security Gating Recall (SGR)** | 0.0% (0/74) | **100.0% (74/74)** | $\ge 99.0\%$ | **PASS** |
| **Adversarial Attack Success Rate (ASR)** | 85.7% (72/84) | **0.0% (0/74)** | $0.0\%$ | **PASS** |
| **SQL Injection Bypass Rate** | 100.0% | **0.0%** | $0.0\%$ | **PASS** |
| **Approval Replay Rate** | 60.0% | **0.0%** | $0.0\%$ | **PASS** |
| **Concurrency Race Bypass Rate** | 100.0% (multi-delete)| **0.0% (1 allowed, 19 blocked)**| $0.0\%$ | **PASS** |
| **False Positive Rate (FPR)** | 0.0% | **0.0% (0/10 benign)** | $\le 1.0\%$ | **PASS** |

---

## 14. Observability

- **Structured JSON Logging**: Every log entry records `timestamp`, `request_id`, `actor_id`, `tool_name`, `decision`, and `risk_score`.
- **Prometheus Metrics**: Exposes counters and gauges (`mcp_sentinel_policy_decisions_total`, `mcp_sentinel_risk_score_sum`, `mcp_sentinel_active_approvals`).
- **Telemetry Redaction**: Database passwords, JWT keys, and customer PII are systematically masked.

---

## 15. Deployment

- **Containerization**: Multi-stage Dockerfiles for Python FastAPI backend (`docker/Dockerfile.api`) and Next.js frontend (`web/Dockerfile`).
- **Orchestration**: Docker Compose stack (`docker-compose.yml`) providing isolated bridge networking and health check dependencies.
- **Cloud Readiness**: Production deployment specifications for AWS ECS Fargate, AWS RDS PostgreSQL, and AWS Secrets Manager documented in `docs/AWS_DEPLOYMENT.md`.

---

## 16. Testing

- **Pytest Suite**: 48 test modules comprising **388 automated test scenarios** with 100% pass rate.
- **Static Quality**: 159 Python source files validated and formatted with Ruff (0 errors).
- **Secret Scanning**: Zero hardcoded credentials or private keys in repository.

---

## 17. Security Findings

During Phase 10 testing, three technical findings were identified and resolved:
1. **F-10-01 (Resolved)**: Service dependency injection for evaluation connection pool binding.
2. **F-10-02 (Resolved)**: Method alignment for approval ticket cancellation.
3. **F-10-03 (Resolved)**: Refactored test fixture key patterns to prevent false alarms in static scanners.

---

## 18. Limitations

1. **Synthetic Dataset Scope**: 84 scenarios cover known OWASP LLM categories, but emerging red-team jailbreaks require ongoing evaluation.
2. **PostgreSQL Row Locks**: Single-use concurrency guarantees depend on PostgreSQL `SELECT ... FOR UPDATE` semantics.
3. **Upstream Latency**: End-to-end response time is bounded by Gemini API network latency.

---

## 19. Future Work

The following items are planned for future major versions:
- **Open Policy Agent (OPA) Integration**: External declarative Rego policy definitions.
- **WebAuthn / FIDO2 Hardware Step-Up**: Hardware token verification for CRITICAL approvals.
- **Multi-Model Support**: Provider-agnostic support for Claude 3.5 Sonnet and GPT-4o.
- **Continuous Red-Teaming**: Dynamic synthetic jailbreak generation via adversarial subagents.

---

## 20. Conclusion

MCP-Sentinel conclusively demonstrates that autonomous generative AI agents can be deployed safely against enterprise databases when governed by authoritative server-side security middleware. By combining Model Context Protocol tool boundaries, deterministic policy gating, cryptographic parameter hash binding, and single-use human approval state machines, MCP-Sentinel provides an open-source, production-ready blueprint for secure enterprise AI tooling.
