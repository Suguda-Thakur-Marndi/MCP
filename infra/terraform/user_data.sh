#!/usr/bin/env bash
# ==============================================================================
# MCP-Sentinel – EC2 Bootstrap User Data Script (Ubuntu 24.04 LTS / ap-southeast-2)
# ==============================================================================
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

echo "========================================================================"
echo " Bootstrapping MCP-Sentinel Host on AWS EC2"
echo "========================================================================"

# 1. Configure Swapfile (2GB memory safeguard for t3.small instances)
SWAP_EXISTS=$(swapon --show | wc -l)
if [ "$SWAP_EXISTS" -le 1 ]; then
  echo "[*] Allocating 2GB swap space at /swapfile..."
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  if ! grep -q "/swapfile" /etc/fstab; then
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
  fi
  echo "[+] Swap configured successfully."
fi

# 2. Update package repositories and install core utilities
apt-get update -y
apt-get install -y --no-install-recommends \
  ca-certificates \
  curl \
  gnupg \
  lsb-release \
  jq \
  unzip \
  git \
  ufw

# 3. Install official Docker Engine and Docker Compose Plugin
if ! command -v docker &>/dev/null; then
  echo "[*] Installing official Docker Engine..."
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc

  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
    tee /etc/apt/sources.list.d/docker.list > /dev/null

  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

  systemctl enable docker
  systemctl start docker
  echo "[+] Docker Engine installed."
fi

# 4. Grant ubuntu user docker access
if id "ubuntu" &>/dev/null; then
  usermod -aG docker ubuntu
fi

# 5. Install AWS CLI v2
if ! command -v aws &>/dev/null; then
  echo "[*] Installing AWS CLI v2..."
  TMP_DIR=$(mktemp -d)
  curl -s "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "${TMP_DIR}/awscliv2.zip"
  unzip -q "${TMP_DIR}/awscliv2.zip" -d "${TMP_DIR}"
  "${TMP_DIR}/aws/install"
  rm -rf "${TMP_DIR}"
  echo "[+] AWS CLI v2 installed."
fi

# 6. Verify and activate Amazon SSM Agent
echo "[*] Activating Amazon SSM Agent..."
systemctl enable --now snap.amazon-ssm-agent.amazon-ssm-agent 2>/dev/null || systemctl enable --now amazon-ssm-agent 2>/dev/null || true

# 7. Initialize deployment directory
DEPLOY_DIR="/opt/mcp-sentinel"
echo "[*] Preparing deployment directory at ${DEPLOY_DIR}..."
mkdir -p "${DEPLOY_DIR}/docker"
if id "ubuntu" &>/dev/null; then
  chown -R ubuntu:ubuntu "${DEPLOY_DIR}"
fi
chmod 755 "${DEPLOY_DIR}"

echo "[+] MCP-Sentinel host bootstrap completed successfully."
