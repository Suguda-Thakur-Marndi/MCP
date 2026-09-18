# MCP-Sentinel Production AWS Deployment Architecture

> **Version:** 1.0.0 | **Last Updated:** Phase 9 Operational Hardening  
> **Deployment Model:** AWS ECS (Fargate) + Amazon RDS PostgreSQL (Multi-AZ) + AWS Application Load Balancer

---

## 1. Network Topology & Isolation

The production environment implements strict three-tier network segregation:

```
Internet
   │
   ▼ HTTPS:443 (TLS 1.3 Termination, AWS WAF, Shield Standard)
┌────────────────────────────────────────────────────────────────────────┐
│ Public Subnets (VPC, CIDR 10.0.1.0/24, 10.0.2.0/24 - Multi-AZ)         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Application Load Balancer (ALB)                                  │  │
│  │  - Path /api/*  ──► Target Group: Sentinel API (port 8000)       │  │
│  │  - Path /*      ──► Target Group: Sentinel Web Console (port 3000)│ │
│  └──────────────────────────────────────────────────────────────────┘  │
│  NAT Gateways (Egress internet access for Fargate tasks)               │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ Forwarded via Security Groups
┌──────────────────────────────────▼─────────────────────────────────────┐
│ Private Application Subnets (CIDR 10.0.10.0/24, 10.0.20.0/24 - Multi-AZ│
│  ┌─────────────────────────────────┐ ┌──────────────────────────────┐  │
│  │ ECS Fargate: Sentinel Web (UI)  │ │ ECS Fargate: Sentinel API    │  │
│  │ - 1 vCPU, 2 GB RAM              │ │ - 2 vCPU, 4 GB RAM           │  │
│  │ - Non-root container (nextjs)   │ │ - Non-root container (sentinel│ │
│  │ - Port 3000                     │ │ - Port 8000                  │  │
│  │ - No public IP                  │ │ - Task IAM Execution Role    │  │
│  └─────────────────────────────────┘ └──────────────┬───────────────┘  │
└─────────────────────────────────────────────────────┼──────────────────┘
                                                      │ TCP:5432 (Internal only)
┌─────────────────────────────────────────────────────▼──────────────────┐
│ Isolated Database Subnets (CIDR 10.0.50.0/24, 10.0.60.0/24 - Multi-AZ)  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Amazon RDS PostgreSQL 16 (Multi-AZ with Standby Replica)         │  │
│  │ - Storage: Encrypted at rest via AWS KMS (Customer Managed Key)  │  │
│  │ - Publicly Accessible: FALSE                                     │  │
│  │ - Security Group: Only accepts inbound 5432 from API Security Grp│  │
│  │ - Automated Backups: Enabled (7-day retention, PITR active)      │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. AWS Security Group Rules

| Security Group | Inbound Rules | Outbound Rules |
|----------------|---------------|----------------|
| `sg-alb` | `443/tcp` from `0.0.0.0/0`<br>`80/tcp` from `0.0.0.0/0` (redirect to 443) | `8000/tcp` to `sg-sentinel-api`<br>`3000/tcp` to `sg-sentinel-web` |
| `sg-sentinel-api` | `8000/tcp` strictly from `sg-alb` | `5432/tcp` to `sg-rds`<br>`443/tcp` to `0.0.0.0/0` (via NAT for Gemini/OIDC) |
| `sg-sentinel-web` | `3000/tcp` strictly from `sg-alb` | `8000/tcp` to `sg-sentinel-api` |
| `sg-rds` | `5432/tcp` strictly from `sg-sentinel-api` | None (closed) |

---

## 3. Secret Management via AWS Secrets Manager

Zero secrets are passed in plaintext, environment files, or committed code.

### 3.1 Provisioning Secrets
```bash
aws secretsmanager create-secret \
  --name "production/mcp-sentinel/secrets" \
  --description "Production credentials for MCP-Sentinel" \
  --secret-string '{
    "DATABASE_URL": "postgresql://sentinel_admin:STRONG_PASSWORD@sentinel-db.cluster-xyz.us-east-1.rds.amazonaws.com:5432/mcp_sentinel_db",
    "JWT_SECRET_KEY": "RANDOM_HEX_64_CHARS_GENERATED_SECURELY",
    "GEMINI_API_KEY": "AIza...",
    "GOOGLE_CLIENT_ID": "...",
    "GOOGLE_CLIENT_SECRET": "..."
  }' \
  --kms-key-id "arn:aws:kms:us-east-1:ACCOUNT_ID:key/KMS_KEY_ID"
