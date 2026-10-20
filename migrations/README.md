# Database Migrations Index (`migrations/`)

MCP Sentinel utilizes sequential, idempotent SQL schema migrations to provision tables, indices, and least-privilege PostgreSQL roles.

> [!NOTE]
> Canonical migration SQL files reside in [`mcp_sentinel/database/migrations/`](file:///mcp_sentinel/database/migrations/) to ensure zero-overhead packaging inside the Python module and compatibility with Docker build contexts.

---

## Migration Manifest (001–012)

| Version | Migration Script | Purpose |
|---|---|---|
| `001` | [`001_initial_schema.sql`](file:///mcp_sentinel/database/migrations/001_initial_schema.sql) | Base schema: `customers`, `orders`, `customer_audit_notes`. |
| `002` | [`002_least_privilege_roles.sql`](file:///mcp_sentinel/database/migrations/002_least_privilege_roles.sql) | Least-privilege PostgreSQL database roles (`mcp_readonly`, `mcp_writer`, `mcp_destructive`). |
| `003` | [`003_enterprise_orders_audit_schema.sql`](file:///mcp_sentinel/database/migrations/003_enterprise_orders_audit_schema.sql) | Comprehensive indexing, check constraints, and customer tier definitions. |
| `004` | [`004_production_security_approvals_and_auth.sql`](file:///mcp_sentinel/database/migrations/004_production_security_approvals_and_auth.sql) | Approval gating tables and initial user security profiles. |
| `005` | [`005_approval_state_machine_and_lifecycle.sql`](file:///mcp_sentinel/database/migrations/005_approval_state_machine_and_lifecycle.sql) | Approval ticket lifecycle state machine (`PENDING`, `APPROVED`, `REJECTED`, `EXPIRED`, `CONSUMED`). |
| `006` | [`006_production_auth_users_and_sessions.sql`](file:///mcp_sentinel/database/migrations/006_production_auth_users_and_sessions.sql) | Enterprise session store and user credentials. |
| `007` | [`007_security_evaluation_schema.sql`](file:///mcp_sentinel/database/migrations/007_security_evaluation_schema.sql) | Security evaluation test run tracking and verification evidence logs. |
| `008` | [`008_multi_software_connector_gateway.sql`](file:///mcp_sentinel/database/migrations/008_multi_software_connector_gateway.sql) | Connector credential store and integration registrations. |
| `009` | [`009_audit_events_append_only.sql`](file:///mcp_sentinel/database/migrations/009_audit_events_append_only.sql) | Strictly append-only audit event log with immutability guarantees. |
| `010` | [`010_approval_hmac_signature.sql`](file:///mcp_sentinel/database/migrations/010_approval_hmac_signature.sql) | HMAC-SHA256 parameter-bound cryptographic signatures on approval tickets. |
| `011` | [`011_durable_idempotency.sql`](file:///mcp_sentinel/database/migrations/011_durable_idempotency.sql) | Durable idempotency keys table to prevent duplicate execution of destructive operations. |
| `012` | [`012_prune_out_of_scope_tables.sql`](file:///mcp_sentinel/database/migrations/012_prune_out_of_scope_tables.sql) | Schema clean-up pruning obsolete legacy demo tables. |

---

## Applying Migrations

Migrations are applied sequentially via:

```bash
python scripts/init_db.py
# or
python scripts/database/init_db.py
```

To inspect migration status without executing SQL:

```bash
python scripts/init_db.py --check-only
```
