# MCP Sentinel — Manual AWS EC2 Production Deployment Guide

This guide describes the complete procedure for deploying **MCP Sentinel** manually to an **AWS EC2 Ubuntu** server using **SSH**, **Git**, and **Docker Compose**.

All automated CI/CD pipelines (GitHub Actions, ECR publishing, SSM push scripts) have been removed from this project. Deployment is executed manually by system operators directly on the EC2 host.

---

## Architecture & Deployment Model

```
                    +--------------------------------------------+
                    |             Operator Workstation           |
                    |   (Code commits, Git push to GitHub main)  |
                    +---------------------+----------------------+
                                          |
                                    SSH (Port 22)
                                          |
                                          v
+----------------------------------------------------------------------------------+
| AWS EC2 Ubuntu Server (/opt/mcp-sentinel)                                        |
|                                                                                  |
|  1. git fetch && git pull origin main                                            |
|  2. docker compose -f docker-compose.prod.yml build                              |
|  3. docker compose -f docker-compose.prod.yml up -d                             |
|                                                                                  |
|  +----------------------------------------------------------------------------+  |
|  | Optional TLS Reverse Proxy (Profile: tls-proxy)                            |  |
|  | Caddy 2.8 (:80, :443) — Automatic Let's Encrypt TLS Certificate            |  |
|  +---------------------+-------------------------------+----------------------+  |
|                        |                               |                         |
|             /api/*, /health/*                          /*                        |
|                        v                               v                         |
|  +---------------------+------+              +---------+------------+            |
|  | sentinel-api (FastAPI)     |              | sentinel-web         |            |
|  | Port: 127.0.0.1:8000       |              | (Next.js Console)    |            |
|  | Health: /health/live       |              | Port: 127.0.0.1:3000 |            |
|  | User: sentinel (UID 10001) |              | User: nextjs (1001)  |            |
|  +---------------------+------+              +----------------------+            |
|                        |                                                         |
|             Internal Docker Network (sentinel-net)                               |
+------------------------+---------------------------------------------------------+
                         |
                 Outbound TLS (5432)
                         |
                         v
          +--------------+-------------+
          | External Supabase Database  |
          | (PostgreSQL with PgBouncer) |
          +----------------------------+
```

### Core Security & Architectural Principles
- **No ECR Dependency**: Container images are built locally on the EC2 instance directly from git source.
- **External Database**: Supabase PostgreSQL is hosted externally; no database container is run or exposed on the EC2 host in production.
- **Least Privilege Containers**: The API runs as unprivileged user `sentinel` (UID 10001); Next.js runs as user `nextjs` (UID 1001).
- **Loopback Port Binding**: By default, `docker-compose.prod.yml` binds container ports to `127.0.0.1:8000` and `127.0.0.1:3000` so they are not directly reachable from the public internet. Public access is mediated via the Caddy TLS reverse proxy or an AWS Application Load Balancer (ALB).
- **Strict File Permissions**: The production `.env` file is restricted to `0600` permissions (`rw-------`).

---

## Prerequisites

1. **AWS EC2 Instance**:
   - OS: Ubuntu 24.04 LTS or 22.04 LTS (x86_64).
   - Instance Type: `t3.small` (2 vCPU, 2 GB RAM) minimum. A 2GB swap file is required to prevent OOM errors during Next.js frontend builds.
   - Storage: 20 GB+ General Purpose SSD (gp3).
