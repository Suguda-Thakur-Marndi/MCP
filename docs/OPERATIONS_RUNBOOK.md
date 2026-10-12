# MCP-Sentinel Operations & Incident Runbook

> **Target Audience:** DevOps, SRE, On-Call Engineers, and System Operators  
> **Status:** Production-Ready (Phase 16 Operational Alignment)  
> **Scope:** Operational procedures, forward-compatible rollbacks, database backup/recovery, and incident response for MCP-Sentinel.

---

## 1. System Architecture Summary

MCP-Sentinel enforces human-in-the-loop gating, security policy evaluation, and audit logging between client requests (FastAPI) and backend MCP tool execution against PostgreSQL.

```
                  ┌───────────────────────────────┐
                  │      AWS Application Load     │
                  │      Balancer (ALB / TLS)     │
                  └──────────────┬────────────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 ▼                               ▼
       ┌──────────────────┐            ┌──────────────────┐
       │ Next.js Console  │            │  FastAPI Backend │
       │ (Port 3000)      │            │  (Port 8000)     │
       └──────────────────┘            └────────┬─────────┘
                                                │
                          ┌─────────────────────┴─────────────────────┐
                          ▼                                           ▼
               ┌─────────────────────┐                     ┌─────────────────────┐
               │ Multi-AZ RDS        │                     │ CloudWatch /        │
               │ PostgreSQL (5432)   │                     │ Prometheus Exporter │
               └─────────────────────┘                     └─────────────────────┘
```

---

## 2. Environment Configurations

| Environment | Host Port | Database Name | Auth Mode | Health Liveness | Health Readiness |
|-------------|-----------|---------------|-----------|-----------------|------------------|
| **Local Dev** | 8000 (API) / 3000 (UI) | `mcp_sentinel_db` | `ENABLE_TEST_AUTH=true` | `http://localhost:8000/health/live` | `http://localhost:8000/health/ready` |
| **CI/CD** | Dynamic (Docker runner) | `mcp_sentinel_test` | `ENABLE_TEST_AUTH=true` | Bounded container probe | SQL `pg_isready` + `/health/ready` |
| **Production** | 443 (ALB) -> 8000 | RDS Instance DB | Google OIDC / Strict JWT (`ENABLE_TEST_AUTH=false`) | `/health/live` (every 10s) | `/health/ready` (every 30s) |

---

## 3. Deployment & Secret Management

### 3.1 Secret Resolution Architecture

MCP-Sentinel utilizes `mcp_sentinel.config.secrets.SecretProvider`:
- **Local / Test:** `EnvSecretProvider` (reads from `.env` or system environment).
- **Production:** `AWSSecretsManagerProvider` using AWS IAM execution role (no hardcoded credentials).

### 3.2 Startup Validation Rules (Fail-Closed)
In `APP_ENV=production`, the application refuses to boot (`validate_production_startup`) if:
- `ENABLE_TEST_AUTH` is `true`.
- `JWT_SECRET_KEY` is under 32 characters or matches known CI defaults.
- `CORS_ALLOWED_ORIGINS` contains wildcard (`*`) when credentials are permitted.
- `SESSION_COOKIE_SECURE` is `false`.

---

## 4. Operational Health & Telemetry Verification

### 4.1 Real-Time Health Probes (LOCALLY TESTED & VERIFIED)

```bash
# 1. Liveness (process health - no dependency lock)
curl -s http://localhost:8000/health/live
# Expected: {"status":"live","timestamp":<EPOCH_TIMESTAMP>} (HTTP 200)

# 2. Readiness (DB connection + connection pool + MCP checks)
curl -s http://localhost:8000/health/ready
# Expected:
# {
#   "status": "ready",
#   "database": "connected",
#   "pool": {"total_connections": 10, "used_connections": 1, "free_connections": 9},
#   "mcp_server": "operational"
# }

# 3. Prometheus Metrics Scraping
curl -s http://localhost:8000/metrics | grep -E "sentinel_|mcp_"
```

---

## 5. Rollback Procedures (Forward-Compatible & Safe)

> [!CAUTION]
> Never execute automatic destructive database rollbacks (e.g. `DROP TABLE`, `DROP COLUMN`) during an emergency rollback. Downward migrations can destroy production customer records or security audit history.

### 5.1 Application Rollback (Zero Data Loss)
*Note: The following AWS commands represent documented procedures for production environments with AWS CLI configured. Never run production rollback commands without formal change approval.*

If a newly deployed container image exhibits regressions:

1. **ECS Deployment Rollback:**
   ```bash
   # Revert to previous task definition revision in ECS
   aws ecs update-service \
     --cluster <ECS_CLUSTER_NAME> \
     --service <ECS_SERVICE_NAME> \
     --task-definition <TASK_DEFINITION_FAMILY>:<PREVIOUS_REVISION_NUMBER>
   ```
2. **Verify Process Stabilization:**
   ```bash
   aws ecs wait services-stable \
     --cluster <ECS_CLUSTER_NAME> \
     --services <ECS_SERVICE_NAME>
   ```
