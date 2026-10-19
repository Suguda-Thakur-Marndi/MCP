# MCP Sentinel — AWS EC2 Production CI/CD Deployment Guide

This guide details the production deployment pipeline for **MCP Sentinel** using **GitHub Actions**, **Amazon ECR**, and **AWS EC2** with **AWS Systems Manager (SSM)** and **GitHub OIDC**.

---

## 1. Architecture Overview

```
                                  +-----------------------------------------------+
                                  |                 GitHub Actions                |
                                  |  (CI: Lint, Pytest, Security Audit, Builds)   |
                                  +-----------------------+-----------------------+
                                                          |
                                           OIDC Token Exchange (No AWS Keys)
                                                          |
                                                          v
                                  +-----------------------------------------------+
                                  |             AWS IAM (Deploy Role)             |
                                  +-----------+-----------------------+-----------+
                                              |                       |
                                  Push Docker Images             Send SSM Command
                                              |                       |
                                              v                       v
+-----------------------+         +-----------+-----------+       +---+-------------------+
|  Next.js Security     |         |  Amazon ECR           |       |  AWS Systems Manager  |
|  Console (Frontend)   |         |  - mcp-sentinel-api   |       |  Run Command Agent    |
|  Container : 3000     |         |  - mcp-sentinel-web   |       +-----------+-----------+
+-----------^-----------+         +-----------+-----------+                   |
            |                                 |                               |
       Docker Network                    docker pull                     docker compose
            |                                 |                               |
+-----------+-----------+                     v                               v
|  FastAPI Security     | <---------------------------------------+-------------------+---+
|  Gateway (Backend)    |                                         |  AWS EC2 Host         |
|  Container : 8000     |                                         |  (/opt/mcp-sentinel)  |
+-----------+-----------+                                         +-----------------------+
            |
    Outbound TLS (5432)
            |
            v
+-----------------------+
|  Supabase PostgreSQL  |
|  (External Database)  |
+-----------------------+
```

### Key Security & Operational Invariants
1. **Zero Long-Lived AWS Keys**: Deployment uses GitHub OpenID Connect (OIDC) to assume a temporary, tightly scoped IAM role. No `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY` are stored in GitHub Secrets.
2. **Zero Inbound SSH Ports Required**: Deployments execute via the AWS Systems Manager (SSM) agent. Port 22 is completely closed on the EC2 security group.
3. **Multi-Stage Non-Root Containers**: FastAPI runs as unprivileged user `sentinel` (UID 10001); Next.js runs as `nextjs` (UID 1001).
4. **External Database**: Supabase PostgreSQL is kept external to application containers, connecting over TLS. No database ports are exposed publicly.
5. **Truthful Health Probes & Automated Rollback**: Probes verify both process liveness (`/health/live`) and database readiness (`/health/ready`). If probes fail during deployment, Docker Compose automatically rolls back to the previous image tag.

---

## 2. AWS Prerequisites & IAM Configuration

### Step 1: Create Amazon ECR Repositories

Create private ECR repositories in your target AWS region (`ap-southeast-2`):

```bash
aws ecr create-repository \
  --repository-name mcp-sentinel-api \
  --image-scanning-configuration scanOnPush=true \
  --encryption-configuration encryptionType=AES256 \
  --region ap-southeast-2

aws ecr create-repository \
  --repository-name mcp-sentinel-web \
  --image-scanning-configuration scanOnPush=true \
  --encryption-configuration encryptionType=AES256 \
  --region ap-southeast-2
```

Set lifecycle policies on both repositories to expire untagged images after 14 days and keep the 30 most recent tagged releases.

---

### Step 2: Configure GitHub OIDC Identity Provider

If not already present in your AWS account, register GitHub as an OIDC identity provider:

- **Provider URL**: `https://token.actions.githubusercontent.com`
- **Audience**: `sts.amazonaws.com`

Via AWS CLI:
```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 1c5860f5602175e31b1a5e4b6408b46a6ecf9d16
```

---

### Step 3: Create GitHub Actions Deployment IAM Role

