#!/bin/bash
set -e

# DAATAN Rollback Script
# Quickly rollback to the previous deployment

echo "🔄 DAATAN Rollback Script"
echo "========================"

ENVIRONMENT=${1:-production}

if [ "$ENVIRONMENT" != "production" ] && [ "$ENVIRONMENT" != "staging" ]; then
    echo "❌ Error: Environment must be 'production' or 'staging'"
    echo "Usage: $0 [production|staging]"
    exit 1
fi

cd ~/app

echo "🔍 Finding previous deployment..."

# Get the last 2 git commits
CURRENT_COMMIT=$(git rev-parse HEAD)
PREVIOUS_COMMIT=$(git rev-parse HEAD~1)

echo "Current commit: $CURRENT_COMMIT"
echo "Previous commit: $PREVIOUS_COMMIT"

# Confirm rollback
echo ""
echo "⚠️  This will rollback $ENVIRONMENT to the previous commit."
echo "Current: $(git log -1 --oneline $CURRENT_COMMIT)"
echo "Previous: $(git log -1 --oneline $PREVIOUS_COMMIT)"
echo ""
read -p "Continue with rollback? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Rollback cancelled"
    exit 1
fi

echo "🔄 Rolling back to previous commit..."
git checkout $PREVIOUS_COMMIT

# Export environment variables
export POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-$(grep POSTGRES_PASSWORD .env | cut -d'=' -f2)}
export NEXTAUTH_SECRET=${NEXTAUTH_SECRET:-$(grep NEXTAUTH_SECRET .env | cut -d'=' -f2)}
export GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID:-$(grep GOOGLE_CLIENT_ID .env | cut -d'=' -f2)}
export GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET:-$(grep GOOGLE_CLIENT_SECRET .env | cut -d'=' -f2)}
export GEMINI_API_KEY=${GEMINI_API_KEY:-$(grep GEMINI_API_KEY .env | cut -d'=' -f2)}

if [ "$ENVIRONMENT" = "staging" ]; then
    echo "🚀 Rebuilding staging environment..."
    export DEPLOY_ID=$(date +%s)
    docker compose -f docker-compose.prod.yml stop app-staging
    docker compose -f docker-compose.prod.yml build --no-cache app-staging
    docker compose -f docker-compose.prod.yml up -d app-staging
    
    echo "⏳ Waiting for staging to be ready..."
    sleep 15
    
    if ./scripts/verify-deploy.sh "https://staging.daatan.com"; then
        echo "✅ Staging rollback successful"
    else
        echo "❌ Staging rollback failed"
        exit 1
    fi
else
    echo "🚀 Rebuilding production environment..."
    docker compose -f docker-compose.prod.yml stop app
    docker compose -f docker-compose.prod.yml build --no-cache app
    docker compose -f docker-compose.prod.yml up -d app
    
    echo "⏳ Waiting for production to be ready..."
    sleep 15
    
    if ./scripts/verify-deploy.sh "https://daatan.com"; then
        echo "✅ Production rollback successful"
    else
        echo "❌ Production rollback failed"
        exit 1
    fi
fi

echo ""
echo "✅ Rollback completed successfully!"
echo "📋 To return to the latest commit later:"
echo "   git checkout main"
echo "   git pull origin main"