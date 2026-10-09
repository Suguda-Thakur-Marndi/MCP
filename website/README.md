# MCP-Sentinel Website & Human Approval Console

> Minimal, ultra-fast public documentation site and out-of-band Human-in-the-Loop authorization console for MCP-Sentinel.

---

## 1. Local Development (One-Command Run)

### Method A: Python Standard Library (Zero npm dependencies)
From the repository root:
```bash
python -m http.server 3000 --directory website
```
Or from inside `website/`:
```bash
cd website
python -m http.server 3000
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Method B: Node.js / npx serve
```bash
cd website
npx -y serve . -l 3000
```

---

## 2. Architecture & Backend Connection

- **Public Site (`index.html`)**: Fully static, zero-dependency HTML/CSS/JS. Covers the problem, 5-step HITL diagram, all 8 real MCP tools, 1-line security guardrails, quickstart guides for Claude Desktop and Cursor, and transparent roadmap.
- **Approval Console (`console.html`)**: Connects to the FastAPI backend at `http://localhost:8000/api` for out-of-band authorization.
  - Requires authenticated approver identity (`ADMIN` or `APPROVER` role).
  - Out-of-band security guarantee: AI agents connecting over the MCP protocol (stdio/SSE) cannot reach the approve endpoint.

### Starting the FastAPI Backend:
Ensure the MCP-Sentinel API backend is running on port 8000:
```bash
python -m uvicorn mcp_sentinel.api.app:app --host 0.0.0.0 --port 8000
```

---

## 3. Deployment

### Option A: GitHub Pages
1. In repository **Settings** -> **Pages**.
2. Select **Source**: Deploy from a branch.
3. Select branch: `main` (or `feat/website`) and folder `/website`.
4. Click **Save**. The static site deploys automatically.

### Option B: Vercel (Static Site)
```bash
cd website
npx -y vercel --prod
```
When prompted for framework preset, select **Other / Static HTML**. No build step or build output directory configuration is needed.

---

## 4. Verification & Testing

To test the complete out-of-band Human-in-the-Loop approval lifecycle:
1. Start the API: `python -m uvicorn mcp_sentinel.api.app:app --port 8000`.
2. Start the site: `python -m http.server 3000 --directory website`.
3. In Claude Desktop / Cursor / script, trigger `delete_customer(customer_id="CUST-000001")`.
4. Open [http://localhost:3000/console.html](http://localhost:3000/console.html).
5. Log in as `approver@sentinel.test` (or `admin@sentinel.test`).
6. Inspect the pending ticket, verify parameter hash, and click **Authorize & Sign**.
7. Retry the tool execution from the client. The customer will be deleted atomically.
8. Retrying again with the same ticket is instantly blocked by anti-replay defense.
