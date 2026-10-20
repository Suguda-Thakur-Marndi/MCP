# SentinelCore — Security Model & Governance

## 10 Immutable Security Principles

1. **Rule #1: Never trust the AI agent**: The AI model is an untrusted entity outside the security perimeter. It cannot authorize actions or bypass policies.
2. **Rule #2: Never trust tool annotations as the sole security boundary**: Client-supplied annotations (`read_only=True`) are hints, not enforcement mechanisms. The server must independently classify risk.
3. **Rule #3: Dual-custody approval for destructive operations**: Critical actions (`delete_customer`, `purge_inactive_customer_data`, `archive_page`) require explicit human authorization tickets.
4. **Rule #4: Never execute arbitrary SQL**: Direct SQL execution (`execute_sql`, `raw_sql`) is strictly forbidden. All database queries must be strictly parameterized through prepared statements.
5. **Rule #5: Parameter-bound HMAC tickets**: Approval tickets are cryptographically bound (HMAC-SHA256) to specific parameters (`customer_id`, `reason`, `timestamp`). Tampering invalidates the ticket.
6. **Rule #6: Durable single-use idempotency**: Approved tickets can only be consumed once. Replay attempts are recorded as security violations.
7. **Rule #7: The MCP server itself must enforce security**: Authorization checks occur at the tool gateway, independent of any upstream proxy or agent framework.
8. **Rule #8: Append-only audit trail**: Every security evaluation, authorization decision, and tool execution is persisted in an immutable audit log.
9. **Rule #9: Zero secret & stack trace leakage**: Sensitive credentials (API keys, passwords, bearer tokens) and raw stack traces are scrubbed from error responses and logs.
10. **Rule #10: Fail closed**: If any security check, database query, or approval verification encounters an error or timeout, the operation is denied by default.

## Role-Based Access Control (RBAC)

| Role | Permissions |
|---|---|
| `admin` | Full read/write, policy editing, user management, and approval authorization. |
| `operator` | Read customer/order data, review audit logs, and submit operations for approval. |
| `viewer` | Read-only access to non-sensitive customer metadata; blocked from destructive tools. |