Create an IAM role named `mcp-sentinel-github-deploy-role` with the following trust policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::<YOUR_ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:Suguda-Thakur-Marndi/MCP:*"
        }
      }
    }
  ]
}
```

Attach a least-privilege policy to `mcp-sentinel-github-deploy-role`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ECRAuth",
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken"
      ],
      "Resource": "*"
    },
    {
      "Sid": "ECRImagePush",
      "Effect": "Allow",
      "Action": [
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload"
      ],
      "Resource": [
        "arn:aws:ecr:ap-southeast-2:<YOUR_ACCOUNT_ID>:repository/mcp-sentinel-api",
        "arn:aws:ecr:ap-southeast-2:<YOUR_ACCOUNT_ID>:repository/mcp-sentinel-web"
      ]
    },
    {
      "Sid": "SSMDeployTarget",
      "Effect": "Allow",
      "Action": [
        "ssm:SendCommand"
      ],
      "Resource": [
        "arn:aws:ssm:ap-southeast-2:*:document/AWS-RunShellScript",
        "arn:aws:ec2:ap-southeast-2:<YOUR_ACCOUNT_ID>:instance/i-084466cba136e6757"
      ]
    },
    {
      "Sid": "SSMCommandStatus",
      "Effect": "Allow",
      "Action": [
        "ssm:GetCommandInvocation",
        "ssm:ListCommandInvocations",
        "ssm:DescribeInstanceInformation"
      ],
      "Resource": "*"
    }
  ]
}
```

---

### Step 4: Configure EC2 Instance Profile

The EC2 instance requires an IAM instance profile with permission to communicate with AWS Systems Manager and pull images from ECR:

1. Create role `mcp-sentinel-ec2-role` with trust policy for `ec2.amazonaws.com`.
2. Attach managed policies:
   - `AmazonSSMManagedInstanceCore`
   - `AmazonEC2ContainerRegistryReadOnly`
3. Attach the instance profile to your target EC2 instance.

---

## 3. EC2 Host Setup & Directory Layout

### EC2 OS & Packages
- OS: Ubuntu 22.04 LTS / 24.04 LTS or Amazon Linux 2023.
- Instance Size: Recommended minimum `t3.medium` (2 vCPU, 4GB RAM) for running both API and Next.js containers.
- Installed Packages:
  - Docker Engine (`>= 24.0`)
  - Docker Compose plugin (`docker compose`)
  - AWS CLI v2 (`aws`)
  - Amazon SSM Agent (pre-installed on Ubuntu / Amazon Linux AMIs)

Verify SSM agent is running:
```bash
sudo systemctl status snap.amazon-ssm-agent.amazon-ssm-agent || sudo systemctl status amazon-ssm-agent
```

### Host Deployment Directory
On the EC2 instance:
```bash
sudo mkdir -p /opt/mcp-sentinel/docker
sudo chown -R ubuntu:ubuntu /opt/mcp-sentinel
cd /opt/mcp-sentinel
```

Place the production files into `/opt/mcp-sentinel`:
```
/opt/mcp-sentinel/
├── docker-compose.prod.yml
├── .env                        # chmod 600, root/ubuntu owned
└── docker/
    └── Caddyfile              # If using Caddy reverse proxy
```

### Host `.env` Production Configuration
Create `/opt/mcp-sentinel/.env` on the EC2 host:

```bash
sudo cat << 'EOF' > /opt/mcp-sentinel/.env
# ============================================================
# MCP-Sentinel EC2 Host Production Configuration
# ============================================================
APP_ENV=production
LOG_LEVEL=INFO

# External Database (Supabase PostgreSQL)
DATABASE_URL=postgresql://postgres.[PROJECT]:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require
SUPABASE_DATABASE_URL=postgresql://postgres.[PROJECT]:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require

# Security Keys (Minimum 32 random characters each)
JWT_SECRET_KEY=YOUR_PRODUCTION_JWT_SECRET_KEY_MIN_32_CHARS
APPROVAL_HMAC_SECRET=YOUR_PRODUCTION_HMAC_SECRET_MIN_32_CHARS
SESSION_SECRET=YOUR_PRODUCTION_SESSION_SECRET_MIN_32_CHARS

# Authentication
GOOGLE_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=YOUR_CLIENT_SECRET
GOOGLE_REDIRECT_URI=https://sentinel.yourdomain.com/api/auth/google/callback
ENABLE_TEST_AUTH=false

# Real Enterprise Integrations
NOTION_API_KEY=ntn_YOUR_NOTION_INTEGRATION_TOKEN
NOTION_WRITE_ENABLED=false
GEMINI_API_KEY=YOUR_GEMINI_API_KEY

# Domain & CORS
FRONTEND_URL=https://sentinel.yourdomain.com
BACKEND_URL=https://sentinel.yourdomain.com
NEXT_PUBLIC_API_URL=https://sentinel.yourdomain.com
ALLOWED_CORS_ORIGINS=["https://sentinel.yourdomain.com"]

# Ports & Bindings
API_PORT=8000
WEB_PORT=3000
API_BIND_IP=127.0.0.1
WEB_BIND_IP=127.0.0.1
PRODUCTION_DOMAIN=sentinel.yourdomain.com
EOF

sudo chmod 600 /opt/mcp-sentinel/.env
```

