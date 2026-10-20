# Deployment Scripts (`scripts/deployment/`)

This directory contains host initialization and manual deployment scripts for MCP Sentinel on AWS EC2.

## Scripts Index

| Script | Purpose | Execution Command |
|---|---|---|
| [`deploy_ec2.sh`](file:///scripts/deployment/deploy_ec2.sh) | Production deployment automation: verifies host prerequisites, checks `.env` permissions, validates compose syntax, checks Supabase connectivity, prompts for schema migrations, builds Docker images locally, and checks health probes. | `./scripts/deployment/deploy_ec2.sh` |
| [`ec2_setup.sh`](file:///scripts/deployment/ec2_setup.sh) | Initial EC2 Ubuntu 24.04 host setup: configures 2GB swapfile, installs Docker Engine, Compose plugin, AWS CLI v2, and prepares `/opt/mcp-sentinel`. | `sudo bash scripts/deployment/ec2_setup.sh` |
| [`aws_secrets_sync.sh`](file:///scripts/deployment/aws_secrets_sync.sh) | Securely synchronizes secrets from AWS Secrets Manager directly into the host `.env` file without echoing plaintext values. | `sudo bash scripts/deployment/aws_secrets_sync.sh` |

> [!NOTE]
> Backward-compatible execution from repository root via `./scripts/deploy_ec2.sh` and `sudo bash scripts/ec2_setup.sh` is fully preserved.
