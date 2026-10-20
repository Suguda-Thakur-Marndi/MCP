#!/usr/bin/env bash
# ==============================================================================
# SentinelCore – AWS Secrets Manager Production Sync Helper
# ==============================================================================
# Retrieves sensitive production credentials (JWT secrets, Supabase credentials,
# Google OAuth, Notion API keys) from AWS Secrets Manager and safely writes them
# to /opt/mcp-sentinel/.env with restrictive 0600 permissions.
#
# Usage:
#   sudo ./scripts/aws_secrets_sync.sh [SECRET_ID] [REGION]
# ==============================================================================
set -euo pipefail

SECRET_ID="${1:-mcp-sentinel/production/secrets}"
AWS_REGION="${2:-ap-southeast-2}"
DEPLOY_DIR="/opt/mcp-sentinel"
TARGET_ENV="${DEPLOY_DIR}/.env"

echo "[*] Retrieving secrets from AWS Secrets Manager (${SECRET_ID} in ${AWS_REGION})..."

if ! command -v aws &>/dev/null; then
  echo "[!] Error: AWS CLI is not installed."
  exit 1
fi

if ! command -v jq &>/dev/null; then
  echo "[!] Error: jq is required for JSON parsing."
  exit 1
fi

mkdir -p "${DEPLOY_DIR}"

SECRET_JSON=$(aws secretsmanager get-secret-value \
  --secret-id "${SECRET_ID}" \
  --region "${AWS_REGION}" \
  --query "SecretString" \
  --output text)

if [ -z "$SECRET_JSON" ]; then
  echo "[!] Error: Secret '${SECRET_ID}' returned empty or was not found."
  exit 1
fi

echo "[*] Writing runtime environment to ${TARGET_ENV}..."
# Touch file with restricted permissions before populating
touch "${TARGET_ENV}"
chmod 600 "${TARGET_ENV}"

# Parse key-value pairs into environment format
echo "# ============================================================" > "${TARGET_ENV}"
echo "# SentinelCore Production Environment (Synced from Secrets Manager)" >> "${TARGET_ENV}"
echo "# Generated: $(date -u)" >> "${TARGET_ENV}"
echo "# ============================================================" >> "${TARGET_ENV}"

echo "$SECRET_JSON" | jq -r 'to_entries | .[] | "\(.key)=\(.value)"' >> "${TARGET_ENV}"

chmod 600 "${TARGET_ENV}"
if id "ubuntu" &>/dev/null; then
  chown ubuntu:ubuntu "${TARGET_ENV}"
fi

echo "[+] Successfully synchronized production secrets to ${TARGET_ENV} with 0600 permissions."