---

## 4. GitHub Repository Configuration

Configure these parameters under **Settings > Secrets and variables > Actions**:

### Repository Secrets
| Secret Name | Description | Example / Format |
|---|---|---|
| `AWS_ROLE_ARN` | IAM Role assumed by GitHub Actions via OIDC | `arn:aws:iam::123456789012:role/mcp-sentinel-github-deploy-role` |
| `EC2_INSTANCE_ID` | Target AWS EC2 instance identifier | `i-084466cba136e6757` |

*(Note: Secrets such as `DATABASE_URL` and `JWT_SECRET_KEY` are placed on the EC2 host directly in `/opt/mcp-sentinel/.env` and are never exposed to GitHub Actions).*

### Repository Variables
| Variable Name | Description | Default |
|---|---|---|
| `AWS_REGION` | AWS Region for ECR and EC2 | `ap-southeast-2` |
| `NEXT_PUBLIC_API_URL` | Public frontend URL for Next.js build | `http://13.239.120.141:3000` or `https://sentinel.yourdomain.com` |

---

## 5. Reverse Proxy & Network Security

### Inbound Security Group Rules (EC2)
| Port | Protocol | Source | Purpose |
|---|---|---|---|
| `80` | TCP | `0.0.0.0/0` (or CloudFront/ALB IP range) | HTTP redirect to HTTPS |
| `443` | TCP | `0.0.0.0/0` (or CloudFront/ALB IP range) | HTTPS TLS traffic |
| `22` | TCP | **None (Blocked)** | All management via AWS SSM |
| `8000` | TCP | **None (Blocked)** | Bound to `127.0.0.1` |
| `3000` | TCP | **None (Blocked)** | Bound to `127.0.0.1` |
| `5432` | TCP | **None (Blocked)** | PostgreSQL is external |

### HTTPS Termination Options

#### Option A: Standalone EC2 with Caddy (Automatic TLS)
Start the stack with the `tls-proxy` profile:
```bash
docker compose -f docker-compose.prod.yml --profile tls-proxy up -d
```
Caddy automatically requests, installs, and renews Let's Encrypt certificates for `sentinel.yourdomain.com`.

#### Option B: AWS Application Load Balancer (ALB)
If using an ALB with AWS Certificate Manager (ACM):
1. Point ALB Target Group to EC2 port `3000` (for path `/*`) and port `8000` (for path `/api/*` and `/health/*`).
2. EC2 runs `docker compose -f docker-compose.prod.yml up -d` without the `tls-proxy` profile.

---

## 6. Continuous Deployment & Rollback Lifecycle

When code is pushed to `main`, `master`, or `release-candidate`:

1. **Continuous Integration**:
   - `lint-python`: Ruff formatting and linting.
   - `security-evaluation`: Runs unit tests (`pytest`), MCP tool validation, and console flow tests against a fresh schema.
   - `security-audit`: Runs `pip-audit` and credential leakage scans.
   - `build-frontend`: Runs Next.js TypeScript check, ESLint, and production build.
   - `build-docker-ci`: Verifies API and Web Dockerfiles build successfully using Buildx.
2. **ECR Publish**:
   - Authenticates to AWS via GitHub OIDC.
   - Builds and tags images: `${ECR_REGISTRY}/mcp-sentinel-api:${GITHUB_SHA}` and `latest`.
   - Pushes both images to Amazon ECR.
