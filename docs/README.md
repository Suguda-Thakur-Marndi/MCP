# MCP Sentinel — Documentation Portal

Welcome to the MCP Sentinel documentation. MCP Sentinel is a production-grade security gateway, policy evaluation engine, and Human-in-the-Loop (HITL) approval system for AI tool integrations.

---

## Documentation Pillars

```text
docs/
├── architecture/         # System design, data flows, and runtime components
├── security/             # Zero-trust principles, threat model, and cryptographic verification
├── development/          # Local environment setup, test execution, and coding standards
└── deployment/           # Production EC2 deployment, containerization, and TLS proxy
```

### 1. [Architecture (`docs/architecture/`)](file:///docs/architecture/README.md)
- Complete system architecture and component interactions.
- FastMCP server (`mcp_sentinel/server/app.py`) vs FastAPI security gateway (`mcp_sentinel/api/app.py`).
- PostgreSQL persistence and audit event log topology.

### 2. [Security Model (`docs/security/`)](file:///docs/security/README.md)
- The 10 Immutable Security Principles.
- Parameter-bound HMAC-SHA256 authorization tickets.
- Role-Based Access Control (RBAC) and Attribute-Based Access Control (ABAC).
- Prompt injection defenses and untrusted customer data sanitization.

### 3. [Development Guide (`docs/development/`)](file:///docs/development/README.md)
- Setting up the local Python virtual environment and Next.js frontend.
- Running unit, integration, and security test suites with `pytest`.
- Running linting and formatting with `ruff` and `eslint`.

### 4. [Deployment Playbook (`docs/deployment/`)](file:///docs/deployment/README.md)
- [Manual EC2 Deployment Guide](file:///docs/deployment/MANUAL_EC2_DEPLOYMENT.md): Complete instructions for AWS EC2 Ubuntu 24.04 LTS deployment.
- Docker Compose multi-container composition (`docker-compose.prod.yml`).
- Automatic TLS certificate provisioning with Caddy 2.8.
