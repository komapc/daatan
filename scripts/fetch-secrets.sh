#!/bin/bash
# Fetch environment variables from AWS Secrets Manager and write to .env
# Falls back silently if the secret is inaccessible (deploy continues with existing .env)
# Usage: ./scripts/fetch-secrets.sh [staging|prod]

ENVIRONMENT=${1:-prod}

# Map deploy environment names to Secrets Manager names.
# blue-green-deploy.sh uses "production" but the secret is named "daatan-env-prod".
case "$ENVIRONMENT" in
  production) SECRET_SUFFIX="prod" ;;
  *)          SECRET_SUFFIX="$ENVIRONMENT" ;;
esac
SECRET_NAME="daatan-env-${SECRET_SUFFIX}"

echo "🔐 Fetching secrets from AWS Secrets Manager: ${SECRET_NAME}"

SECRET_VALUE=$(aws secretsmanager get-secret-value \
  --secret-id "$SECRET_NAME" \
  --query "SecretString" \
  --output text 2>&1)

if [ $? -ne 0 ] || [ -z "$SECRET_VALUE" ]; then
  echo "⚠️ Could not fetch ${SECRET_NAME} from Secrets Manager — falling back to existing .env"
  exit 0
fi

echo "$SECRET_VALUE" > .env
echo "✅ .env written from ${SECRET_NAME}"
