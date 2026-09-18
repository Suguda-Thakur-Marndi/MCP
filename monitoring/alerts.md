# MCP-Sentinel Production Operational Alerting Catalog

> **Version:** 1.0.0 | **Last Updated:** Phase 9 Production Hardening  
> **Source Metrics:** Prometheus exposition format via `GET /metrics`

---

## 1. Alert Summary Matrix

| Alert Name | Severity | Condition | Impact | Operator Playbook |
|------------|----------|-----------|--------|-------------------|
| `SentinelBackendDown` | **CRITICAL** | `up{job="sentinel-api"} == 0` for 1m | Total platform outage | [Playbook 1](#playbook-1-backend-down) |
| `SentinelDatabaseDisconnected` | **CRITICAL** | `sentinel_db_pool_connections{state="total"} == 0` or `/health/ready` != 200 for 1m | Complete database outage; agent & policy fail-closed | [Playbook 2](#playbook-2-database-disconnected) |
| `SentinelHighHttpErrorRate` | **CRITICAL** | Rate of 5xx errors > 5% over 5m | Widespread client failures | [Playbook 3](#playbook-3-high-error-rate) |
| `SentinelApprovalReplaySpike` | **CRITICAL** | `rate(sentinel_approval_replays_blocked_total[5m]) > 0` | Potential replay attack against destructive tools | [Playbook 4](#playbook-4-approval-replay-attack) |
| `SentinelAuthBruteForce` | **HIGH** | `rate(sentinel_auth_failures_total[5m]) > 0.2` (>10 in 1m) | Credential stuffing or brute force | [Playbook 5](#playbook-5-authentication-brute-force) |
| `SentinelAuthorizationDenialSpike` | **HIGH** | `rate(sentinel_authorization_denials_total[5m]) > 0.5` | Unauthorized privilege escalation attempts | [Playbook 6](#playbook-6-authorization-denial-spike) |
| `SentinelDatabasePoolSaturated` | **HIGH** | `sentinel_db_pool_connections{state="used"} / sentinel_db_pool_connections{state="total"} > 0.9` for 3m | Connection starvation risk | [Playbook 7](#playbook-7-pool-saturation) |
| `SentinelHighHttpLatency` | **WARNING** | `histogram_quantile(0.95, sum(rate(sentinel_http_request_duration_seconds_bucket[5m])) by (le)) > 1.5` | Degraded client experience | [Playbook 8](#playbook-8-elevated-latency) |
| `SentinelMcpToolFailureSpike` | **WARNING** | `rate(sentinel_mcp_tool_failures_total[5m]) > 0.1` | Agent tool execution issues | [Playbook 9](#playbook-9-tool-failures) |
| `SentinelAgentLoopLimitExceeded` | **WARNING** | `rate(sentinel_agent_invocations_total{status="max_iterations_reached"}[5m]) > 0` | Agent stuck in infinite reasoning loop | [Playbook 10](#playbook-10-agent-loop) |

---

## 2. Operational Playbooks

### Playbook 1: Backend Down (`SentinelBackendDown`)
1. **Verify Process State:**
   ```bash
   # Check container status
   docker compose ps api
   # Or on AWS ECS
   aws ecs describe-tasks --cluster sentinel-cluster --tasks <task-arn>
   ```
2. **Inspect Container Crash Logs:**
   ```bash
   docker compose logs --tail=100 api
   ```
3. **Verify Liveness:**
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/health/live
   ```
4. **Remediation:**
   - If container ran out of memory, check ECS task definition memory limit.
   - If startup configuration validation failed (e.g. invalid JWT key in production), verify secret variables in AWS Secrets Manager or environment.

---

### Playbook 2: Database Disconnected (`SentinelDatabaseDisconnected`)
1. **Verify Readiness:**
   ```bash
   curl -v http://localhost:8000/health/ready
   ```
2. **Check PostgreSQL Container / RDS Instance:**
   ```bash
   docker compose exec postgres pg_isready -U postgres -d mcp_sentinel_db
   # On RDS
   aws rds describe-db-instances --db-instance-identifier sentinel-db
   ```
3. **Verify Security Groups & Network:**
   - Verify port 5432 is accessible from the API container subnet.
   - Check for connection exhaustion on the PostgreSQL server.

---

### Playbook 3: High Error Rate (`SentinelHighHttpErrorRate`)
1. **Identify Failing Routes:**
   ```sql
   -- Inspect audit_events for recent errors
   SELECT event_type, decision, details, created_at
   FROM audit_events
   WHERE decision IN ('FAIL', 'ERROR')
   ORDER BY created_at DESC LIMIT 25;
   ```
2. **Filter API Logs by Request ID:**
   ```bash
   docker compose logs api | grep "ERROR"
   ```

---

### Playbook 4: Approval Replay Attack (`SentinelApprovalReplaySpike`)
> [!CAUTION]
> Replay attempts against destructive tools (`delete_customer`, `purge_inactive_customer_data`) indicate a compromised client, rogue actor, or malicious automated script attempting to reuse previously signed tickets.

1. **Query Blocked Replay Events:**
   ```sql
   SELECT * FROM audit_events
   WHERE event_type = 'APPROVAL_REPLAY_BLOCKED'
   ORDER BY created_at DESC LIMIT 10;
   ```
2. **Identify Offending Actor / Token:**
   - Extract `ticket_id`, `request_id`, and `actor_id` from event details.
   - Inspect whether the associated user account should be temporarily suspended:
     ```sql
     UPDATE users SET status = 'SUSPENDED' WHERE id = '<actor-id>';
     ```
3. **Notify Security Incident Response Team.**

---

### Playbook 5: Authentication Brute Force (`SentinelAuthBruteForce`)
1. **Inspect Login Failures:**
   ```sql
   SELECT actor_id, details, created_at
   FROM audit_events
   WHERE event_type = 'LOGIN_FAILURE'
   ORDER BY created_at DESC LIMIT 50;
   ```
2. **Verify Rate Limiter Status:**
   - Rate limiter automatically throttles `/api/auth/login` to 5 attempts/minute with HTTP 429.
   - If originating from a single IP, block IP at AWS WAF or ALB level.

---

### Playbook 6: Authorization Denial Spike (`SentinelAuthorizationDenialSpike`)
1. **Inspect Denied Actions:**
   ```sql
   SELECT actor_id, tool_name, details, created_at
   FROM audit_events
   WHERE decision IN ('DENY', 'BLOCKED') AND event_type IN ('AUTHORIZATION_DENIED', 'POLICY_DECISION')
   ORDER BY created_at DESC LIMIT 25;
   ```
2. **Verify Token Roles:**
   - Check if an operator or viewer role was accidentally used for an admin-only tool.

---

### Playbook 7: Pool Saturation (`SentinelDatabasePoolSaturated`)
1. **Check Pool Utilization:**
   ```bash
   curl -s http://localhost:8000/health/ready | jq .pool
   ```
2. **Check PostgreSQL Active Connections:**
   ```sql
   SELECT count(*), state FROM pg_stat_activity GROUP BY state;
   ```
3. **Remediation:**
   - Tune `DB_POOL_MAX_SIZE` (default 10) in settings if concurrent API traffic has increased.

---

### Playbook 8: Elevated Latency (`SentinelHighHttpLatency`)
1. **Check Database Query Duration:**
   - Inspect `sentinel_db_query_duration_seconds` metric.
2. **Check External LLM Call Latency:**
   - Inspect `sentinel_agent_duration_seconds`. Gemini API round-trips usually take 500ms–2000ms.

---

### Playbook 9: MCP Tool Failures (`SentinelMcpToolFailureSpike`)
1. **Inspect Tool Failure Details:**
   ```sql
   SELECT tool_name, decision, details, created_at
   FROM audit_events
   WHERE tool_name IS NOT NULL AND decision IN ('FAIL', 'BLOCK')
   ORDER BY created_at DESC LIMIT 20;
   ```

---

### Playbook 10: Agent Loop Protection (`SentinelAgentLoopLimitExceeded`)
1. **Inspect Loop Abort Events:**
   ```sql
   SELECT * FROM audit_events
   WHERE event_type = 'LOOP_LIMIT_EXCEEDED'
   ORDER BY created_at DESC LIMIT 10;
   ```
2. **Review User Prompt:**
   - Identify prompt injection attempts designed to force cyclical tool requests.
   - Confirm that platform loop limit (`MAX_AGENT_ITERATIONS=10`) correctly aborted execution without side effects.
