# MCP-Sentinel Threat Model

> **Classification:** Internal Engineering | **Version:** 1.0.0

---

## 1. Threat Model Scope

This threat model covers the MCP-Sentinel platform as deployed in the production configuration described in `DEPLOYMENT.md`. It follows the STRIDE threat classification framework.

**Assets in Scope:**
- Customer PII in PostgreSQL (`customers`, `orders` tables)
- Approval ticket infrastructure (`approval_requests` table)
- JWT secret key (`JWT_SECRET_KEY`)
- Agent conversation content
- Audit log integrity (`audit_events` table)
- MCP tool execution capability

**Actors:**

| Actor | Trust Level | Description |
|-------|-------------|-------------|
| Authenticated Admin | High | Platform admin with full RBAC privileges |
| Authenticated Approver | Medium | Human approver in the approval workflow |
| Authenticated Operator | Low | Agent-facing user with read/write tool access |
| Unauthenticated External | None | Internet-facing attacker or bot |
| Compromised LLM | Hostile | Model responding to prompt injection or adversarial input |
| Malicious Insider | Hostile | Authenticated user attempting privilege abuse |

---

## 2. STRIDE Analysis

### 2.1 Spoofing

| Threat | Asset | Likelihood | Impact | Mitigation |
|--------|-------|-----------|--------|------------|
| JWT forgery with weak key | Authentication | Low | Critical | 64-byte+ random `JWT_SECRET_KEY`; key rotation documented |
| Test header abuse in production | Authentication | Medium | Critical | `ENABLE_TEST_AUTH=false` in production; validated in CI |
| Google OIDC token reuse | Authentication | Low | High | Token validation includes `iss`, `aud`, `exp`, signature |
| Agent claiming elevated role | Authorization | High | Critical | All authz decisions use server-side authenticated user, not LLM claims |

### 2.2 Tampering

| Threat | Asset | Likelihood | Impact | Mitigation |
|--------|-------|-----------|--------|------------|
| Parameter modification post-approval | Approval tickets | High | Critical | SHA-256 parameter hash binding; mismatch = BLOCK |
| Replay of consumed approval ticket | Approval tickets | High | Critical | Single-use atomic `FOR UPDATE` consumption; COMPLETED tickets rejected |
| Cross-tool ticket reuse | Approval tickets | Medium | High | `tool_name` validated during consumption |
| Cross-target ticket reuse | Approval tickets | Medium | High | `target_id` validated during consumption |
| SQL injection into customer filter | Database | High | Critical | Parameterized queries; sort field allowlist |
| Audit log tampering | Audit log | Low | High | Append-only repository; no update/delete paths |

### 2.3 Repudiation

| Threat | Asset | Likelihood | Impact | Mitigation |
|--------|-------|-----------|--------|------------|
| Agent denying tool execution | Audit log | Low | Medium | All tool calls logged with `agent_id`, `request_id`, timestamps |
| Approver denying approval decision | Audit log | Low | High | Approval decision logged with `approver_id`, `decided_at` |
| Missing audit event for blocked call | Audit log | Medium | High | SecurityGate logs BLOCK events before raising exception |

### 2.4 Information Disclosure

| Threat | Asset | Likelihood | Impact | Mitigation |
|--------|-------|-----------|--------|------------|
| Stack trace in API response | Internal architecture | Medium | Medium | All exception handlers return only `safe_message` |
| Database error message leakage | DB credentials/schema | Medium | High | `asyncpg` errors caught and wrapped; never forwarded to client |
| JWT secret in logs | JWT_SECRET_KEY | Low | Critical | `masked_*` properties used for all logging; secret never logged |
| Customer PII over-fetched | PII | Medium | High | `MAX_QUERY_LIMIT=100`; minimal field selection in data minimization |
| Gemini API key in logs | API credentials | Low | High | `masked_gemini_api_key` property used; env var never printed |

### 2.5 Denial of Service

