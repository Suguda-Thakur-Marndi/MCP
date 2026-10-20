# SentinelCore — Production Deployment Documentation

This directory contains production deployment guides, operational playbooks, and host configuration specifications for SentinelCore.

## Deployment Index

- **[Manual EC2 Deployment Guide](file:///docs/deployment/MANUAL_EC2_DEPLOYMENT.md)**:
  Detailed step-by-step instructions for deploying SentinelCore to an AWS EC2 instance (Ubuntu 24.04 LTS / `t3.small`) using Git, local Docker image builds, Docker Compose, and Supabase PostgreSQL.

## Deployment Architecture Summary

- **Manual Deployments Only**: Automated CI/CD deployment pipelines have been disabled to ensure strict human oversight for production releases.
- **Local Container Builds**: Docker images (`sentinelcore-api` and `sentinelcore-web`) are built directly on the target EC2 host from git source; no external registry (ECR) dependency.
- **External Managed Database**: Production connects to Supabase PostgreSQL over TLS with PgBouncer connection pooling.
- **Least Privilege Containers**: Containers run under unprivileged system users (`sentinel` UID 10001, `nextjs` UID 1001).
- **Reverse Proxy**: Caddy 2.8 reverse proxy handles automatic Let's Encrypt TLS certificate provisioning and terminates HTTPS on port 443.
