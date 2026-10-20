# MCP Sentinel — Manual AWS EC2 Production Deployment Guide

> [!NOTE]
> This guide has been reorganized under [`docs/deployment/MANUAL_EC2_DEPLOYMENT.md`](file:///docs/deployment/MANUAL_EC2_DEPLOYMENT.md) as part of the production folder structure.
> Please refer to the primary guide at [docs/deployment/MANUAL_EC2_DEPLOYMENT.md](file:///docs/deployment/MANUAL_EC2_DEPLOYMENT.md).

---

## Quick Reference

- **Target Architecture**: AWS EC2 (`t3.small`, 2 vCPU, 2 GB RAM, 2 GB Swap, Ubuntu 24.04 LTS)
- **Host Setup Script**: [`scripts/ec2_setup.sh`](file:///scripts/ec2_setup.sh)
- **Deployment Script**: [`scripts/deploy_ec2.sh`](file:///scripts/deploy_ec2.sh)
- **Compose Configuration**: [`docker-compose.prod.yml`](file:///docker-compose.prod.yml)

For the full step-by-step instructions (SSH connection, Docker verification, environment configuration, database pre-checks, container builds, and Caddy TLS reverse proxy configuration), see:

👉 **[Complete Manual EC2 Deployment Guide](file:///docs/deployment/MANUAL_EC2_DEPLOYMENT.md)**
