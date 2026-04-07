#!/bin/bash
# Fetch environment variables from AWS Secrets Manager and write to .env
# Usage: ./scripts/fetch-secrets.sh [staging|prod]
set -e

ENVIRONMENT=${1:-prod}
SECRET_NAME="daatan-env-${ENVIRONMENT}"

echo "🔐 Fetching secrets from AWS Secrets Manager: ${SECRET_NAME}"

SECRET_VALUE=$(aws secretsmanager get-secret-value \
  --secret-id "$SECRET_NAME" \
  --query "SecretString" \
  --output text)

if [ -z "$SECRET_VALUE" ]; then
  echo "❌ Failed to retrieve secret: ${SECRET_NAME}"
  exit 1
fi

echo "$SECRET_VALUE" > .env
echo "✅ .env written from ${SECRET_NAME}"
