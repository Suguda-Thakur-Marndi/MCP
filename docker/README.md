# Docker Container Configurations (`docker/`)

This directory contains container definitions and reverse proxy configurations for MCP Sentinel.

## Container Files

| File | Purpose | Base Image | Security Features |
|---|---|---|---|
| [`Dockerfile.api`](file:///docker/Dockerfile.api) | Production multi-stage image for FastAPI Backend & MCP Security Gateway. | `python:3.12-slim` | Runs as non-root `sentinel` (UID 10001), dedicated writable `/tmp`, no build tools in runtime, health check probe. |
| [`Dockerfile`](file:///docker/Dockerfile) | Production image for FastMCP Stdio Server. | `python:3.12-slim` | Runs as unprivileged `sentinel` user. |
| [`Caddyfile`](file:///docker/Caddyfile) | Production reverse proxy configuration. | `caddy:2.8-alpine` | Automatic Let's Encrypt TLS certificate provisioning, security headers, reverse proxy to API (`:8000`) and Console (`:3000`). |

## Compose Stacks

- **[`docker-compose.prod.yml`](file:///docker-compose.prod.yml)**: Production EC2 stack (API, Web console, optional Caddy TLS proxy, connecting to external Supabase PostgreSQL).
- **[`docker-compose.staging.yml`](file:///docker-compose.staging.yml)**: Staging stack with dedicated pre-production database.
- **[`docker-compose.yml`](file:///docker-compose.yml)**: Local development stack with containerized PostgreSQL 16.