3. **Verify Health:**
   Check ALB target group health: all targets must return HTTP 200 on `/health/live`.

### 5.2 Database Forward-Compatible Migration Strategy

Schema changes in `scripts/init_db.py` follow the **Expand/Contract** design:
1. **Expand (Pre-deploy):** Add new nullable columns or additive tables (`CREATE TABLE IF NOT EXISTS`). Both old and new application code function seamlessly.
2. **Deploy Application:** Deploy new application version utilizing new columns/tables.
3. **Contract (Post-deploy):** Remove deprecated elements only after verification and minimum 14-day retention cycle.

If a migration fails during deployment:
- **Do not drop schema.** Stop the migration script immediately.
- Inspect `audit_events` and database logs for deadlock or lock-timeout causes.
- Application code is backward-compatible with pre-migration schema structures.

---

## 6. Backup, Data Integrity & Disaster Recovery

### 6.1 Recovery Objectives & Storage Architecture

> [!NOTE]
> Recovery time and point objectives below are **architecture design targets** grounded in AWS RDS Multi-AZ capability, rather than empirical cross-region drill results (full cross-region drill deferred per Phase 14 risk register).

| Metric | Target | Status / Verification Method |
|---|---|---|
| **RPO (Recovery Point Objective)** | **< 15 minutes** (Continuous WAL: < 5 seconds) | Design Target: AWS RDS Point-in-Time Recovery log archiving |
| **RTO (Recovery Time Objective)** | **< 30 minutes** | Design Target: Automated script provisioning from target snapshot |
| **Backup Retention Period** | **35 days continuous** | Design Target: Automated RDS snapshots |
| **Audit Log Immutability** | **Append-Only Enforced** | **VERIFIED IMPLEMENTATION**: Database trigger `enforce_audit_events_append_only` (Migration 009) |
| **Audit WORM Retention (7 yr)** | **Long-Term Storage Target** | Design Target: Requires external AWS S3 Object Lock bucket provisioning |

### 6.2 RDS Automated & Manual Snapshots
*Note: AWS CLI commands below require appropriate IAM permissions and production access.*

1. **Automated Backups:**
   - RDS Multi-AZ instances maintain 35-day Point-In-Time Recovery (PITR) with continuous WAL archiving.
   - Snapshot window: 03:00 - 04:00 UTC daily.
   - Storage encryption: AWS KMS Customer Managed Keys (CMK) with automatic rotation.

2. **Pre-Deployment Manual Snapshot (Mandatory for Major Changes):**
   ```bash
   aws rds create-db-snapshot \
     --db-instance-identifier <RDS_INSTANCE_IDENTIFIER> \
     --db-snapshot-identifier "<RDS_INSTANCE_IDENTIFIER>-pre-deploy-$(date +%Y%m%d%H%M)"
   ```

### 6.3 Database Restore Playbook
*Note: Documented disaster-recovery procedure. Never execute database restore or instance teardown without explicit Authorization from Security and SRE Leadership.*

If data corruption, accidental truncation, or catastrophic failure occurs:

1. **Point-in-Time Recovery to New Instance:**
   ```bash
   aws rds restore-db-instance-to-point-in-time \
     --source-db-instance-identifier <SOURCE_RDS_INSTANCE_IDENTIFIER> \
     --target-db-instance-identifier <TARGET_RECOVERED_INSTANCE_IDENTIFIER> \
     --restore-time "<TARGET_RESTORE_TIMESTAMP_UTC>" \
     --db-subnet-group-name <DB_SUBNET_GROUP_NAME> \
     --vpc-security-group-ids <VPC_SECURITY_GROUP_ID>
   ```
2. **Verify Data Integrity & Approval Invariants:**
   Connect via bastion or internal utility to verify table rows and state transitions:
   ```sql
   SELECT count(*) FROM customers;
   SELECT count(*) FROM audit_events;
   SELECT status, count(*) FROM approval_requests GROUP BY status;
   SELECT count(*) FROM idempotency_records WHERE expires_at > NOW();
   ```
3. **Database Connectivity Interruption Recovery:**
   - When PostgreSQL is temporarily unavailable, the connection pool (`asyncpg`) attempts automatic reconnects with exponential backoff up to `DB_POOL_TIMEOUT_SECONDS`.
   - The `/health/ready` probe flips to HTTP 503, preventing traffic routing by ALB to unhealthy nodes.
   - In-flight requests fail closed safely with structured error messages; no uncommitted tool execution occurs.
4. **Cutover:**
   Update secret `<SECRETS_PREFIX>/database-url` in AWS Secrets Manager to point to `<TARGET_RECOVERED_INSTANCE_IDENTIFIER>`. Restart ECS tasks.

### 6.4 Concurrency & Approval State Transition Protection

Under high concurrent request volumes:
- **Single-Use Approval Consumption**: Guaranteed by atomic PostgreSQL transaction isolation:
  ```sql
  SELECT * FROM approval_requests WHERE ticket_id = $1 FOR UPDATE;
  -- If APPROVED: atomically updates to EXECUTING -> COMPLETED
  ```
