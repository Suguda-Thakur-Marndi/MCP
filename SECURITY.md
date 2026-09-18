# MCP-Sentinel Security Policy

> This document describes the security controls, policies, and procedures for the MCP-Sentinel platform.

---

## 1. Security Control Inventory

### 1.1 Authentication

- **Primary**: JWT HS256 signed tokens (symmetric key from `JWT_SECRET_KEY` env var)
- **Production Option**: Google OAuth 2.0 OIDC token verification (set `GOOGLE_CLIENT_ID`)
- **Development/CI**: Test header shortcut (`X-Test-User-Role`) — only active when `ENABLE_TEST_AUTH=true`
- **Principle**: Every API endpoint except `/health` requires authentication

### 1.2 Authorization (RBAC + ABAC)

- Role hierarchy: `ADMIN > APPROVER/SECURITY_ANALYST > OPERATOR > VIEWER`
- Permissions enforced server-side at both API router and SecurityGate levels
- **Critical rule**: LLM role claims are never trusted — all authorization decisions use authenticated server-side user identity

### 1.3 Input Validation

- All API inputs validated via Pydantic V2 models with strict field constraints
- Validation errors return sanitized messages — raw input values are never reflected back
- String length limits enforced at both application and database constraint levels

### 1.4 SQL Injection Prevention

- 100% parameterized queries using asyncpg `$1, $2` syntax
- Sort field allowlist validation: only pre-approved column names accepted
- No string interpolation into SQL queries anywhere in the codebase
- All injected payloads tested via automated SQLi test suite

### 1.5 Prompt Injection Mitigation

- All data retrieved from the database and returned as context is wrapped:
  ```
  <UNTRUSTED_DATA source="database">
  [actual content here]
  </UNTRUSTED_DATA>
  ```
- Agent system prompt explicitly instructs the LLM that `UNTRUSTED_DATA` blocks contain passive data and must not be interpreted as instructions
- SecurityGate enforces policy independently — LLM cannot bypass by claiming it received instructions

### 1.6 Cryptographic Approval Gating

See `ARCHITECTURE.md §5` for full details. Key properties:

- **Parameter binding**: SHA-256 hash of canonical JSON locks approval to exact parameters
- **Anti-replay**: Single-use ticket consumed atomically via PostgreSQL `FOR UPDATE` row lock
- **Anti-self-approval**: `requester_id != approver_id` enforced at database query level
- **Environment isolation**: Approval tickets are environment-scoped (staging != production)
- **Expiration**: Tickets expire at configurable TTL (default: 1 hour)

### 1.7 Audit Logging

- Every MCP tool execution (allowed, blocked, or approval-required) is logged to `audit_events`
- Logged fields: `agent_id`, `request_id`, `tool_name`, `event_type`, `decision`, `risk_score`, `policy_id`, `created_at`
- Audit log records are append-only — no update or delete paths exist in the repository
- All destructive action completions log execution timestamp and completion status

### 1.8 Error Handling & Information Disclosure Prevention

- All `SentinelError` subclasses carry a `safe_message` (client-facing) and `internal_details` (server log only)
- Python tracebacks, internal file paths, and database error messages are **never** returned in API responses
- HTTP 500 responses return only: `"An unexpected internal server error occurred."`
- Validation errors strip the submitted input values from error responses

### 1.9 Secret Management

- No secrets are hard-coded in source code
- All secrets loaded from environment variables or `.env` file (never committed to VCS)
- `Settings.__repr__()` and all logging paths use masked property variants (`masked_database_url`, `masked_gemini_api_key`)
- `.gitignore` excludes `.env`, `*.key`, `*.pem`, `*.p12`

---

## 2. Security Configuration Requirements

### 2.1 Production Checklist

Before deploying to production:

- [ ] `JWT_SECRET_KEY` set to cryptographically random 64+ byte string (never the default)
- [ ] `ENABLE_TEST_AUTH=false`
- [ ] `APP_ENV=production` (disables `/docs` and `/redoc` Swagger UI)
- [ ] `GOOGLE_CLIENT_ID` set if using Google OIDC authentication
- [ ] `POSTGRES_PASSWORD` set to a strong, unique password
- [ ] Database not exposed on `0.0.0.0` — listen only on `sentinel-net` Docker network
- [ ] CORS `allow_origins` locked to production frontend domain(s) only
- [ ] TLS termination in front of the API (nginx/ALB/Cloudflare)

### 2.2 Environment Variables Security

| Variable | Sensitivity | Required |
|----------|-------------|----------|
| `DATABASE_URL` | 🔴 Critical | ✅ Yes |
| `JWT_SECRET_KEY` | 🔴 Critical | ✅ Yes |
| `GEMINI_API_KEY` | 🟠 High | Optional |
| `GOOGLE_CLIENT_ID` | 🟡 Medium | Optional |
| `POSTGRES_PASSWORD` | 🔴 Critical | ✅ Yes |
| `ENABLE_TEST_AUTH` | 🟠 High | Must be `false` in production |

---

## 3. Known Attack Vectors & Mitigations

| Attack Vector | Mitigation |
|---------------|-----------|
| SQL Injection | Parameterized queries, sort field allowlist |
| Prompt Injection | Data tagging, server-side policy enforcement |
| Parameter Tampering Post-Approval | SHA-256 parameter hash binding |
| Replay Attack (reusing consumed ticket) | Single-use atomic consumption with row locking |
| Cross-Tool Ticket Reuse | `tool_name` field validated during consumption |
| Cross-Target Ticket Reuse | `target_id` field validated during consumption |
| Self-Approval | `requester_id != approver_id` enforced at SQL level |
| Privilege Escalation | RBAC enforced at router, gate, and service layers |
| Information Disclosure | Safe messages, no stack trace leakage |
| JWT Forgery | HS256 with strong server-side secret (RS256 available with Google OIDC) |
| Agent Runaway Loop | `MAX_AGENT_ITERATIONS` and `MAX_TOOL_CALLS` hard limits |
| Brute Force | Rate limiting should be added at reverse proxy level in production |

---

## 4. Incident Response

### 4.1 Compromised JWT Secret Key

1. Immediately rotate `JWT_SECRET_KEY` environment variable and restart API containers
2. All existing sessions are invalidated (no token revocation list needed for HS256 rotation)
3. Review `audit_events` for suspicious activity in the hours preceding discovery
4. Issue new credentials to all legitimate users

### 4.2 Compromised Approval Ticket

1. Call `POST /api/approvals/{ticket_id}/cancel` immediately
2. If already consumed, review `audit_events` for the `COMPLETED` event and assess DB impact
3. If actual data was modified, initiate data rollback procedures
4. Review agent conversation logs for the originating request

### 4.3 Suspected Prompt Injection

1. Review `audit_events` for the `agent_id` and `request_id` in question
2. Check if any REQUIRE_APPROVAL or BLOCK decisions were overridden — they cannot be, but verify
3. Identify source of injected content (customer record, order, audit note)
4. Sanitize the offending database record and document the incident

---

## 5. Security Testing

The platform ships with a comprehensive automated security evaluation framework:

```bash
# Run all 25 security scenarios
python scripts/run_security_evaluation.py

# Run the full test suite (291 tests)
.venv/Scripts/pytest tests/ -v
```

Security scenarios include:
- Normal read/write operations (baseline)
- Destructive actions without, with expired, with consumed, with tampered tickets
- Cross-tool and cross-target ticket reuse attempts
- Self-approval attempts
- RBAC privilege escalation attempts
- Prompt injection in user messages and database content
- SQL injection payloads in filter/sort parameters
- Agent loop runaway scenario
- End-to-end authorized destructive lifecycle

All 25 scenarios must pass before any production deployment.
