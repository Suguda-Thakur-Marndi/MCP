#!/usr/bin/env bash
# ==============================================================================
# MCP-Sentinel – Production EC2 Host Initialization Script (Ubuntu 24.04 LTS)
# Target Architecture: AWS EC2 (t3.small / 2 vCPUs / 2GB RAM / ap-southeast-2)
# ==============================================================================
set -euo pipefail

echo "========================================================================"
echo " Starting MCP-Sentinel Host Initialization on Ubuntu 24.04 LTS"
echo "========================================================================"

# 1. Require sudo / root
if [ "$EUID" -ne 0 ]; then
  echo "[!] Please run with sudo: sudo bash $0"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

# 2. System Architecture & Resource Audit
echo "[*] Auditing host hardware resources..."
CPU_CORES=$(nproc)
TOTAL_RAM_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
TOTAL_RAM_MB=$(( TOTAL_RAM_KB / 1024 ))
echo "    - CPU Cores : ${CPU_CORES}"
echo "    - Total RAM : ${TOTAL_RAM_MB} MB"
lsb_release -a 2>/dev/null || cat /etc/os-release

# 3. EBS & Block Device Encryption Check
echo "[*] Checking block storage and filesystem..."
lsblk -o NAME,SIZE,FSTYPE,TYPE,MOUNTPOINTS
df -h /

# 4. Configure Swapfile for t3.small (2GB RAM Safeguard)
SWAP_EXISTS=$(swapon --show | wc -l)
if [ "$SWAP_EXISTS" -le 1 ]; then
  echo "[*] Creating 2GB swapfile at /swapfile for memory stability on t3.small..."
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  if ! grep -q "/swapfile" /etc/fstab; then
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
  fi
  echo "    - Swapfile created and enabled successfully."
else
  echo "[+] Swapfile already configured."
fi
free -h

# 5. Base System Package Updates
echo "[*] Updating apt package repository..."
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

# 6. Install Docker Engine & Docker Compose (Official Docker Repo for Ubuntu Noble)
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
  echo "[+] Docker Engine installed successfully."
else
  echo "[+] Docker Engine is already installed."
fi

# 7. Grant ubuntu user Docker privileges
if id "ubuntu" &>/dev/null; then
  usermod -aG docker ubuntu
  echo "[+] Added 'ubuntu' user to docker group."
fi

# 8. Install / Verify AWS CLI v2
if ! command -v aws &>/dev/null; then
  echo "[*] Installing AWS CLI v2..."
  TMP_DIR=$(mktemp -d)
  curl -s "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "${TMP_DIR}/awscliv2.zip"
  unzip -q "${TMP_DIR}/awscliv2.zip" -d "${TMP_DIR}"
  "${TMP_DIR}/aws/install"
  rm -rf "${TMP_DIR}"
  echo "[+] AWS CLI v2 installed: $(aws --version)"
else
  echo "[+] AWS CLI v2 already present: $(aws --version)"
fi

# 9. Verify Amazon SSM Agent
echo "[*] Checking Amazon SSM Agent service..."
if systemctl is-active --quiet snap.amazon-ssm-agent.amazon-ssm-agent 2>/dev/null; then
  echo "[+] Amazon SSM Agent (snap) is ACTIVE."
elif systemctl is-active --quiet amazon-ssm-agent 2>/dev/null; then
  echo "[+] Amazon SSM Agent (systemd) is ACTIVE."
else
  echo "[!] SSM Agent not active. Attempting start..."
  systemctl enable --now snap.amazon-ssm-agent.amazon-ssm-agent 2>/dev/null || systemctl enable --now amazon-ssm-agent 2>/dev/null || true
fi

# 10. Prepare Deployment Directory
DEPLOY_DIR="/opt/mcp-sentinel"
echo "[*] Configuring deployment directory at ${DEPLOY_DIR}..."
mkdir -p "${DEPLOY_DIR}/docker"
if id "ubuntu" &>/dev/null; then
  chown -R ubuntu:ubuntu "${DEPLOY_DIR}"
fi
chmod 755 "${DEPLOY_DIR}"

# 11. Security Audit & Status Summary
echo "========================================================================"
echo " MCP-Sentinel Host Initialization Completed!"
echo "========================================================================"
echo "Docker Version:  $(docker --version)"
echo "Compose Version: $(docker compose version)"
echo "AWS CLI Version: $(aws --version)"
echo "Target Dir:      ${DEPLOY_DIR}"
echo ""
echo "Next Steps:"
echo "1. Place production .env file into ${DEPLOY_DIR}/.env (chmod 600)"
echo "2. Place docker-compose.prod.yml into ${DEPLOY_DIR}/docker-compose.prod.yml"
echo "3. Attach IAM instance profile (mcp-sentinel-ec2-role) to EC2 instance"
echo "4. Authorize deploy IAM role in GitHub Secrets (AWS_ROLE_ARN, EC2_INSTANCE_ID)"
echo "========================================================================"
