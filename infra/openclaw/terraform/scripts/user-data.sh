#!/bin/bash
# EC2 user_data: install Docker, Ollama, fetch secrets, provision ~/projects layout.
# Run by cloud-init at first boot.

set -euo pipefail

exec > >(tee /var/log/user-data.log) 2>&1

echo "=== OpenClaw EC2 Provisioning Started ==="
echo "Date: $(date)"

# =============================================================================
# System Setup
# =============================================================================

echo "==> Updating system..."
apt-get update
apt-get upgrade -y

echo "==> Installing Docker..."
apt-get install -y ca-certificates curl gnupg unzip
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

usermod -aG docker ubuntu

echo "==> Installing Ollama..."
curl -fsSL https://ollama.com/install.sh | sh

mkdir -p /etc/systemd/system/ollama.service.d
printf '%s\n%s\n' '[Service]' 'Environment="OLLAMA_HOST=0.0.0.0"' > /etc/systemd/system/ollama.service.d/override.conf

systemctl daemon-reload
systemctl restart ollama

echo "==> Pulling Qwen model (with timeout)..."
timeout 300 sudo -u ubuntu ollama pull qwen2.5:1.5b || echo "Warning: Ollama pull failed or timed out"

# =============================================================================
# Fetch Secrets from AWS Secrets Manager
# =============================================================================

echo "==> Fetching secrets from AWS Secrets Manager..."

# Install AWS CLI if not available (should be available via IAM role)
if ! command -v aws &> /dev/null; then
    echo "Installing AWS CLI..."
    curl "https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip" -o "awscliv2.zip"
    unzip -q awscliv2.zip
    ./aws/install
    rm -rf aws awscliv2.zip
fi

# Function to get secret value
get_secret() {
    local secret_name="$1"
    aws secretsmanager get-secret-value \
        --secret-id "$secret_name" \
        --query SecretString \
        --output text \
        --region eu-central-1 2>/dev/null || echo ""
}

# Create .env from secrets
mkdir -p /home/ubuntu/projects/openclaw
cat > /home/ubuntu/projects/openclaw/.env << EOF
# OpenClaw .env (generated from AWS Secrets Manager)
# Generated: $(date -Iseconds)

GEMINI_API_KEY=$(get_secret "openclaw/gemini-api-key")
OPENROUTER_API_KEY=$(get_secret "openclaw/openrouter-api-key")
ANTHROPIC_API_KEY=$(get_secret "openclaw/anthropic-api-key")
TELEGRAM_BOT_TOKEN_DAATAN=$(get_secret "openclaw/telegram-bot-token-daatan")
TELEGRAM_BOT_TOKEN_CALENDAR=$(get_secret "openclaw/telegram-bot-token-calendar")
TELEGRAM_CHAT_ID=
EOF

chmod 600 /home/ubuntu/projects/openclaw/.env

echo "==> Secrets fetched successfully"

# =============================================================================
# Create Projects Directory
# =============================================================================

echo "==> Creating projects directory..."
mkdir -p /home/ubuntu/projects
chown ubuntu:ubuntu /home/ubuntu/projects

# Generate SSH key for GitHub access
echo "==> Generating SSH key for GitHub..."
sudo -u ubuntu ssh-keygen -t ed25519 -N "" -f /home/ubuntu/.ssh/id_github

echo "=== OpenClaw EC2 Provisioning Complete ==="
echo "Next steps:"
echo "  1. Copy infra to instance: scp -r infra/openclaw ubuntu@<IP>:~/projects/"
echo "  2. Run setup: ssh ubuntu@<IP> '~/projects/openclaw/scripts/setup/on-ec2.sh'"
echo ""
echo "Secrets stored in: /home/ubuntu/projects/openclaw/.env"
