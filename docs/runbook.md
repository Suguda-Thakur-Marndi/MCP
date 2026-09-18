# MCP-Sentinel — Production Operations & Incident Response Runbook

> **Standard Operating Procedures (SOPs), Routine Maintenance, Incident Response Workflows, and Recovery Runbooks**

---

## 1. Service Lifecycle & Health Management

### Service Ports & Probes
- **FastAPI API Gateway**: Port `8000`
  - Liveness: `GET /health/live` (Checks event loop responsiveness; returns HTTP 200).
  - Readiness: `GET /health/ready` (Verifies PostgreSQL connection pool; returns HTTP 200).
  - Metrics: `GET /metrics` (Prometheus text format).
- **Next.js Web Console**: Port `3000`
  - Liveness: `GET /` (HTTP 200).
- **PostgreSQL 16**: Port `5432` (internal network; `127.0.0.1` in development).

### Service Startup & Shutdown
```bash
# Start all containers in background
docker compose up -d

# View container logs
docker compose logs -f api

# Graceful stack shutdown
docker compose down
```

---

## 2. Routine Database Maintenance

### Schema Migrations
Migrations are managed in `mcp_sentinel/database/migrations/` (001 through 007).
```bash
# Apply pending migrations
python scripts/init_db.py
```

### Database Backup & Restore
```bash
# Take a point-in-time logical backup
docker compose exec postgres pg_dump -U postgres -d mcp_sentinel_db -F c -b -v -f /var/lib/postgresql/data/backup_$(date +%Y%m%d).dump

# Restore from backup
docker compose exec postgres pg_restore -U postgres -d mcp_sentinel_db -v /var/lib/postgresql/data/backup_20260916.dump
```

---

## 3. Secret & Credential Rotation Procedures

### Rotating JWT Signing Secret (`JWT_SECRET_KEY`)
1. Generate a cryptographically secure 64-character token:
   ```bash
   python -c "import secrets; print(secrets.token_urlsafe(48))"
   ```
2. Update `JWT_SECRET_KEY` in production environment / AWS Secrets Manager.
3. Perform a zero-downtime rolling restart of the API containers.
4. *Impact*: Active user sessions will expire and require re-authentication; active approval tickets in PostgreSQL remain valid as their SHA-256 parameter hashes are independent of JWT signatures.

### Rotating Google OAuth Client Secret
1. Generate a new client secret in Google Cloud Console $\to$ APIs & Services $\to$ Credentials.
2. Update `GOOGLE_CLIENT_SECRET` in environment variables.
3. Restart API service.

---

## 4. Incident Response Playbooks

### Incident 1: Spike in `CRITICAL` Gating Tickets (Suspected Attack)
- **Trigger**: Prometheus alert `HighApprovalRejectionRate` or sudden surge in pending approval tickets.
- **Triage Steps**:
  1. Inspect live tickets via the Security Console or API:
     ```bash
     curl -H "X-Sentinel-User-Role: auditor" http://localhost:8000/api/approvals/pending
     ```
  2. Query recent security audit events:
     ```bash
     docker compose exec postgres psql -U postgres -d mcp_sentinel_db -c "
     SELECT created_at, actor_id, tool_name, decision, details->>'reason' 
     FROM audit_events 
     WHERE decision IN ('REQUIRE_APPROVAL', 'DENY') 
     ORDER BY created_at DESC LIMIT 20;"
     ```
  3. If an attacker is repeatedly provoking destructive tool calls via prompt injection, identify the caller's session/IP and revoke their active session token in `user_sessions`.

### Incident 2: Database Connection Pool Exhaustion
- **Trigger**: `/health/ready` returns HTTP 503; logs show `asyncpg.exceptions.TooManyConnectionsError`.
- **Mitigation Steps**:
  1. Check current connection usage:
     ```sql
     SELECT count(*), state FROM pg_stat_activity GROUP BY state;
     ```
  2. Adjust pool parameters in `.env`:
     ```env
     DB_POOL_MAX_SIZE=25
     DB_POOL_TIMEOUT_SECONDS=15.0
     ```
  3. Restart FastAPI container.
