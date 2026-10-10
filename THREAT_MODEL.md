# MCP-Sentinel Threat Model & Security Architecture

> Comprehensive STRIDE Threat Model, Trust Boundaries, Attack Surfaces, and Mitigation Controls for the MCP-Sentinel AI Security & Governance Platform.

---

## 1. System Scope & Assets

**Primary Objective**: Ensure artificial intelligence agents and external MCP clients can never execute unauthorized, destructive, uninspected, or replayed operations against enterprise databases or SaaS integrations.

### Assets in Scope:
- **Customer & Enterprise Data**: PostgreSQL operational ledger (`customers`, `orders`, `audit_events`).
- **Cryptographic Keys & Secrets**: JWT signing secret (`JWT_SECRET_KEY`), Fernet integration vault key, HMAC approval secret (`APPROVAL_HMAC_SECRET`).
- **Human Approval Infrastructure**: Cryptographically bound approval requests (`approval_requests`).
- **External Integration Credentials**: OAuth access tokens, refresh tokens, and API keys stored in `integration_credentials`.
- **System Integrity & Audit Trail**: Append-only forensic log (`audit_events`).

### Threat Actors:

| Actor | Trust Level | Description |
| :--- | :--- | :--- |
| **Enterprise Administrator** | High | System administrator with full RBAC/ABAC privileges |
| **Authorized Approver / Security Lead** | Medium-High | Authorized human reviewer signing off on gated operations |
| **Operator / Agent User** | Low | User issuing prompts and queries to AI agents |
| **Compromised / Prompt-Injected LLM** | Adversarial / Hostile | LLM manipulated via direct or indirect prompt injection |
| **Malicious Insider / Rogue Client** | Hostile | Authenticated actor attempting privilege escalation or replay |
| **Unauthenticated External Attacker** | Untrusted | Internet attacker probing endpoints, timing attacks, or CSRF |

---

## 2. Trust Boundaries

