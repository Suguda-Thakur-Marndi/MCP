# MCP-Sentinel Deployment Guide

> This guide covers local development, Docker Compose, and production deployment.

---

## 1. Prerequisites

| Tool | Required Version | Purpose |
|------|-----------------|---------|
| Python | 3.12+ | Backend runtime |
| Node.js | 20+ | Frontend build |
| PostgreSQL | 16+ | Database |
| Docker | 24+ | Container runtime |
| Docker Compose | v2+ | Multi-service orchestration |

---

## 2. Environment Variables

Copy `.env.example` to `.env` and fill in all required values:

```bash
cp .env.example .env
```

### Required Variables

```env
# Database (required)
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/mcp_sentinel_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_strong_password
POSTGRES_DB=mcp_sentinel_db

# JWT Authentication (required — change in production)
JWT_SECRET_KEY=generate-a-64-byte-random-string-here
JWT_ALGORITHM=HS256
JWT_EXPIRATION_MINUTES=60

# Application
APP_ENV=development        # development | staging | production
LOG_LEVEL=INFO
ENABLE_TEST_AUTH=true      # Must be false in production
```

### Optional Variables

```env
# AI Agent (optional — required for live agent chat)
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash

# Google OIDC (optional — for production authentication)
GOOGLE_CLIENT_ID=your_google_client_id

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000
```

**Generate a secure JWT_SECRET_KEY:**
```bash
python -c "import secrets; print(secrets.token_hex(64))"
```

---

## 3. Local Development (No Docker)

### 3.1 Backend Setup

```bash
# 1. Create virtual environment
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # Linux/macOS

# 2. Install dependencies
pip install -r requirements.txt

# 3. Initialize database schema (migrations 001–007)
python scripts/init_db.py

# 4. Seed synthetic test data
python scripts/seed_database.py

# 5. Start FastAPI backend
uvicorn mcp_sentinel.api.app:app --reload --port 8000
```

Backend runs at: http://localhost:8000  
Swagger UI (dev only): http://localhost:8000/docs

### 3.2 Frontend Setup

```bash
cd web
npm install
npm run dev
```

Frontend runs at: http://localhost:3000

### 3.3 Run Tests

```bash
# Full test suite (388 tests)
.venv\Scripts\pytest tests\ -v

# Security evaluation (84 test cases across 20 categories)
python scripts/run_security_evaluation.py
```

---

## 4. Docker Compose Deployment

```bash
# Build and start all services (postgres + api + web)
docker compose up --build -d

# View logs
docker compose logs -f api
docker compose logs -f web

# Initialize DB schema (first run only)
docker compose exec api python scripts/init_db.py

# Seed test data (optional)
docker compose exec api python scripts/seed_database.py

# Stop all services
docker compose down
```

Services:
- **PostgreSQL**: `localhost:5432`
- **FastAPI API**: `localhost:8000` (docs at `/docs` in dev)
- **Next.js Console**: `localhost:3000`

---

## 5. Production Hardening Checklist

Before deploying to production, verify each item:

### Security
- [ ] `ENABLE_TEST_AUTH=false`
- [ ] `APP_ENV=production` (disables `/docs` and `/redoc`)
- [ ] `JWT_SECRET_KEY` rotated from default (64+ random bytes)
- [ ] `POSTGRES_PASSWORD` is a strong, unique password
- [ ] CORS `allow_origins` in `app.py` updated to production frontend domain
- [ ] TLS termination configured at reverse proxy (nginx/ALB)
- [ ] PostgreSQL not exposed on `0.0.0.0`; only accessible via `sentinel-net`

### Infrastructure
- [ ] Persistent volume for PostgreSQL data backed up
- [ ] Health checks confirmed passing for all services
- [ ] Log aggregation configured (e.g., Loki, CloudWatch, Datadog)
- [ ] Alert on repeated BLOCK decisions in `audit_events` (intrusion detection signal)

### CI/CD
- [ ] GitHub Actions CI passing (all 4 jobs: lint, test, frontend build, Docker build)
- [ ] Security evaluation 25/25 scenarios passing
- [ ] Docker images tagged with commit SHA

---

## 6. Production Architecture Reference