3. **EC2 SSM Deployment**:
   - GitHub Actions calls `aws ssm send-command` targeting the EC2 instance.
   - SSM agent on EC2 inspects running containers and saves `PREVIOUS_API_TAG`.
   - Pulls newly tagged images from ECR.
   - Executes `docker compose -f docker-compose.prod.yml up -d --remove-orphans`.
   - Runs a health probe loop checking:
     - Backend liveness: `http://127.0.0.1:8000/health/live` (HTTP 200)
     - Backend readiness: `http://127.0.0.1:8000/health/ready` (HTTP 200, truthful Supabase verification)
     - Frontend console: `http://127.0.0.1:3000/` (HTTP 200)
   - **Automated Rollback**: If any probe fails after 18 attempts (90 seconds), the script automatically rolls back:
     ```bash
     export IMAGE_TAG="$PREVIOUS_API_TAG"
     docker compose -f docker-compose.prod.yml up -d --remove-orphans
     ```
     The deployment fails in GitHub Actions and dumps diagnostic logs.

### Manual Rollback Procedure
If manual rollback is ever needed on the EC2 host:
```bash
cd /opt/mcp-sentinel

# Check available local or ECR tags
docker images | grep mcp-sentinel

# Deploy previous known-good release tag
export ECR_REGISTRY="<YOUR_ACCOUNT_ID>.dkr.ecr.ap-southeast-2.amazonaws.com"
export IMAGE_TAG="<KNOWN_GOOD_GIT_SHA>"
docker compose -f docker-compose.prod.yml up -d --remove-orphans

# Verify health
curl -i http://localhost:8000/health/ready
```

---

## 7. Safe Database Migration Strategy

MCP Sentinel utilizes forward-compatible, additive SQL migrations under `mcp_sentinel/database/migrations/`.

> [!CAUTION]
> Never run automated, destructive database migrations (`DROP TABLE`, `ALTER TABLE ... DROP COLUMN`) directly from CI without a backup.

### Safe Migration Protocol
1. **Pre-Migration Snapshot**:
   Create a manual backup in the Supabase Dashboard under Database > Backups, or run:
   ```bash
   pg_dump -d "$DATABASE_URL" --format=custom -f "sentinel_backup_$(date +%Y%m%d_%H%M%S).dump"
   ```
2. **Dry Run / Staging**:
   Apply migrations to your staging database first:
   ```bash
   DATABASE_URL="$STAGING_DATABASE_URL" python scripts/init_db.py
   ```
3. **Production Migration Execution**:
   Apply forward-compatible migrations on the EC2 host:
   ```bash
   docker exec -it sentinel-api python scripts/init_db.py
   ```
4. **Post-Migration Verification**:
   Verify table counts and check health:
   ```bash
   curl -s http://localhost:8000/health/ready | jq .
   ```

---

## 8. Troubleshooting & FAQ

### Issue: GitHub Actions fails with "Not authorized to perform sts:AssumeRoleWithWebIdentity"
- **Cause**: OIDC trust policy mismatch.
- **Fix**: Verify the `sub` claim in your IAM trust policy matches `repo:Suguda-Thakur-Marndi/MCP:*`. Check that the AWS account ID in the role ARN is correct.

### Issue: SSM Command fails with "AccessDeniedException" or "InvalidInstanceId"
- **Cause**: EC2 instance profile lacks `AmazonSSMManagedInstanceCore` or instance is stopped.
- **Fix**: Verify instance ID in GitHub secret `EC2_INSTANCE_ID`. Ensure SSM agent is active (`sudo systemctl status snap.amazon-ssm-agent.amazon-ssm-agent`).

### Issue: Health check fails on `/health/ready` (HTTP 503)
- **Cause**: The FastAPI container cannot reach Supabase PostgreSQL.
- **Fix**: Verify `DATABASE_URL` in `/opt/mcp-sentinel/.env`. Test connectivity from the EC2 host:
  ```bash
  docker exec -it sentinel-api python -c "
  import asyncio, asyncpg, os
  asyncio.run(asyncpg.connect(os.environ['DATABASE_URL']))
  print('Connected!')
  "
  ```