```
╔══════════════════════════════════════════════════════════════════════════════╗
║ TRUST BOUNDARY 1: External Network → Next.js Web Console / Reverse Proxy    ║
║ Controls: Strict CORS, HttpOnly secure cookies, CSRF header verification    ║
╠══════════════════════════════════════════════════════════════════════════════╣
║ TRUST BOUNDARY 2: External Client → FastAPI REST API Gateway                ║
║ Controls: JWT authentication, sliding-window rate limiting, input validation ║
╠══════════════════════════════════════════════════════════════════════════════╣
║ TRUST BOUNDARY 3: AI Agent / LLM Output → SecurityGate (CRITICAL BOUNDARY)  ║
║ Controls: PolicyEngine, RiskEngine, Cryptographic Approval Gating           ║
║ INVARIANT: LLM claims are NEVER trusted; server-side identity is authoritative║
╠══════════════════════════════════════════════════════════════════════════════╣
║ TRUST BOUNDARY 4: FastMCP Execution Service → PostgreSQL Database & Connectors ║
║ Controls: Parameterized asyncpg SQL, Fernet encrypted token vault, isolation ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

---

## 3. STRIDE Threat Analysis & Implemented Controls

### 3.1 Spoofing (Identity & Authenticity)
- **Threat**: Attacker or LLM fabricates user identity headers or claims higher privileges.
- **Mitigation**: Server-side JWT signature verification (`pyjwt`) with 256-bit symmetric key. `ENABLE_TEST_AUTH=false` in production. LLM claims are completely ignored; user context is extracted strictly from cryptographically validated session tokens.
- **Threat**: Identity token reuse or cross-tenant token spoofing.
- **Mitigation**: Google OIDC token verification validates `iss`, `aud`, and `exp`. Session records are stored in PostgreSQL `user_sessions` with revocable tokens.

### 3.2 Tampering (Integrity)
- **Threat**: Attacker tampers with parameters between human approval sign-off and tool execution.
- **Mitigation**: Canonical JSON SHA-256 parameter hashing (`parameter_hash`). Any change to payload parameters invalidates the ticket instantly.
- **Threat**: SQL injection targeting relational queries or filters.
- **Mitigation**: 100% parameterized queries via asyncpg (`$1, $2`). Dynamic sort columns are strictly checked against a compile-time whitelist. Zero string formatting into SQL.
- **Threat**: Mutation of audit log records.
- **Mitigation**: Append-only SQL schema (`009_audit_events_append_only.sql`). No `UPDATE` or `DELETE` queries exist in the codebase.

### 3.3 Repudiation
- **Threat**: Operator or AI agent denies executing a sensitive operation.
- **Mitigation**: Every tool call is assigned a unique `X-Request-ID` and `X-Trace-ID`, logging `actor_id`, `actor_type`, `tool_name`, `decision`, `risk_score`, and execution timestamp to `audit_events`.
- **Threat**: Approver denies authorizing a destructive action.
- **Mitigation**: Approval records permanently store `approver_id`, `decided_at`, decision notes, and cryptographic HMAC signature.

### 3.4 Information Disclosure (Confidentiality)
- **Threat**: Database credentials, tokens, or Python stack traces leaked in error responses.
- **Mitigation**: Centralized exception handler catches `SentinelError`, `HTTPException`, and unhandled exceptions, returning sanitized safe messages. Sensitive configuration uses `SecretStr` and masked log formatting.
- **Threat**: Integration tokens leaked in database dumps.
- **Mitigation**: All third-party OAuth and API tokens are encrypted at rest using AES-CBC 256-bit Fernet keys via `CredentialVault`.
- **Threat**: Excessive PII retrieval.
- **Mitigation**: Query boundaries enforced via `MAX_QUERY_LIMIT=100` and role-based field projection.

### 3.5 Denial of Service (Availability)
- **Threat**: Agent infinite loops or recursive tool calls exhausting CPU/memory.
- **Mitigation**: Hard boundaries: `MAX_AGENT_ITERATIONS=10`, `MAX_TOOL_CALLS=15`, and 15.0-second execution timeouts per tool call.
- **Threat**: Database connection pool starvation.
- **Mitigation**: asyncpg pool bounded with `DB_POOL_MIN_SIZE=2`, `DB_POOL_MAX_SIZE=10`, and `DB_POOL_TIMEOUT_SECONDS=10.0`.
- **Threat**: Endpoint abuse and brute-force hammering.
- **Mitigation**: In-memory sliding-window `RateLimitMiddleware` enforcing per-client request limits.

### 3.6 Elevation of Privilege
- **Threat**: Agent approves its own requested deletion (Self-Approval Attack).
- **Mitigation**: Anti-self-approval rule: `requester_id != approver_id` enforced server-side. Dual-custody separation ensures autonomous agents cannot authorize tickets.
- **Threat**: Approval ticket replay attack (Reusing a consumed ticket).
- **Mitigation**: Atomic single-use ticket consumption via PostgreSQL `SELECT ... FOR UPDATE`. Once status transitions to `COMPLETED`, subsequent attempts are rejected immediately.
- **Threat**: Indirect prompt injection via database contents.
- **Mitigation**: Untrusted data retrieved from external stores is wrapped in `<UNTRUSTED_DATA>` boundaries with explicit system prompt instructions forbidding instruction overrides.

---

## 4. OWASP Top 10 for LLMs Alignment

| OWASP LLM Risk | Threat Scenario | MCP-Sentinel Defense |
| :--- | :--- | :--- |
| **LLM01: Prompt Injection** | Adversarial user tricks agent into deleting database records | SecurityGate intercepts destructive tool execution out-of-band; requires human sign-off regardless of LLM reasoning |
| **LLM02: Sensitive Info Disclosure** | Agent reveals system prompt, database keys, or customer PII | Data minimization, field redaction, masked configuration properties, sanitized error payloads |
| **LLM04: Model Denial of Service** | Agent executes unbounded iterations or recursive tool calls | Strict iteration bounds (`MAX_AGENT_ITERATIONS=10`), tool call quotas, timeouts |
| **LLM06: Excessive Agency** | Agent autonomously drops tables or purges accounts | FastMCP server does NOT expose raw SQL or arbitrary execution tools; all tools are discrete, authorized RPCs |
| **LLM07: System Prompt Leakage** | Extraction of internal security guidelines | Security is enforced by code (`SecurityGate`, `PolicyEngine`), not prompt instructions |

---

## 5. Security Invariant Checklist

- [x] **Zero Raw SQL**: All database operations use asyncpg query parameters.
- [x] **Zero AI Self-Approval**: Approver identity must strictly differ from requester identity.
- [x] **Zero Replay Allowed**: Tickets are consumed atomically and marked `COMPLETED`.
- [x] **Zero Unauthenticated Protected Endpoints**: API routes verify JWT or session cookies.
- [x] **Zero Secret Leakage**: Stack traces and credentials are never returned in HTTP responses.
- [x] **CSRF Protection**: All state-changing endpoints validate `X-Requested-With` or `X-CSRF-Token`.
- [x] **Credential Vaulting**: Third-party connector secrets are encrypted at rest with Fernet keys.