2. **EC2 Security Group**:
   - Inbound:
     - SSH (Port 22) restricted to operator IP address/CIDR.
     - HTTP (Port 80) open to internet (for Let's Encrypt HTTP-01 challenge).
     - HTTPS (Port 443) open to internet (for public web console traffic).
   - Outbound:
     - All traffic allowed (0.0.0.0/0) for package updates, git operations, and outbound TLS connection to Supabase (port 5432) and Notion API (port 443).
3. **Domain Name & DNS**:
   - Public DNS A-record pointing your domain (e.g. `sentinel.yourdomain.com`) to the EC2 Elastic IP address.
4. **Supabase PostgreSQL Database**:
   - Active Supabase project with credentials and connection pooling string (`aws-0-[region].pooler.supabase.com:5432`).

---

## 1. Connecting to the EC2 Instance over SSH

From your local machine or terminal:

```bash
# Secure SSH key permissions
chmod 400 /path/to/your-key.pem

# SSH into the Ubuntu EC2 server
ssh -i /path/to/your-key.pem ubuntu@<EC2_PUBLIC_IP>
```

---

## 2. Installing or Verifying Docker Engine & Docker Compose

Verify whether Docker and Docker Compose are installed:

```bash
docker --version
docker compose version
```

If Docker is not installed, install official Docker Engine and Docker Compose Plugin on Ubuntu:

```bash
# 1. Update apt and install prerequisites
sudo apt-get update -y
sudo apt-get install -y ca-certificates curl gnupg lsb-release git ufw jq

# 2. Add Docker official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# 3. Set up repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 4. Install Docker packages
sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 5. Enable and start Docker service
sudo systemctl enable docker
sudo systemctl start docker

# 6. Add ubuntu user to docker group (log out and back in after this step)
sudo usermod -aG docker ubuntu
```

### Essential: Configure 2GB Swap Space (for t3.small instances)
Next.js production compilation is memory-intensive. Ensure 2GB swap space is enabled to prevent out-of-memory termination:

```bash
# Check existing swap
free -h

# If no swap is active, create 2GB swapfile
sudo fallocate -l 2G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Persist swap across reboots
if ! grep -q "/swapfile" /etc/fstab; then
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi
```

*(Alternatively, run `sudo bash scripts/ec2_setup.sh` from the repository root to automatically perform all host initialization).*

---

## 3. Cloning Repository & Checking Out `main`

Prepare the deployment directory (recommended: `/opt/mcp-sentinel`):

```bash
# Create directory and assign ownership to ubuntu user
sudo mkdir -p /opt/mcp-sentinel
sudo chown -R ubuntu:ubuntu /opt/mcp-sentinel

# Clone the repository
git clone https://github.com/Suguda-Thakur-Marndi/MCP.git /opt/mcp-sentinel

# Enter repository directory
cd /opt/mcp-sentinel

# Ensure main branch is active and up to date
git checkout main
git pull origin main
```

---

## 4. Creating and Securing the Production `.env` File

Copy `.env.example` to `.env` and set restrictive permissions:

```bash
cp .env.example .env
chmod 600 .env
```

Populate `.env` with production values:

```bash
nano .env
```

### Key Production Variables:

```ini
# Application Mode
APP_ENV=production
LOG_LEVEL=INFO

# Base URLs
FRONTEND_URL=https://sentinel.yourdomain.com
BACKEND_URL=https://sentinel.yourdomain.com
NEXT_PUBLIC_API_URL=https://sentinel.yourdomain.com
PRODUCTION_DOMAIN=sentinel.yourdomain.com

# Port & IP Bindings (127.0.0.1 for isolation behind Caddy)
API_BIND_IP=127.0.0.1
API_PORT=8000
WEB_BIND_IP=127.0.0.1
WEB_PORT=3000

# Supabase PostgreSQL Database (External connection with SSL required)
DATABASE_URL=postgresql://postgres.<PROJECT_REF>:<PASSWORD>@aws-0-<REGION>.pooler.supabase.com:5432/postgres?sslmode=require
SUPABASE_DATABASE_URL=postgresql://postgres.<PROJECT_REF>:<PASSWORD>@aws-0-<REGION>.pooler.supabase.com:5432/postgres
SUPABASE_URL=https://<PROJECT_REF>.supabase.co
SUPABASE_ANON_KEY=<YOUR_SUPABASE_ANON_KEY>
SUPABASE_PROJECT_REF=<PROJECT_REF>

# Cryptographic Keys (generate with: openssl rand -hex 32)
JWT_SECRET_KEY=<GENERATE_AT_LEAST_32_CHARACTERS>
JWT_ALGORITHM=HS256
JWT_EXPIRATION_MINUTES=60
SESSION_SECRET=<GENERATE_AT_LEAST_32_CHARACTERS>
APPROVAL_HMAC_SECRET=<GENERATE_AT_LEAST_32_CHARACTERS>

# Cookie Security (Must be true for HTTPS)
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_HTTPONLY=true
SESSION_COOKIE_SAMESITE=lax

# Authentication (Disable test auth in production)
ENABLE_TEST_AUTH=false

# Google OAuth (Optional - required for Google OIDC sign-in)
GOOGLE_CLIENT_ID=<YOUR_CLIENT_ID>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<YOUR_CLIENT_SECRET>
GOOGLE_REDIRECT_URI=https://sentinel.yourdomain.com/api/auth/google/callback
ALLOWED_GOOGLE_DOMAINS=yourcompany.com

# Notion API Integration (Optional)
NOTION_API_KEY=ntn_your_notion_token
NOTION_WRITE_ENABLED=false

# CORS Allowed Origins
ALLOWED_CORS_ORIGINS=["https://sentinel.yourdomain.com"]
```

> [!IMPORTANT]
> Generate strong secrets for `JWT_SECRET_KEY`, `SESSION_SECRET`, and `APPROVAL_HMAC_SECRET`:
> ```bash
> openssl rand -hex 32
> ```

---

## 5. Configuring Supabase Database Connectivity

Verify that your Supabase database is accessible from the EC2 instance and that the required tables and schemas exist:

```bash
# 1. Test database network connectivity
python3 -c "
import urllib.parse, psycopg2
dsn = '$(grep '^DATABASE_URL=' .env | cut -d= -f2-)'
print('Testing Supabase connection...')
conn = psycopg2.connect(dsn)
cur = conn.cursor()
cur.execute('SELECT version();')
print('Database Connected:', cur.fetchone()[0])
conn.close()
"
```

If schema migrations or initial database tables need to be created:

```bash
# Run the database schema initialization script
python3 scripts/init_db.py
```

---

## 6. Building API and Frontend Images Locally

Build Docker images locally on EC2 using `docker-compose.prod.yml`:

```bash
# Build both images from source
docker compose -f docker-compose.prod.yml build
```

This command:
1. Builds `mcp-sentinel-api:latest` using `docker/Dockerfile.api` (multi-stage Python 3.12 slim build).
2. Builds `mcp-sentinel-web:latest` using `web/Dockerfile` (multi-stage Node 20 Alpine standalone build with `NEXT_PUBLIC_API_URL` injected).

---

## 7. Validating the Docker Compose Configuration

Before launching containers, validate the resolved configuration:

```bash
docker compose -f docker-compose.prod.yml config
```

Verify that:
- `api` has `build.context: .` and `build.dockerfile: docker/Dockerfile.api`.
- `web` has `build.context: ./web` and `build.dockerfile: Dockerfile`.
- All required environment variables are parsed correctly.
- No syntax or indentation errors exist.

---

## 8. Starting Production Services

### Option A: Running with Automatic TLS Caddy Reverse Proxy (Recommended)
If using Caddy on the EC2 host for Let's Encrypt certificates:

```bash
docker compose -f docker-compose.prod.yml --profile tls-proxy up -d
```

### Option B: Running without Caddy (Behind AWS ALB)
If you terminate TLS at an AWS Application Load Balancer:

```bash
docker compose -f docker-compose.prod.yml up -d
```

---

## 9. Checking Container Health and Application Logs

Check running container status:

```bash
docker compose -f docker-compose.prod.yml ps
```

Expected status:
```
NAME             IMAGE                     COMMAND                  SERVICE   CREATED         STATUS                   PORTS
sentinel-api     mcp-sentinel-api:latest   "python -m uvicorn m…"   api       1 minute ago    Up 1 minute (healthy)    127.0.0.1:8000->8000/tcp
sentinel-web     mcp-sentinel-web:latest   "node server.js"         web       1 minute ago    Up 1 minute (healthy)    127.0.0.1:3000->3000/tcp
sentinel-caddy   caddy:2.8-alpine          "caddy run --config …"   caddy     1 minute ago    Up 1 minute              0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
```

### Inspecting Service Logs:

```bash
# View all logs
docker compose -f docker-compose.prod.yml logs -f

# View backend API logs
docker compose -f docker-compose.prod.yml logs -f api

# View frontend logs
docker compose -f docker-compose.prod.yml logs -f web

# View Caddy reverse proxy logs
docker compose -f docker-compose.prod.yml logs -f caddy
```

---

## 10. Testing API and Frontend

Test service health from the EC2 command line:

```bash
# 1. Test API liveness probe
curl -I http://127.0.0.1:8000/health/live

# Expected response:
# HTTP/1.1 200 OK

# 2. Test API readiness probe (verifies Supabase DB pool health)
curl -s http://127.0.0.1:8000/health/ready | jq .

# 3. Test Web frontend probe
curl -I http://127.0.0.1:3000/

# Expected response:
# HTTP/1.1 200 OK

# 4. Test public HTTPS endpoint via Caddy
curl -I https://sentinel.yourdomain.com/health/live
```

---

## 11. Updating Deployment Manually after a Git Push

When code updates are pushed to GitHub `main`, update your EC2 production deployment with zero downtime:

```bash
cd /opt/mcp-sentinel

# 1. Fetch latest changes
git fetch origin

# 2. Pull latest code from main
git pull origin main

# 3. Build updated images
docker compose -f docker-compose.prod.yml build

# 4. Apply changes (Docker Compose performs rolling recreation)
docker compose -f docker-compose.prod.yml --profile tls-proxy up -d --remove-orphans

# 5. Verify container health
docker compose -f docker-compose.prod.yml ps

# 6. Clean up old unreferenced build images to save disk space
docker image prune -f
```

---

## 12. Restarting Services & Rolling Back to a Previous Git Commit

### Restarting Services:
```bash
# Restart all containers
docker compose -f docker-compose.prod.yml restart

# Restart only API service
docker compose -f docker-compose.prod.yml restart api

# Restart only Frontend service
docker compose -f docker-compose.prod.yml restart web
```

### Rolling Back to a Previous Git Commit:
If an issue occurs after a deployment:

```bash
cd /opt/mcp-sentinel

# 1. Check recent commit history
git log -n 5 --oneline

# 2. Check out the known good commit hash or tag
git checkout <COMMIT_SHA>

# 3. Rebuild images with the reverted code
docker compose -f docker-compose.prod.yml build

# 4. Recreate containers
docker compose -f docker-compose.prod.yml --profile tls-proxy up -d --remove-orphans

# 5. Verify health
docker compose -f docker-compose.prod.yml ps
```

---

## 13. Configuring HTTPS & Google OAuth Redirect URLs

### HTTPS Configuration via Caddy:
`docker/Caddyfile` is already configured to automatically request, obtain, and renew Let's Encrypt TLS certificates:
- Ensure ports 80 and 443 are open in your AWS EC2 Security Group.
- Ensure your domain (e.g. `sentinel.yourdomain.com`) points to your EC2 public IP.
- Ensure `PRODUCTION_DOMAIN=sentinel.yourdomain.com` is set in `/opt/mcp-sentinel/.env`.

### Google Cloud Console Configuration:
If Google OAuth 2.0 / OIDC is used:
1. Navigate to **Google Cloud Console** &rarr; **APIs & Services** &rarr; **Credentials**.
2. Edit your OAuth 2.0 Client ID.
3. Under **Authorized JavaScript origins**, add:
   - `https://sentinel.yourdomain.com`
4. Under **Authorized redirect URIs**, add:
   - `https://sentinel.yourdomain.com/api/auth/google/callback`
5. Save changes.
6. Verify in `.env`:
   ```ini
   GOOGLE_REDIRECT_URI=https://sentinel.yourdomain.com/api/auth/google/callback
   FRONTEND_URL=https://sentinel.yourdomain.com
   BACKEND_URL=https://sentinel.yourdomain.com
   ```

---

## 14. Troubleshooting Common Deployment Failures

### Issue 1: Next.js Build Fails with Out of Memory (OOM / Killed)
- **Symptom**: `npm run build` exits with code 137 or `Killed`.
- **Cause**: t3.small instances have 2GB RAM; Next.js webpack/turbopack compilation requires additional memory.
- **Solution**: Enable a 2GB swap file as documented in [Section 2](#essential-configure-2gb-swap-space-for-t3small-instances).

### Issue 2: Supabase Database Connection Timeout or SSL Error
- **Symptom**: `asyncpg.exceptions.InvalidAuthorizationSpecificationError` or connection timeout on `/health/ready`.
- **Solution**:
  - Ensure `?sslmode=require` is appended to `DATABASE_URL`.
  - For Supabase pooler connections, verify whether port `5432` (session mode) or port `6543` (transaction mode) is required.
  - If password contains special characters (`@`, `!`, `#`), ensure it is URL-encoded (e.g., `@` becomes `%40`).

### Issue 3: Caddy Fails to Obtain TLS Certificate
- **Symptom**: Logs show `acme: error presenting token` or `connection refused`.
- **Solution**:
  - Verify AWS Security Group allows inbound traffic on port 80 (HTTP) and port 443 (HTTPS) from `0.0.0.0/0`.
  - Verify your DNS A-record matches your EC2 public Elastic IP: `dig +short sentinel.yourdomain.com`.

### Issue 4: Docker Permission Denied for `ubuntu` User
- **Symptom**: `permission denied while trying to connect to the Docker daemon socket`.
- **Solution**: Run `sudo usermod -aG docker ubuntu`, then log out of SSH and reconnect.

### Issue 5: Port Already in Use (Address already in use)
- **Symptom**: Docker error: `listen tcp 127.0.0.1:8000: bind: address already in use`.
- **Solution**:
  - Check what process is occupying the port: `sudo lsof -i :8000` or `sudo netstat -tlpn | grep 8000`.
  - Kill orphaned processes or stop local services: `sudo kill -9 <PID>`.

### Issue 6: Client Console Cannot Reach Backend API
- **Symptom**: Console UI loads but API requests fail with Network Error or 404.
- **Solution**:
  - Ensure `NEXT_PUBLIC_API_URL` was correctly passed when building the web image.
  - Verify Caddy reverse proxy routing: Caddy routes `/api/*` and `/health/*` to `api:8000`, and `/*` to `web:3000`.
  - Verify CORS origins in `.env`: `ALLOWED_CORS_ORIGINS=["https://sentinel.yourdomain.com"]`.
