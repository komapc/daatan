#!/bin/bash
set -e

# DAATAN Rollback Script (SSM & ECR Compatible)
# Quickly rollback to a previous version stored in ECR.

echo "🔄 DAATAN Rollback Script"
echo "========================"

ENVIRONMENT=${1:-production}
TARGET_TAG=$2

if [ "$ENVIRONMENT" != "production" ] && [ "$ENVIRONMENT" != "staging" ]; then
    echo "❌ Error: Environment must be 'production' or 'staging'"
    echo "Usage: $0 [production|staging] [image_tag]"
    exit 1
fi

# Source env vars for ECR_REGISTRY
if [ -f .env ]; then
    source .env
else
    echo "❌ .env file not found!"
    exit 1
fi

if [ -z "$ECR_REGISTRY" ]; then
    echo "❌ ECR_REGISTRY not set in .env"
    exit 1
fi

# If no tag provided, list recent images
if [ -z "$TARGET_TAG" ]; then
    echo "🔍 No tag provided. Fetching recent images from ECR..."
    aws ecr list-images --repository-name daatan-app --query 'imageIds[*].imageTag' --output table
    echo "Please run: $0 $ENVIRONMENT <tag>"
    exit 1
fi

# Confirm rollback
echo ""
echo "⚠️  This will rollback $ENVIRONMENT to image tag: $TARGET_TAG"
read -p "Continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Rollback cancelled"
    exit 1
fi

echo "🚀 Executing rollback via blue-green-deploy.sh..."

export ECR_REGISTRY
export IMAGE_TAG="$TARGET_TAG"
export SKIP_BUILD=true

# Resolve app directory
if [ -d "$HOME/app" ]; then
    cd "$HOME/app"
elif [ -d "/home/ubuntu/app" ]; then
    cd "/home/ubuntu/app"
fi

./scripts/blue-green-deploy.sh "$ENVIRONMENT"

echo ""
echo "✅ Rollback completed successfully!"