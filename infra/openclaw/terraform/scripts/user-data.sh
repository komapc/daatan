#!/bin/bash
# EC2 user_data: install Docker, fetch secrets, set up OpenClaw + LiteLLM.
# Templated by Terraform — variables in ${} are replaced at plan time.

set -euo pipefail
exec > >(tee /var/log/user-data.log) 2>&1

echo "=== OpenClaw EC2 Provisioning Started ==="
echo "Instance: $(curl -s http://169.254.169.254/latest/meta-data/instance-type)"
echo "Date: $(date)"

# =============================================================================
# System Setup
# =============================================================================
apt-get update
apt-get upgrade -y

apt-get install -y ca-certificates curl gnupg unzip jq

# Docker
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
usermod -aG docker ubuntu

# SSM Agent (needed for remote access without SSH)
snap install amazon-ssm-agent --classic || true
systemctl enable snap.amazon-ssm-agent.amazon-ssm-agent.service
systemctl start  snap.amazon-ssm-agent.amazon-ssm-agent.service

# =============================================================================
# Fetch Secrets from AWS Secrets Manager
# =============================================================================
get_secret() {
  aws secretsmanager get-secret-value \
    --secret-id "$1" --region "${aws_region}" \
    --query SecretString --output text 2>/dev/null || echo ""
}

mkdir -p /home/ubuntu/projects/openclaw
cat > /home/ubuntu/projects/openclaw/.env << ENV
# OpenClaw .env — generated from AWS Secrets Manager at boot
# Generated: $(date -Iseconds)

OPENROUTER_API_KEY=$(get_secret "openclaw/openrouter-api-key")
ANTHROPIC_API_KEY=$(get_secret "openclaw/anthropic-api-key")
GEMINI_API_KEY=$(get_secret "openclaw/gemini-api-key")
TELEGRAM_BOT_TOKEN=$(get_secret "openclaw/telegram-bot-token")
LITELLM_MASTER_KEY=${litellm_master_key}
OPENCLAW_GATEWAY_TOKEN=openclaw-web-chat-token
ENV
chmod 600 /home/ubuntu/projects/openclaw/.env

# =============================================================================
# Directory Layout
# =============================================================================
mkdir -p /home/ubuntu/projects
mkdir -p /home/ubuntu/.openclaw
mkdir -p /home/ubuntu/.ssh

# GitHub deploy key
sudo -u ubuntu ssh-keygen -t ed25519 -N "" -f /home/ubuntu/.ssh/id_github -C "openclaw-ec2"
chown -R ubuntu:ubuntu /home/ubuntu/{projects,.openclaw,.ssh}

# /app symlink — required by OpenClaw for Docker sibling container volume mounts
ln -sfn /home/ubuntu/projects/openclaw /app

echo "=== Provisioning Complete ==="
echo ""
echo "Next steps (run from your machine):"
echo "  1. Copy infra:  scp -r infra/openclaw ubuntu@<IP>:~/projects/openclaw"
echo "  2. Build:       ssh ubuntu@<IP> 'cd ~/projects/openclaw && docker compose build'"
echo "  3. Start:       ssh ubuntu@<IP> 'cd ~/projects/openclaw && docker compose up -d'"
echo "  4. Deploy key:  ssh ubuntu@<IP> 'cat ~/.ssh/id_github.pub'  → add to GitHub"
echo ""
echo "Or use SSM: aws ssm start-session --target <instance-id> --region ${aws_region}"
