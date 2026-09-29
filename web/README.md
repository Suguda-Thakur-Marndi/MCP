# MCP-Sentinel — Web Security Console

Modern Next.js 16 web console for MCP-Sentinel, providing real-time oversight of AI agent interactions, human-in-the-loop approvals, security policies, and adversarial evaluations.

## Development

```bash
# Install dependencies
npm install

# Start development server (http://localhost:3000)
npm run dev

# Static type check
npm run type-check

# Run linter
npm run lint

# Production build
npm run build
```

## Architecture & Configuration

- **Framework**: Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS v4
- **Backend API**: Connects to the FastAPI gateway at `http://localhost:8000` via `NEXT_PUBLIC_API_URL`
- **Authentication**: Supports Google OIDC and local development testing sessions (`/api/auth`)
- **Key Routes**:
  - `/`: SOC Security Operations Dashboard with key metrics and live activity
  - `/agent`: Interactive AI Agent playground with live security interception telemetry
  - `/approvals`: Cryptographic Human-in-the-Loop pending approval ticket management
  - `/policies`: Active security policy rules and risk threshold controls
  - `/tools`: Registered FastMCP tool catalog with parameter schemas and risk tiers
  - `/audit`: Tamper-evident structured audit event logs with correlation IDs
  - `/evaluation`: Adversarial security benchmark runner and category reports
  - `/settings`: Platform configuration and Google OAuth/OIDC status