### Issue: Next.js console shows blank screen or API 404s
- **Cause**: Misconfigured `NEXT_PUBLIC_API_URL` or `API_BASE_URL`.
- **Fix**: Ensure `API_BASE_URL=http://api:8000` is present in `docker-compose.prod.yml` so Next.js server-side rewrites route to the internal container.

---

## 9. Automated Infrastructure as Code (Terraform)

Production infrastructure can be automatically provisioned via the included Terraform configurations located in `infra/terraform/`:

### Provisioning Steps
```bash
cd infra/terraform

# 1. Initialize Terraform providers (AWS ~> 5.0)
terraform init

# 2. Copy and configure variables
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your domain name and target configuration

# 3. Plan and verify infrastructure changes
terraform plan

# 4. Apply configuration to provision AWS resources
terraform apply
```

### Outputs to GitHub Secrets
Upon successful completion, Terraform outputs the exact values needed for GitHub repository configuration:
```bash
terraform output -raw github_deploy_role_arn  # -> Set as GitHub Secret: AWS_ROLE_ARN
terraform output -raw ec2_instance_id         # -> Set as GitHub Secret: EC2_INSTANCE_ID
terraform output -raw ec2_public_ip           # -> Point your DNS A-Record to this IP
```

---

## 10. AWS Secrets Manager Integration

Operators may manage production credentials centrally in AWS Secrets Manager instead of manual `.env` file editing.

1. Store secrets in AWS Secrets Manager:
```bash
aws secretsmanager create-secret \
  --name "mcp-sentinel/production/secrets" \
  --description "MCP Sentinel production application runtime secrets" \
  --region ap-southeast-2 \
  --secret-string file://production-secrets.json
```

2. Synchronize secrets to `/opt/mcp-sentinel/.env` on the EC2 host:
```bash
sudo ./scripts/aws_secrets_sync.sh "mcp-sentinel/production/secrets" "ap-southeast-2"
```

---

## 11. Expected AWS Cost Drivers

Estimated monthly expenditure for running MCP Sentinel on AWS in `ap-southeast-2` (Sydney):

| AWS Resource | Specification | Estimated Cost (USD/month) |
|---|---|---|
| **EC2 Instance** | `t3.small` (2 vCPU, 2GB RAM + 2GB swap) on-demand | ~$17.50 / month |
| **EBS Storage** | 30 GB GP3 encrypted root volume (3000 IOPS, 125 MB/s) | ~$3.60 / month |
| **Elastic IP (IPv4)** | 1 attached in-use public IPv4 address ($0.005/hr) | ~$3.65 / month |
| **Amazon ECR** | ~2–4 GB container storage (with 14-day lifecycle pruning) | ~$0.30 / month |
| **AWS Systems Manager** | Standard Run Command & Session Manager | Free tier / $0.00 |
| **Data Transfer Out** | First 100 GB/month internet egress | Free tier / $0.00 |
| **Total Estimated Cost** | | **~$25.00 / month** |

*(Cost optimizations: An AWS 1-Year or 3-Year Compute Savings Plan / Reserved Instance reduces the EC2 compute cost by 35–60% to ~$7.50/month).*

---

## 12. Cleanup & Teardown Protocol

To completely deprovision all billable AWS infrastructure and remove artifacts:

### Via Terraform
```bash
cd infra/terraform
terraform destroy
```

### Manual Teardown Verification
If created manually via AWS Console or CLI:
1. **EC2 Instance**: Terminate instance `sentinel_host` (`aws ec2 terminate-instances --instance-ids <INSTANCE_ID>`).
2. **Elastic IP**: Release Elastic IP allocation (`aws ec2 release-address --allocation-id <ALLOCATION_ID>`).
3. **ECR Repositories**: Delete ECR images and repositories:
   ```bash
   aws ecr delete-repository --repository-name mcp-sentinel-api --force --region ap-southeast-2
   aws ecr delete-repository --repository-name mcp-sentinel-web --force --region ap-southeast-2
   ```
4. **IAM Roles**: Delete `mcp-sentinel-github-deploy-role` and `mcp-sentinel-ec2-role`.
5. **Security Groups**: Delete `mcp-sentinel-host-sg`.