| Threat | Asset | Likelihood | Impact | Mitigation |
|--------|-------|-----------|--------|------------|
| Agent runaway loop | API compute | Medium | Medium | `MAX_AGENT_ITERATIONS=10`, `MAX_TOOL_CALLS=15` hard limits |
| DB connection pool exhaustion | Database | Low | High | `DB_POOL_MAX_SIZE=10`, `DB_POOL_TIMEOUT_SECONDS=10` limits |
| Bulk approval ticket creation | Database | Medium | Medium | Authenticated endpoint; RBAC limits who can create tickets |
| Large payload injection | API | Medium | Low | Request size limits should be enforced at reverse proxy |

### 2.6 Elevation of Privilege

| Threat | Asset | Likelihood | Impact | Mitigation |
|--------|-------|-----------|--------|------------|
| VIEWER attempting OPERATOR actions | RBAC | High | High | Permission checks at router (`require_permission`) and SecurityGate |
| OPERATOR attempting to approve | RBAC | High | Critical | Approval routes require `ADMIN` or `APPROVER` role; enforced at router |
| Agent self-approval | Approval integrity | High | Critical | `requester_id != approver_id` enforced at SQL query level |
| Prompt injection escalating privileges | RBAC | High | Critical | All authz uses server-side authenticated identity; LLM cannot modify this |
| Staging ticket used in production | Environment isolation | Medium | High | `environment` field validated during ticket consumption |

---

## 3. Residual Risks & Mitigations Not Implemented

| Risk | Status | Recommended Mitigation |
|------|--------|------------------------|
| Rate limiting at API layer | Not implemented | Add nginx/ALB rate limiting (e.g., 100 req/min per IP) |
| Token revocation list | Not implemented | Accept: low risk for short JWT TTL (60 min); add Redis-backed blocklist if needed |
| Mutual TLS (mTLS) for DB | Not implemented | Enable PostgreSQL `sslmode=require` in production |
| Distributed tracing | Not implemented | Add OpenTelemetry SDK with Jaeger/Tempo backend |
| Intrusion detection | Not implemented | Add anomaly detection on `audit_events` pattern (e.g., burst of BLOCK decisions) |
| Secrets rotation automation | Not implemented | Integrate with HashiCorp Vault or AWS Secrets Manager |

---

## 4. Security Boundaries

```
╔════════════════════════════════════════════════════════╗
║  TRUST BOUNDARY 1: Internet → API                      ║
║  Control: TLS, JWT authentication, CORS                ║
╠════════════════════════════════════════════════════════╣
║  TRUST BOUNDARY 2: API → Agent (Internal)              ║
║  Control: RBAC check on /api/agent/chat                ║
╠════════════════════════════════════════════════════════╣
║  TRUST BOUNDARY 3: Agent → SecurityGate (Critical)     ║
║  Control: PolicyEngine, RiskEngine, ApprovalGating     ║
║  NOTE: LLM outputs are untrusted at this boundary      ║
╠════════════════════════════════════════════════════════╣
║  TRUST BOUNDARY 4: Repository → Database               ║
║  Control: Parameterized SQL, asyncpg connection pool   ║
╚════════════════════════════════════════════════════════╝
```

**The most critical security boundary is #3**: The SecurityGate between the LLM agent and the MCP tools. This is where the system's fail-closed properties are enforced entirely independently of the model's outputs.

---

## 5. Compliance Considerations

| Framework | Relevant Controls |
|-----------|------------------|
| OWASP Top 10 (2021) | A01 Broken Access Control → RBAC/ABAC; A03 Injection → Parameterized SQL; A09 Logging → Audit events |
| NIST AI RMF | Human oversight (approval gating), auditability, adversarial testing (25-scenario eval) |
| SOC 2 Type II | Access control (auth/RBAC), availability (health checks), confidentiality (data minimization), audit logging |
| GDPR | Data minimization in queries, PII isolation in `customers` table, deletion via approval-gated `delete_customer` |
