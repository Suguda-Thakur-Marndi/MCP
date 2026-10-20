# MCP Sentinel — Local Development Guide

## Environment Setup

### 1. Python Virtual Environment

```bash
python -m venv .venv
source .venv/bin/activate  # On Windows: .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 2. Environment Variables

Copy the example environment configuration:

```bash
cp .env.example .env
```

Ensure development secret keys are at least 32 characters long.

### 3. Database Initialization

To initialize local database tables and apply migrations 001–012:

```bash
python scripts/init_db.py
python scripts/seed_database.py
```

## Running Verification & Tests

### Backend Tests

Run all unit, integration, and security tests:

```bash
pytest tests/ -v
```

Run specific test packages:

```bash
pytest tests/unit/ -v
pytest tests/integration/ -v
pytest tests/security/ -v
```

### Code Formatting & Linting

```bash
ruff check mcp_sentinel/ scripts/ tests/
ruff format --check mcp_sentinel/ scripts/ tests/
```

### Frontend Development

```bash
cd web
npm install
npm run dev          # Start Next.js development server
npm run type-check   # Run TypeScript strict type verification
npm run lint         # Run ESLint
npm run build        # Verify production Turbopack build
```
