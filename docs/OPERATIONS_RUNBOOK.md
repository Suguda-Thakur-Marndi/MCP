# MCP-Sentinel Operations & Incident Runbook

> **Target Audience:** DevOps, SRE, On-Call Engineers, and System Operators  
> **Status:** Production-Ready  
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
In `APP_ENV=production`, the application refuses to boot if:
- `ENABLE_TEST_AUTH` is `true`.
- `JWT_SECRET_KEY` is under 32 characters or matches known CI defaults.
- `CORS_ALLOWED_ORIGINS` contains wildcard (`*`) when credentials are permitted.
- `COOKIE_SECURE` is `false`.

---

## 4. Operational Health & Telemetry Verification

### 4.1 Real-Time Health Probes

```bash
# 1. Liveness (process health - no dependency lock)
curl -s http://localhost:8000/health/live
# Expected: {"status":"live","timestamp":1726470000.0} (HTTP 200)

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
curl -s http://localhost:8000/metrics | grep mcp_
```

---

## 5. Rollback Procedures (Forward-Compatible & Safe)

> [!CAUTION]
> Never execute automatic destructive database rollbacks (e.g. `DROP TABLE`, `DROP COLUMN`) during an emergency rollback. Downward migrations can destroy production customer records or security audit history.

### 5.1 Application Rollback (Zero Data Loss)

If a newly deployed container image exhibits regressions:

1. **ECS Deployment Rollback:**
   ```bash
   # Revert to previous task definition revision in ECS
   aws ecs update-service \
     --cluster mcp-sentinel-cluster \
     --service mcp-sentinel-api \
     --task-definition mcp-sentinel-api:PREVIOUS_REVISION_NUMBER
   ```
2. **Verify Process Stabilization:**
   ```bash
   aws ecs wait services-stable \
     --cluster mcp-sentinel-cluster \
     --services mcp-sentinel-api
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

## 6. Backup and Disaster Recovery

### 6.1 RDS Automated & Manual Snapshots

1. **Automated Backups:**
   - RDS Multi-AZ instances maintain 35-day Point-In-Time Recovery (PITR) with continuous WAL archiving.
   - Snapshot window: 03:00 - 04:00 UTC daily.

2. **Pre-Deployment Manual Snapshot (Mandatory for Major Changes):**
   ```bash
   aws rds create-db-snapshot \
     --db-instance-identifier mcp-sentinel-prod-db \
     --db-snapshot-identifier "mcp-sentinel-pre-deploy-$(date +%Y%m%d%H%M)"
   ```

### 6.2 Database Restore Playbook

If data corruption or catastrophic failure occurs:

1. **Point-in-Time Recovery to New Instance:**
   ```bash
   aws rds restore-db-instance-to-point-in-time \
     --source-db-instance-identifier mcp-sentinel-prod-db \
     --target-db-instance-identifier mcp-sentinel-recovered-db \
     --restore-time "2026-09-16T04:30:00Z" \
     --db-subnet-group-name mcp-sentinel-db-subnet-group \
     --vpc-security-group-ids sg-0123456789abcdef0
   ```
2. **Verify Data Integrity:**
   Connect via bastion or internal utility to verify table rows:
   ```sql
   SELECT count(*) FROM customers;
   SELECT count(*) FROM audit_events;
   ```
3. **Cutover:**
   Update secret `mcp-sentinel/production/database-url` in AWS Secrets Manager to point to `mcp-sentinel-recovered-db`. Restart ECS tasks.

---

## 7. Incident Response Playbooks

### Incident 1: Spike in Approval Replay Attempts (`mcp_approval_replay_attempts_total > 0`)
- **Condition:** Prometheus alert `ApprovalReplayDetected` fires.
- **Root Cause:** A client or malicious actor attempted to re-use an already executed or expired approval token.
- **Action:**
  1. Query `audit_events` for the correlation ID:
     ```sql
     SELECT * FROM audit_events 
     WHERE action = 'APPROVAL_REPLAY_ATTEMPT' 
     ORDER BY created_at DESC LIMIT 20;
     ```
  2. Inspect IP, user agent, and actor ID.
  3. If actor is compromised, revoke active JWT sessions immediately by invalidating user in `users` table or rotating `JWT_SECRET_KEY` if widespread.

### Incident 2: Database Connection Pool Exhaustion (`mcp_db_pool_utilization > 85%`)
- **Condition:** Prometheus alert `DatabaseConnectionPoolHigh` fires.
- **Root Cause:** High concurrent traffic, unreleased connections, or slow queries blocking connections.
- **Action:**
  1. Check active database locks and query durations:
     ```sql
     SELECT pid, now() - query_start AS duration, query, state 
     FROM pg_stat_activity 
     WHERE state != 'idle' 
     ORDER BY duration DESC;
     ```
  2. Terminate rogue long-running read queries if blocking transactions:
     ```sql
     SELECT pg_cancel_backend(PID);
     ```
  3. Increase pool ceiling if legitimate organic load: adjust `DB_POOL_MAX_SIZE` in Secrets Manager and cycle container tasks.

### Incident 3: MCP Subprocess / Connection Drop (`mcp_health_status{dependency="mcp_server"} == 0`)
- **Condition:** Prometheus alert `MCPServerDown` fires.
- **Root Cause:** MCP subprocess failure, stdio pipe break, or memory constraint.
- **Action:**
  1. Inspect container logs with correlation ID:
     ```bash
     docker logs mcp-sentinel-api --tail 100 | grep -E "mcp|subprocess"
     ```
  2. The system automatically fails closed: requests requiring tools fail safely with HTTP 503 instead of bypassing security gates.
  3. Cycle the container task to restart the subagent worker pool.

---

## 8. Verification & Operational Commands Reference

| Operation | Command / Endpoint | Status |
|-----------|--------------------|--------|
| **Liveness Probe** | `GET /health/live` | **TESTED** |
| **Readiness Probe** | `GET /health/ready` | **TESTED** |
| **Prometheus Metrics** | `GET /metrics` | **TESTED** |
| **DB Schema Check** | `python scripts/init_db.py` | **TESTED** |
| **Synthetic DB Seeding** | `python scripts/seed_database.py` | **TESTED** |
| **Pytest Full Suite** | `python -m pytest tests/` | **TESTED** |
| **Security Evaluation** | `python scripts/run_security_evaluation.py` | **TESTED** |
| **ECS Task Cycle** | `aws ecs update-service --force-new-deployment` | *PRODUCTION DOCUMENTED* |
| **RDS Point-in-Time Restore**| `aws rds restore-db-instance-to-point-in-time` | *PRODUCTION DOCUMENTED* |
