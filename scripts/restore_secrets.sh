#!/bin/bash

# Restore Secrets to AWS Secrets Manager from Local Files

REGION="eu-central-1"

# 1. Deploy Key (SSH Private Key)
echo "Uploading Deploy Key..."
aws secretsmanager put-secret-value \
    --secret-id daatan-deploy-key-staging \
    --secret-string file:///home/mark/.ssh/daatan-staging-deploy \
    --region "$REGION"

# 2. Environment Variables (.env)
echo "Uploading .env variables..."
aws secretsmanager put-secret-value \
    --secret-id daatan-env-staging \
    --secret-string file:///home/mark/projects/daatan/.env \
    --region "$REGION"

echo "✅ Secrets restored!"
echo "If the server is already running with empty secrets, restart it with:"
echo "terraform apply -replace=\"aws_instance.backend\" -var-file=\"staging.tfvars\""
