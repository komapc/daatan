#!/bin/bash

# Restore Secrets to AWS Secrets Manager from Local Files
# Used to refresh secrets after local changes (e.g. rotating API keys in .env).
#
# The deploy_key secret stores an SSH private key used by EC2 user_data to
# clone the repo during initial instance bootstrap. It is NOT used by the
# CI/CD pipeline (which uses OIDC + SSM instead).
#
# Usage:
#   ./scripts/restore_secrets.sh staging
#   ./scripts/restore_secrets.sh prod

REGION="eu-central-1"
ENV=${1:-staging}

if [[ "$ENV" != "staging" && "$ENV" != "prod" ]]; then
  echo "Usage: $0 [staging|prod]"
  exit 1
fi

# 1. Deploy Key (SSH Private Key — used for EC2 bootstrap git clone)
echo "Uploading Deploy Key for $ENV..."
aws secretsmanager put-secret-value \
    --secret-id "daatan-deploy-key-$ENV" \
    --secret-string file:///home/mark/.ssh/daatan-staging-deploy \
    --region "$REGION"

# 2. Environment Variables (.env)
echo "Uploading .env variables for $ENV..."
aws secretsmanager put-secret-value \
    --secret-id "daatan-env-$ENV" \
    --secret-string file:///home/mark/projects/daatan/.env \
    --region "$REGION"

echo "✅ Secrets restored for $ENV!"
echo "If the server needs the new secrets immediately, restart the app container via SSM:"
if [[ "$ENV" == "prod" ]]; then
  echo "  aws ssm send-command --instance-ids i-04ea44d4243d35624 \\"
  echo "    --document-name AWS-RunShellScript \\"
  echo "    --parameters 'commands=[\"cd ~/app && docker compose -f docker-compose.prod.yml restart app\"]'"
else
  echo "  aws ssm send-command --instance-ids i-0286f62b47117b85c \\"
  echo "    --document-name AWS-RunShellScript \\"
  echo "    --parameters 'commands=[\"cd ~/app && docker compose -f docker-compose.prod.yml restart app-staging\"]'"
fi
