#!/bin/bash
# Raise OpenClaw infrastructure on EC2: terraform apply, copy infra, run setup.
# Run from daatan repo: cd infra/openclaw && ./scripts/raise-openclaw.sh
# Prerequisites: AWS credentials, SSH key daatan-key.pem, terraform.tfvars with allowed_ssh_cidr.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OPENCLAW_DIR="$(dirname "$SCRIPT_DIR")"
TERRAFORM_DIR="$OPENCLAW_DIR/terraform"
SSH_KEY="${OPENCLAW_KEY:-$HOME/.ssh/daatan-key.pem}"

cd "$TERRAFORM_DIR"

echo "==> Terraform init"
terraform init

echo "==> Terraform apply"
terraform apply -input=false

IP="$(terraform output -raw openclaw_public_ip)"
echo "==> Instance IP: $IP"

echo "==> Waiting for SSH..."
SSH_OK=""
for i in {1..30}; do
  if ssh -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=5 ubuntu@"$IP" "exit" 2>/dev/null; then
    SSH_OK=1
    break
  fi
  echo "  Retry $i/30..."
  sleep 10
done
if [ -z "$SSH_OK" ]; then
  echo "ERROR: SSH never connected after 30 retries. Check instance and security group."
  exit 1
fi

echo "==> Waiting for provisioning (deploy key)..."
KEY=""
for i in {1..20}; do
  KEY=$(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no ubuntu@"$IP" "cat ~/.ssh/id_github.pub" 2>/dev/null) || true
  if [ -n "$KEY" ]; then
    echo ""
    echo "Add this deploy key to GitHub (komapc/daatan and komapc/year-shape, write access):"
    echo "$KEY"
    echo ""
    read -r -p "Press Enter when done..."
    break
  fi
  echo "  Retry $i/20..."
  sleep 10
done
if [ -z "$KEY" ]; then
  echo "ERROR: Deploy key not found after 20 retries. Check cloud-init/user-data completed."
  exit 1
fi

echo "==> Copying infra to EC2..."
ssh -i "$SSH_KEY" ubuntu@"$IP" "mkdir -p ~/projects"
scp -r -i "$SSH_KEY" "$OPENCLAW_DIR" ubuntu@"$IP":~/projects/

if [ -f "$OPENCLAW_DIR/.env" ]; then
  echo "==> Copying .env"
  scp -i "$SSH_KEY" "$OPENCLAW_DIR/.env" ubuntu@"$IP":~/projects/openclaw/
else
  echo "==> No infra/openclaw/.env found. Copy .env.example to .env, fill in values (OpenClaw only, not daatan app .env), then re-run."
  exit 1
fi

echo "==> Running setup on EC2..."
ssh -i "$SSH_KEY" ubuntu@"$IP" "chmod +x ~/projects/openclaw/scripts/setup-on-ec2.sh && ~/projects/openclaw/scripts/setup-on-ec2.sh"

echo ""
echo "==> OpenClaw is up. Message your Daatan or Calendar Telegram bots to orchestrate."
echo "    (SSH: ssh -i $SSH_KEY ubuntu@$IP)"
