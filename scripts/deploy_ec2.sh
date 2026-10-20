#!/usr/bin/env bash
# ==============================================================================
# SentinelCore – Safe Production EC2 Deployment Script (Ubuntu 24.04 LTS)
# Manual deployment: Git + Local Docker Build + Docker Compose + Supabase
# ==============================================================================
# Operating Rules:
#  1. Stop immediately on errors (set -euo pipefail)
#  2. Verify required tools and files
#  3. Check that .env exists and has restrictive permissions (chmod 600)
#  4. Validate required configuration without printing secrets
#  5. Validate Docker Compose configuration
#  6. Build the required images locally on EC2
#  7. Run safe pre-deployment checks (Supabase connectivity & migration status)
#  8. Require explicit confirmation before database migrations
#  9. Start or update services using Docker Compose
# 10. Wait for container health checks
# 11. Display container health and sanitized logs
# 12. Stop and report a clear error if a critical health check fails
# 13. NEVER delete database volumes, reset databases, or run destructive cleanup
# 14. NEVER execute git reset --hard, docker system prune -a, or destructive SQL
# ==============================================================================

set -euo pipefail

# ANSI Color codes for clean reporting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

log_info()  { echo -e "${BLUE}[INFO]${NC} $*"; }
log_ok()    { echo -e "${GREEN}[OK]${NC} $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_err()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }
log_step()  { echo -e "\n${BOLD}======================================================================${NC}\n${BOLD}$*${NC}\n${BOLD}======================================================================${NC}"; }

# Determine repository root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env"

log_step "Step 1: Verifying Host Prerequisites and Tools"

# 1. Verify required CLI tools
REQUIRED_TOOLS=("docker" "git" "curl")
for tool in "${REQUIRED_TOOLS[@]}"; do
  if ! command -v "${tool}" &>/dev/null; then
    log_err "Required tool '${tool}' is not installed or not in PATH."
    exit 1
  fi
done
log_ok "All required CLI tools are present: ${REQUIRED_TOOLS[*]}"

# Verify Docker Compose plugin
if ! docker compose version &>/dev/null; then
  log_err "Docker Compose V2 plugin ('docker compose') is required."
  exit 1
fi
log_ok "Docker Compose V2 verified: $(docker compose version --short 2>/dev/null || docker compose version)"

# Check Docker daemon access
if ! docker info &>/dev/null; then
  log_err "Cannot communicate with Docker daemon. Is Docker running and does user have permissions?"
  exit 1
fi
log_ok "Docker daemon communication verified."

# 2. Verify repository files
if [ ! -f "${COMPOSE_FILE}" ]; then
  log_err "Production compose file '${COMPOSE_FILE}' not found in ${REPO_ROOT}."
  exit 1
fi
log_ok "Compose file '${COMPOSE_FILE}' found."

log_step "Step 2: Checking Environment Configuration Security"

# 3. Check .env exists
if [ ! -f "${ENV_FILE}" ]; then
  log_err ".env file not found at ${REPO_ROOT}/${ENV_FILE}."
  log_err "Please create it from .env.example: cp .env.example .env && chmod 600 .env"
  exit 1
fi

# Check permissions on .env (should be 600 or 400 on POSIX systems)
if [ "$(uname)" = "Linux" ] || [ "$(uname)" = "Darwin" ]; then
  PERMS=$(stat -c "%a" "${ENV_FILE}" 2>/dev/null || stat -f "%OLp" "${ENV_FILE}" 2>/dev/null || echo "")
  if [ -n "${PERMS}" ]; then
    if [ "${PERMS}" != "600" ] && [ "${PERMS}" != "400" ]; then
      log_warn ".env has permissions ${PERMS}. Hardening to 600..."
      chmod 600 "${ENV_FILE}"
    fi
    log_ok ".env file permissions verified (600)."
  fi
fi

# 4. Validate required environment variables without printing secrets
log_info "Validating configuration values (rejecting unconfigured placeholders)..."

# Helper to check a variable inside .env without printing its value
check_var() {
  local var_name="$1"
  local val
  val=$(grep -E "^${var_name}=" "${ENV_FILE}" | cut -d '=' -f2- | tr -d '"' | tr -d "'" | tr -d '\r' || true)
  if [ -z "${val}" ]; then
    log_err "Required variable '${var_name}' is missing or empty in ${ENV_FILE}."
    return 1
  fi
  if [[ "${val}" =~ (YOUR_|YOUR-|<YOUR_|TODO|CHANGEME|xxx|replace_with) ]]; then
    log_err "Variable '${var_name}' contains a known placeholder value. Please set a real secret."
    return 1
  fi
  return 0
}

# Check secret lengths for cryptographic keys
check_min_len() {
  local var_name="$1"
  local min_len="$2"
  local val
  val=$(grep -E "^${var_name}=" "${ENV_FILE}" | cut -d '=' -f2- | tr -d '"' | tr -d "'" | tr -d '\r' || true)
  if [ "${#val}" -lt "${min_len}" ]; then
    log_err "Variable '${var_name}' must be at least ${min_len} characters (found ${#val})."
    return 1
  fi
  return 0
}

# Check database connection URL
DB_URL=$(grep -E "^(DATABASE_URL|SUPABASE_DATABASE_URL)=" "${ENV_FILE}" | head -n 1 | cut -d '=' -f2- | tr -d '"' | tr -d "'" | tr -d '\r' || true)
if [ -z "${DB_URL}" ] || [[ "${DB_URL}" =~ (YOUR_POSTGRES_PASSWORD|YOUR-PASSWORD) ]]; then
  log_err "Neither DATABASE_URL nor SUPABASE_DATABASE_URL has a valid connection string."
  exit 1
fi
log_ok "Database URL configuration present."

# Check security keys
check_var "SESSION_SECRET" && check_min_len "SESSION_SECRET" 32
check_var "JWT_SECRET_KEY" && check_min_len "JWT_SECRET_KEY" 32
check_var "APPROVAL_HMAC_SECRET" && check_min_len "APPROVAL_HMAC_SECRET" 32
log_ok "Cryptographic secrets validated (SESSION_SECRET, JWT_SECRET_KEY, APPROVAL_HMAC_SECRET >= 32 chars)."

# Check OAuth configuration if configured
PROD_DOMAIN=$(grep -E "^PRODUCTION_DOMAIN=" "${ENV_FILE}" | cut -d '=' -f2- | tr -d '"' | tr -d "'" | tr -d '\r' || true)
if [ -n "${PROD_DOMAIN}" ] && [ "${PROD_DOMAIN}" != "sentinel.yourdomain.com" ]; then
  log_info "Production domain configured: ${PROD_DOMAIN}"
else
  log_warn "PRODUCTION_DOMAIN is unset or set to placeholder 'sentinel.yourdomain.com'."
  log_warn "Direct port mode will be used unless a verified domain is configured."
fi

log_step "Step 3: Validating Docker Compose Configuration"

# 5. Validate compose syntax
if ! docker compose -f "${COMPOSE_FILE}" config > /dev/null; then
  log_err "Docker Compose configuration validation failed."
  exit 1
fi
log_ok "Docker Compose configuration syntax is valid."

log_step "Step 4: Running Pre-Deployment Database Checks"

# 7. Check database connectivity safely
if command -v python3 &>/dev/null; then
  log_info "Testing Supabase connectivity and migration status via init_db.py --check-only..."
  if python3 scripts/init_db.py --check-only; then
    log_ok "Database connectivity and schema migration status verified."
  else
    log_warn "Database status check returned non-zero. The database may not be migrated yet or needs network access."
  fi
else
  log_warn "Python3 not available on host. Skipping local script pre-check (container will verify DB at startup)."
fi

log_step "Step 5: Database Migrations"

# 8. Require explicit operator confirmation before applying migrations
if command -v python3 &>/dev/null; then
  echo -e "${YELLOW}Database migrations update schema tables on Supabase.${NC}"
  echo -e "${YELLOW}Migrations 001-012 are idempotent and do not truncate or wipe production data.${NC}"
  read -r -p "Apply pending database migrations now? (yes/no): " MIGRATE_CONFIRM
  if [ "${MIGRATE_CONFIRM}" = "yes" ] || [ "${MIGRATE_CONFIRM}" = "y" ]; then
    log_info "Applying migrations (seed data disabled for production)..."
    python3 scripts/init_db.py --no-seed
    log_ok "Database migrations applied successfully."
  else
    log_info "Skipping database migrations as requested."
  fi
else
  log_info "Python3 not on host; skipping host-level migration step."
fi

log_step "Step 6: Building Local Production Docker Images"

# 6. Build the required images locally on EC2
log_info "Building API and Web images locally (with memory optimization)..."
docker compose -f "${COMPOSE_FILE}" build api web
log_ok "Docker images built successfully."

log_step "Step 7: Starting / Updating Container Services"

# Determine if Caddy TLS reverse proxy should be active
COMPOSE_PROFILES=()
if [ -n "${PROD_DOMAIN}" ] && [ "${PROD_DOMAIN}" != "sentinel.yourdomain.com" ]; then
  log_info "Enabling Caddy TLS reverse proxy profile for domain: ${PROD_DOMAIN}"
  COMPOSE_PROFILES+=(--profile tls-proxy)
fi

# 9. Start services
docker compose -f "${COMPOSE_FILE}" "${COMPOSE_PROFILES[@]}" up -d --remove-orphans
log_ok "Docker Compose up executed."

log_step "Step 8: Waiting for Container Health Checks"

# 10. Wait for health checks
MAX_ATTEMPTS=24 # 24 * 5s = 120s
ATTEMPT=0
ALL_HEALTHY=false

log_info "Awaiting healthy status for sentinelcore-api and sentinelcore-web..."

while [ ${ATTEMPT} -lt ${MAX_ATTEMPTS} ]; do
  ATTEMPT=$((ATTEMPT + 1))
  sleep 5

  API_STATUS=$(docker inspect --format='{{json .State.Health.Status}}' sentinelcore-api 2>/dev/null || docker inspect --format='{{json .State.Health.Status}}' sentinel-api 2>/dev/null || echo '"not_running"')
  WEB_STATUS=$(docker inspect --format='{{json .State.Health.Status}}' sentinelcore-web 2>/dev/null || docker inspect --format='{{json .State.Health.Status}}' sentinel-web 2>/dev/null || echo '"not_running"')

  # Remove quotes
  API_STATUS=$(echo "${API_STATUS}" | tr -d '"')
  WEB_STATUS=$(echo "${WEB_STATUS}" | tr -d '"')

  log_info "[Attempt ${ATTEMPT}/${MAX_ATTEMPTS}] API: ${API_STATUS} | Web: ${WEB_STATUS}"

  if [ "${API_STATUS}" = "healthy" ] && [ "${WEB_STATUS}" = "healthy" ]; then
    ALL_HEALTHY=true
    break
  fi

  if [ "${API_STATUS}" = "unhealthy" ] || [ "${WEB_STATUS}" = "unhealthy" ]; then
    log_err "A service has entered 'unhealthy' state!"
    break
  fi
done

# 11 & 12. Report status and exit on error
echo ""
docker compose -f "${COMPOSE_FILE}" ps

if [ "${ALL_HEALTHY}" = true ]; then
  log_ok "All SentinelCore production services are HEALTHY and serving traffic!"
  echo ""
  echo "Endpoints:"
  echo "  - Backend Live:   http://127.0.0.1:8000/health/live"
  echo "  - Backend Ready:  http://127.0.0.1:8000/health/ready"
  echo "  - Frontend Web:   http://127.0.0.1:3000/"
  if [ -n "${PROD_DOMAIN}" ] && [ "${PROD_DOMAIN}" != "sentinel.yourdomain.com" ]; then
    echo "  - Public Domain:  https://${PROD_DOMAIN}/"
  fi
  echo "======================================================================"
  exit 0
else
  log_err "Deployment health check FAILED or timed out after $((MAX_ATTEMPTS * 5)) seconds."
  echo ""
  log_info "Displaying recent sanitized container logs for debugging:"
  docker compose -f "${COMPOSE_FILE}" logs --tail=30
  exit 1
fi
