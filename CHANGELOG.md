# Changelog

All notable changes to the **MCP-Sentinel** project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0-rc.1] - 2026-09-18

### Added
- **LangGraph Agent Orchestration**: Cyclic state machine agent (`mcp_sentinel.agent.graph`) with `gemini-2.5-flash` reasoning engine, hard execution iteration limits (`MAX_AGENT_ITERATIONS=10`), and tool invocation caps (`MAX_TOOL_CALLS=15`).
- **FastMCP Protocol Server**: Secure MCP server exposing 8 typed business tools with strict Pydantic parameter schemas, input length validation, and controlled data projections.
- **Server-Side Policy & Risk Engine**: Authoritative deterministic risk scoring (0–100) across 4 risk tiers (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`) independent of LLM reasoning.
- **Cryptographic HITL Approval Gating**: SHA-256 parameter hash binding (`hmac.compare_digest`), atomic single-use ticket consumption (`PENDING` -> `APPROVED` -> `CONSUMED`), and 1-hour TTL expiration.
- **Enterprise Authentication & RBAC/ABAC**: Google OAuth 2.0 / OIDC identity verification, HTTP-only secure cookie session management, CSRF token protection, and 4-tier role-based access control (`admin`, `approver`, `operator`, `viewer`).
- **Next.js 16 Security Console**: Operator dashboard with real-time approval queues, searchable structured audit stream, interactive agent chat, policy inspector, and evaluation telemetry.
- **Automated Adversarial Security Evaluation**: Benchmark engine executing 84 test cases across 20 distinct threat categories (Categories A through T).
- **Comprehensive Observability**: Decoupled `/health/live` and `/health/ready` probes, Prometheus metrics at `/metrics`, and end-to-end request tracing via `X-Request-ID` and `X-Trace-ID`.
- **Fail-Closed Demo Reset Procedure**: Dedicated script (`scripts/reset_demo_environment.py`) that restores the synthetic dataset while strictly prohibiting execution in `APP_ENV=production`.

### Changed
- **Database Schema**: Unified schema under 7 idempotent migrations (`001_initial_schema.sql` through `007_refresh_tokens.sql`) on PostgreSQL with least-privilege roles and foreign key constraints.
- **Unified Versioning**: Standardized release version identifier `1.0.0-rc.1` across `pyproject.toml`, backend package `mcp_sentinel.__init__.py`, frontend `web/package.json`, environment configurations, and Docker definitions.
- **Parameter Validation**: Enforced strict parameter typing across all FastMCP tools (`customer_id` integer validation, note text boundaries, reason strings).

### Fixed
- **Approval Replay Vulnerability**: Ticket consumption and destructive database modifications now execute within a single atomic PostgreSQL transaction with `SELECT ... FOR UPDATE` locking, completely preventing replay and race condition attacks.
- **IDOR and Unauthorized Access**: Repository query functions now enforce caller scope validation and tenant attribute checks before returning customer data.
- **Prompt Injection Resilience**: Context boundaries around user queries and tool responses prevent prompt injection payloads from overriding server-side authorization or approval gating.
- **FastMCP Tool Parameter Signatures**: Fixed parameter bindings for `append_customer_audit_note` (`author_id`), `delete_customer` (`approval_ticket`), and `purge_inactive_customer_data` (`approval_ticket`, `dry_run`, `reason`).
- **Database Connection Pool Lifecycle**: Resolved connection pool initialization order during FastAPI lifespan events, ensuring health probes and tests cleanly release database connections.

### Security
- **100% Parameterized SQL**: Zero raw query execution tools; all database queries use `asyncpg` parameterized placeholders (`$1`, `$2`), eliminating SQL injection attack surfaces.
- **Zero Real Secrets in Repository**: Full repository scan verified 0 embedded API keys, 0 private keys, 0 production credentials, and strict `.gitignore` enforcement for local environment files.
- **Least Privilege Execution**: Docker containers execute as non-root unprivileged users (`sentinel` uid 1000 in API container, `nextjs` uid 1001 in web console container).
- **Strict Network Isolation**: Three-tier AWS deployment architecture documented with private subnets for ECS tasks and isolated subnets for RDS PostgreSQL.

### Validation
- **Unit & Integration Tests**: 388/388 tests passing with 100% success rate across backend, MCP tools, authentication, authorization, and observability.
- **Adversarial Security Evaluation**: 84/84 test cases passing (100.0% Pass Rate, 0.0% Attack Success Rate, 100.0% Security Gating Recall).
- **Frontend Quality**: Zero TypeScript compiler errors (`npm run type-check`) and zero ESLint errors (`npm run lint`).
- **Static Code Analysis**: `ruff check` passing with zero errors across all modules, scripts, and tests.
