# MCP-Sentinel — Demo Troubleshooting & Safety Runbook

> **Pre-Flight Verification, Failure Recovery Procedures, and Safety Rules for Live Demonstrations**

---

## 1. Pre-Demo Health Verification (The 60-Second Check)

Execute these checks 5 minutes before any presentation or interview:

```bash
# 1. Check PostgreSQL Database Connectivity
python -c "
import asyncio, asyncpg, os
from mcp_sentinel.config.settings import get_settings
async def check():
    conn = await asyncpg.connect(get_settings().DATABASE_URL)
    count = await conn.fetchval('SELECT count(*) FROM customers')
    print(f'[OK] Database connected: {count} customer records found.')
    await conn.close()
asyncio.run(check())
"

# 2. Check Backend API Liveness & Readiness
curl -f http://localhost:8000/health/live && echo " -> Backend Live"
curl -f http://localhost:8000/health/ready && echo " -> Backend Ready"

# 3. Check Frontend Dashboard Availability
curl -f http://localhost:3000/ > /dev/null && echo "[OK] Frontend Console accessible at :3000"

# 4. Verify Gemini API Key Presence
python -c "
from mcp_sentinel.config.settings import get_settings
s = get_settings()
assert s.GEMINI_API_KEY, 'GEMINI_API_KEY is missing in .env!'
print(f'[OK] Gemini API Key loaded: {s.masked_gemini_api_key}')
"
```

---

## 2. Emergency Failure Recovery Procedures

### Scenario A: PostgreSQL Database Unavailable
- **Symptom**: Backend logs show `ConnectionRefusedError: [Errno 111] Connect call failed` or `/health/ready` returns 503.
- **Root Cause**: PostgreSQL service stopped or port mismatch.
- **Recovery Steps**:
  1. If running Docker:
     ```bash
     docker compose restart postgres
     docker compose ps
     ```
  2. If running local PostgreSQL:
     ```powershell
     net start postgresql-x64-16 # (or verify local port in .env)
     ```
  3. Re-run migrations and seeding:
     ```bash
     python scripts/init_db.py
     python scripts/seed_database.py
     ```

---

### Scenario B: FastMCP Server Unavailable or Unresponsive
- **Symptom**: Agent queries return `TOOL_TIMEOUT` or `Connection to MCP transport failed`.
- **Root Cause**: Standalone MCP subprocess crashed or `MCP_SERVER_URL` is misconfigured.
- **Recovery Steps**:
  1. In `.env`, ensure `MCP_SERVER_URL=` is left **blank** (or unset). This causes the agent to instantiate FastMCP in-process using native async calls, eliminating network hop failures.
  2. Restart the FastAPI backend server:
     ```powershell
     .venv\Scripts\python.exe -m uvicorn mcp_sentinel.api.app:app --host 0.0.0.0 --port 8000 --reload
     ```

---

### Scenario C: Gemini API Rate Limited or Network Timeout
- **Symptom**: Agent returns HTTP 429 or `google.genai.errors.APIError: Quota exceeded`.
- **Recovery Steps**:
  1. Switch to a fallback model in `.env`:
     ```env
     GEMINI_MODEL=gemini-2.5-flash
     ```
  2. If using a personal free-tier key that was throttled, update `.env` with a backup key and restart the backend.
  3. For zero-network fallback during offline evaluations, use the local mock runner:
     ```bash
     python scripts/run_security_evaluation.py --dry-run
     ```

---

### Scenario D: Authentication Failure (Cookie Rejected / Invalid Token)
- **Symptom**: Browser receives HTTP 401 Unauthorized or redirects constantly to login.
- **Recovery Steps**:
  1. Verify in `.env` that `ENABLE_TEST_AUTH=true` is set for demo/development mode.
  2. Clear browser cookies for `localhost:3000` (Chrome DevTools $\to$ Application $\to$ Cookies $\to$ Clear).
  3. Ensure `SESSION_COOKIE_SECURE=false` when presenting over HTTP (`http://localhost:3000`). If set to `true`, browsers will reject the session cookie on unencrypted connections.

---

### Scenario E: Next.js Frontend Server Crash
- **Symptom**: Browser displays `ERR_CONNECTION_REFUSED` on port 3000.
- **Recovery Steps**:
  1. Navigate to the `web/` directory:
     ```powershell
     cd web
     npm run dev
     ```
  2. If Next.js has cached broken state:
     ```powershell
     Remove-Item .next -Recurse -Force
     npm run dev
     ```

---

## 3. Demo Safety Rules (Non-Negotiable)

1. **Synthetic Data Only**:
   - All demonstrated customer records use synthetic `.test` domains (e.g., `aarav.sharma@example.test`).
   - Never import, query, or display real PII or production customer data.
2. **Never Demo Destructive Operations on Production**:
   - All live demos must target either a local Docker container or the isolated evaluation database `mcp_sentinel_eval`.
   - The built-in **Production Safety Lock** automatically aborts execution if `APP_ENV=production`.
3. **Disposable Data Environment**:
   - If you delete customer `CUST-000002` during a live demo, restore the database state after the session with:
     ```bash
     python scripts/seed_database.py
     ```
4. **Never Bypass Security Controls to "Make the Demo Work"**:
   - If a destructive action is blocked by the Policy Engine, **do not disable policy gating**. The fact that it is blocked is the core value proposition of MCP-Sentinel! Show the ticket in the approvals UI and approve it legitimately.