```
Internet
   │
   ▼ HTTPS:443
┌──────────────┐
│  nginx/ALB   │  (TLS termination, rate limiting)
│  Reverse     │
│  Proxy       │
└──┬───────────┘
   │ HTTP:3000     │ HTTP:8000
   ▼               ▼
┌──────────┐   ┌───────────────┐
│  Next.js │   │  FastAPI API  │
│  Console │   │  (uvicorn)    │
└──────────┘   └───────┬───────┘
                       │ TCP:5432
               ┌───────▼───────┐
               │  PostgreSQL   │
               │  (persistent  │
               │   volume)     │
               └───────────────┘
```

---

## 7. Database Migrations

Migrations are applied sequentially by `scripts/init_db.py`:

| Migration | Description |
|-----------|-------------|
| `001_initial_schema.sql` | Core tables: `customers`, `orders`, `audit_events` |
| `002_audit_enhancements.sql` | Audit log enhancements and indexes |
| `003_gating_tickets.sql` | Legacy approval tickets (`gating_approval_tickets`) |
| `004_production_security_approvals_and_auth.sql` | Production `approval_requests` table + `users` table |
| `005_customer_audit_notes.sql` | Structured customer audit notes table |
| `006_test_user_passwords.sql` | Seed authentication credentials for dev/test users |
| `007_refresh_tokens.sql` | Refresh token lifecycle management and revocation |

Run migrations:
```bash
python scripts/init_db.py
```

Migrations are idempotent (`CREATE TABLE IF NOT EXISTS`) and safe to re-run.

---

## 8. Monitoring & Observability

### Health Endpoints

MCP-Sentinel implements decoupled liveness and readiness probes:

```
GET /health/live   → {"status": "live", "timestamp": 1726470000.0}
                     (Process alive check, no dependency locking)

GET /health/ready  → {"status": "ready", "database": "connected", "pool": {"total_connections": 10, "used_connections": 1, "free_connections": 9}, "mcp_server": "operational"}
                     (Deep dependency validation: DB query, pool status, MCP connectivity)

GET /health        → Legacy health compatibility endpoint
GET /ready         → Legacy readiness compatibility endpoint
```

### Prometheus Metrics

Prometheus metrics are exposed in Prometheus text format at `/metrics`:

```
GET /metrics
```

Collected metric categories:
- `mcp_http_requests_total`: Counter by method, endpoint, status_code
- `mcp_http_request_duration_seconds`: Histogram of HTTP latency
- `mcp_agent_invocations_total`: Counter by model, status
- `mcp_tool_executions_total`: Counter by tool_name, status
- `mcp_policy_decisions_total`: Counter by decision (ALLOW, REQUIRE_APPROVAL, DENY, REDACT)
- `mcp_approval_lifecycle_total`: Counter by action (CREATED, APPROVED, DENIED, EXPIRED)
- `mcp_approval_replay_attempts_total`: Counter tracking replay detection
- `mcp_rate_limit_exceeded_total`: Counter by endpoint
- `mcp_db_pool_connections`: Gauge tracking total, used, and free connections

### Request Correlation & Structured Audit Logging

Every inbound request is assigned or validated with `X-Request-ID` and `X-Trace-ID` response headers:
- `X-Request-ID`: Client-provided UUID or server-generated hex token
- `X-Trace-ID`: OpenTelemetry W3C trace ID or hex correlation token

All security events are recorded in structured JSON with credentials and PII automatically scrubbed:

```sql
-- Recent blocked actions (potential attacks)
SELECT * FROM audit_events
WHERE decision IN ('BLOCKED', 'REJECTED')
ORDER BY created_at DESC LIMIT 50;

-- Approval replay attempts
SELECT * FROM audit_events
WHERE action = 'APPROVAL_REPLAY_ATTEMPT'
ORDER BY created_at DESC;

-- Approval lifecycle summary
SELECT status, COUNT(*) FROM approval_requests
GROUP BY status;

-- Agent activity by hour
SELECT DATE_TRUNC('hour', created_at) AS hour, COUNT(*)
FROM audit_events GROUP BY 1 ORDER BY 1 DESC LIMIT 24;
```

