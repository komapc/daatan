#!/bin/bash
# Destroy OpenClaw infrastructure. Runs terraform destroy.
# Run from daatan repo: cd infra/openclaw && ./scripts/destroy-openclaw.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OPENCLAW_DIR="$(dirname "$SCRIPT_DIR")"
TERRAFORM_DIR="$OPENCLAW_DIR/terraform"

cd "$TERRAFORM_DIR"

echo "==> Terraform destroy"
terraform destroy -input=false

echo "==> OpenClaw infrastructure destroyed."