```

### 3.2 IAM Task Execution Role Permissions
The ECS Task Execution Role (`sentinel-task-execution-role`) is granted least-privilege read access:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "kms:Decrypt"
      ],
      "Resource": [
        "arn:aws:secretsmanager:us-east-1:ACCOUNT_ID:secret:production/mcp-sentinel/secrets*",
        "arn:aws:kms:us-east-1:ACCOUNT_ID:key/KMS_KEY_ID"
      ]
    }
  ]
}
```

---

## 4. ECS Fargate Task Definition Reference

```json
{
  "family": "mcp-sentinel-api",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "2048",
  "memory": "4096",
  "executionRoleArn": "arn:aws:iam::ACCOUNT_ID:role/sentinel-task-execution-role",
  "taskRoleArn": "arn:aws:iam::ACCOUNT_ID:role/sentinel-task-role",
  "containerDefinitions": [
    {
      "name": "sentinel-api",
      "image": "ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/mcp-sentinel/api:1.0.0",
      "essential": true,
      "user": "sentinel",
      "readonlyRootFilesystem": false,
      "portMappings": [
        { "containerPort": 8000, "protocol": "tcp" }
      ],
      "environment": [
        { "name": "APP_ENV", "value": "production" },
        { "name": "LOG_LEVEL", "value": "INFO" },
        { "name": "ENABLE_TEST_AUTH", "value": "false" },
        { "name": "SESSION_COOKIE_SECURE", "value": "true" },
        { "name": "SESSION_COOKIE_SAMESITE", "value": "lax" },
        { "name": "ALLOWED_CORS_ORIGINS", "value": "https://sentinel.yourdomain.com" }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:ACCOUNT_ID:secret:production/mcp-sentinel/secrets:DATABASE_URL::"
        },
        {
          "name": "JWT_SECRET_KEY",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:ACCOUNT_ID:secret:production/mcp-sentinel/secrets:JWT_SECRET_KEY::"
        },
        {
          "name": "GEMINI_API_KEY",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:ACCOUNT_ID:secret:production/mcp-sentinel/secrets:GEMINI_API_KEY::"
        }
      ],
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:8000/health/live || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 15
      },
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/mcp-sentinel/api",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "api"
        }
      }
    }
  ]
}
```

---

## 5. Deployment Step-by-Step

1. **ECR Image Build & Push:**
   ```bash
   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com
   docker build -f docker/Dockerfile.api -t ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/mcp-sentinel/api:1.0.0 .
   docker push ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/mcp-sentinel/api:1.0.0
   ```

2. **Database Migrations (Pre-Deployment):**
   ```bash
   # Run migrations in isolated ECS one-shot task before updating service
   aws ecs run-task \
     --cluster sentinel-cluster \
     --task-definition mcp-sentinel-migration \
     --network-configuration "awsvpcConfiguration={subnets=[subnet-abc],securityGroups=[sg-sentinel-api]}" \
     --overrides '{"containerOverrides": [{"name": "migration", "command": ["python", "scripts/init_db.py"]}]}'
   ```

3. **Rolling Service Update:**
   ```bash
   aws ecs update-service \
     --cluster sentinel-cluster \
     --service sentinel-api-service \
     --force-new-deployment \
     --task-definition mcp-sentinel-api:1.0.0
   ```