- **Durable L1/L2 Idempotency**:
  - **L1 In-Memory Cache**: Immediate in-process deduplication and concurrent submission mutex locking via `asyncio.Lock`.
  - **L2 PostgreSQL Storage**: Persisted in `idempotency_records` table, surviving worker restarts and sharing state across multi-worker deployments.
- **Append-Only Audit Enforced**: All approval state transitions (`PENDING` -> `APPROVED` / `DENIED` -> `COMPLETED`) are logged into the append-only `audit_events` table with immutable SHA-256 integrity digests.

---

## 7. Incident Response Playbooks

### Incident 1: Spike in Approval Replay Attempts (`sentinel_approval_replays_blocked_total > 0`)
- **Condition:** Alert `ApprovalReplayDetected` fires.
- **Root Cause:** A client or malicious actor attempted to re-use an already executed or expired approval token.
- **Action:**
  1. Query `audit_events` for the correlation ID:
     ```sql
     SELECT * FROM audit_events 
     WHERE action = 'APPROVAL_REPLAY_ATTEMPT' 
     ORDER BY created_at DESC LIMIT 20;
     ```
  2. Inspect IP, user agent, and actor ID.
  3. If actor is compromised, revoke active sessions immediately via user management or rotate credentials.

### Incident 2: Database Connection Pool Exhaustion (`sentinel_db_pool_connections{state="free"} < 2`)
- **Condition:** Alert `DatabaseConnectionPoolHigh` fires.
- **Root Cause:** High concurrent traffic, unreleased connections, or slow queries blocking connections.
- **Action:**
  1. Check active database locks and query durations:
     ```sql
     SELECT pid, now() - query_start AS duration, query, state 
     FROM pg_stat_activity 
     WHERE state != 'idle' 
     ORDER BY duration DESC;
     ```
  2. Cancel rogue long-running read query (safe cancel without dropping connection):
     ```sql
     SELECT pg_cancel_backend(PID);
     ```
     > [!CAUTION]
     > Do NOT use `pg_terminate_backend` unless a query is actively deadlocked and `pg_cancel_backend` has failed. Terminating a backend drops the database socket and can cause connection pool instability.
  3. Adjust pool ceiling (`DB_POOL_MAX_SIZE`) in environment / Secrets Manager and cycle container tasks.

### Incident 3: Foundation Model Latency / Error Spike (`sentinel_model_latency_seconds > 5.0`)
- **Condition:** Alert `FoundationModelLatencyHigh` or `sentinel_model_requests_total` failure rate > 5%.
- **Root Cause:** Upstream Gemini / provider throttling, outage, or unusually large prompt payload.
- **Action:**
  1. Check Prometheus metrics for model latency:
     ```promql
     histogram_quantile(0.95, sum(rate(sentinel_model_latency_seconds_bucket[5m])) by (le, model))
     ```
  2. If upstream service degradation: Agent requests automatically fail safely with bounded timeout (`AGENT_EXECUTION_TIMEOUT_SECONDS=60.0s`), protecting server threads.
  3. Verify token usage in `sentinel_model_tokens_total` to ensure prompt injection loops are not driving consumption.

### Incident 4: MCP Subprocess / Connection Drop (`sentinel_mcp_tool_failures_total rate > 0.1`)
- **Condition:** Alert `MCPServerDown` fires.
- **Root Cause:** MCP subprocess failure, stdio pipe break, or memory constraint.
- **Action:**
  1. Inspect container logs with correlation ID:
     ```bash
     docker logs <CONTAINER_NAME> --tail 100 | grep -E "mcp|connector"
     ```
  2. The system automatically fails closed: requests requiring tools fail safely with HTTP 503 / 502 instead of bypassing security gates.
  3. Cycle the container task to restart the subagent worker pool.

---

## 8. Operational Commands Reference & Classification

| Operation | Command / Endpoint | Classification | Verified In Test Suite |
|-----------|--------------------|----------------|------------------------|
| **Liveness Probe** | `GET /health/live` | **Locally Tested** | `tests/test_phase9_observability.py` |
| **Readiness Probe** | `GET /health/ready` | **Locally Tested** | `tests/test_phase9_observability.py` |
| **Prometheus Metrics** | `GET /metrics` | **Locally Tested** | `tests/test_phase9_observability.py` |
| **DB Schema Migration** | `python scripts/init_db.py` | **Locally Tested** | CI Workflow + Local |
| **Synthetic DB Seeding** | `python scripts/seed_database.py` | **Locally Tested** | CI Workflow + Local |
| **Full Pytest Suite** | `python -m pytest tests/` | **Locally Tested** | 478/478 Passed |
| **Security Evaluation** | `python scripts/run_security_evaluation.py` | **Locally Tested** | Automated attack suite |
| **ECS Task Rollback** | `aws ecs update-service --task-definition ...` | *Cloud Documented Procedure* | Requires AWS ECS access |
| **RDS Point-in-Time Restore**| `aws rds restore-db-instance-to-point-in-time` | *Cloud Documented Procedure* | Requires AWS RDS access |
