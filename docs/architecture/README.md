# SentinelCore — Architecture Overview

SentinelCore provides a zero-trust enterprise gateway and Human-in-the-Loop (HITL) security perimeter for Model Context Protocol (MCP) tool execution.

## Architectural Tiers

1. **FastMCP Server Runtime (`mcp_sentinel/server/app.py`)**:
   - Implements the Model Context Protocol (MCP) interface over `stdio` or HTTP/SSE transports.
   - Enforces the 10 SentinelCore Security Principles.
   - Declares read tools (`get_customer`, `get_order`, `query_customer_records`, `search_pages`, `get_page`, `query_database`) and destructive tools (`delete_customer`, `purge_inactive_customer_data`, `archive_page`).
   - Treats LLM inputs as untrusted and strips rogue security claims.

2. **FastAPI Security Gateway (`mcp_sentinel/api/app.py`)**:
   - High-throughput REST API serving the Security Console frontend and management APIs.
   - Router endpoints: `/api/auth`, `/api/approvals`, `/api/audit`, `/api/policies`, `/api/tools`, `/api/integrations`, `/api/mcp-servers`.
   - Security middleware: Rate limiting, HTTP security headers, and OpenTelemetry correlation tracing.
   - Health probes: Decoupled `/health/live` (zero DB dependency) and `/health/ready` (validates database pool).

3. **Security & Evaluation Subsystems (`mcp_sentinel/security/`)**:
   - `auth/`: OIDC Google OAuth 2.0 PKCE, session management, RBAC (`admin`, `operator`, `viewer`), and ABAC context.
   - `policy/`: Rule engine evaluating least privilege, tool pattern matching, and parameter constraints.
   - `risk/`: Multi-factor risk scoring engine assigning deterministically clamped risk scores (0–100) and tiers (LOW, MEDIUM, HIGH, CRITICAL).
   - `decisions/`: Cryptographic parameter-bound approval tickets (HMAC-SHA256).

4. **Persistence & Data Tier (`mcp_sentinel/database/`)**:
   - PostgreSQL (Supabase managed pooler in production, isolated PostgreSQL container for local development).
   - Append-only audit logs with tamper-evident record structure.
   - Durable idempotency storage preventing double-execution of destructive operations.

5. **Security Console Frontend (`web/`)**:
   - Next.js 15 application with React 19 and Tailwind CSS.
   - Provides live dashboards for pending approval tickets, audit logs, policy management, integration token configuration, and tool discovery.
