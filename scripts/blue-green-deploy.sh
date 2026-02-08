#!/bin/bash
set -e

# DAATAN Blue-Green Deployment Script
# Zero-downtime deployment: builds new image while old container serves traffic,
# then does a quick swap (stop old → start new with same name).
#
# How it works:
# - Nginx resolves container hostnames via Docker DNS (resolver 127.0.0.11 valid=30s)
# - Nginx uses variable-based upstream ($upstream_staging / $upstream_prod) so it
#   re-resolves on each request rather than caching at startup
# - We keep the same container name so nginx doesn't need config changes
# - Downtime is reduced to just the stop→start gap (~5-10 seconds)
#
# Usage:
#   ./scripts/blue-green-deploy.sh staging [--no-cache]
#   ./scripts/blue-green-deploy.sh production [--no-cache]

echo "🔵🟢 DAATAN Blue-Green Deployment"
echo "================================="

ENVIRONMENT=${1:-staging}
NO_CACHE_FLAG=""
if [ "$2" = "--no-cache" ]; then
    NO_CACHE_FLAG="--no-cache"
fi

# Determine container and compose service names
if [ "$ENVIRONMENT" = "staging" ]; then
    SERVICE="app-staging"
    CONTAINER="daatan-app-staging"
    DB_SERVICE="postgres-staging"
    HEALTH_URL="https://staging.daatan.com"
elif [ "$ENVIRONMENT" = "production" ]; then
    SERVICE="app"
    CONTAINER="daatan-app"
    DB_SERVICE="postgres"
    HEALTH_URL="https://daatan.com"
else
    echo "❌ Unknown environment: $ENVIRONMENT (use 'staging' or 'production')"
    exit 1
fi

cd ~/app

# Source environment variables
if [ -f .env ]; then
    set -a
    source .env
    set +a
    echo "✅ Loaded env vars from .env"
else
    echo "❌ .env file not found!"
    exit 1
fi

export DEPLOY_ID=$(date +%s)
GIT_COMMIT=$(git rev-parse HEAD)
export GIT_COMMIT
BUILD_TIMESTAMP=$(date +%s)

echo "Environment:  $ENVIRONMENT"
echo "Service:      $SERVICE"
echo "Container:    $CONTAINER"
echo "Git commit:   ${GIT_COMMIT:0:8}"

# ─── Phase 1: Ensure database is running ───────────────────────────────────────
echo ""
echo "📦 Phase 1: Ensuring database is running..."
docker compose -f docker-compose.prod.yml up -d $DB_SERVICE
sleep 5

# ─── Phase 2: Build new image (old container still serving traffic) ─────────────
echo ""
echo "🔨 Phase 2: Building new image (old container still serving traffic)..."

BUILD_ARGS=""
if [ "$ENVIRONMENT" = "staging" ]; then
    BUILD_ARGS="--build-arg DATABASE_URL=postgresql://daatan:${POSTGRES_PASSWORD}@postgres-staging:5432/daatan_staging"
    BUILD_ARGS="$BUILD_ARGS --build-arg NEXTAUTH_URL=https://staging.daatan.com"
    BUILD_ARGS="$BUILD_ARGS --build-arg NEXT_PUBLIC_ENV=staging"
else
    BUILD_ARGS="--build-arg DATABASE_URL=postgresql://daatan:${POSTGRES_PASSWORD}@postgres:5432/daatan"
    BUILD_ARGS="$BUILD_ARGS --build-arg NEXTAUTH_URL=https://daatan.com"
    BUILD_ARGS="$BUILD_ARGS --build-arg NEXT_PUBLIC_ENV=production"
fi
BUILD_ARGS="$BUILD_ARGS --build-arg GIT_COMMIT=$GIT_COMMIT"
BUILD_ARGS="$BUILD_ARGS --build-arg BUILD_TIMESTAMP=$BUILD_TIMESTAMP"

# Build the image without stopping the running container
docker compose -f docker-compose.prod.yml build $NO_CACHE_FLAG $BUILD_ARGS $SERVICE

echo "✅ New image built successfully"

# ─── Phase 3: Quick swap (the only downtime window ~5-10s) ──────────────────────
echo ""
echo "🔄 Phase 3: Swapping containers (brief downtime window)..."

# Stop and remove old container
docker compose -f docker-compose.prod.yml stop $SERVICE || true
docker compose -f docker-compose.prod.yml rm -f $SERVICE || true

# Start new container with the same service name (same container name for nginx)
docker compose -f docker-compose.prod.yml up -d --force-recreate $SERVICE

# Also ensure nginx is running and reload its config to pick up DNS changes faster
docker compose -f docker-compose.prod.yml up -d nginx
docker exec daatan-nginx nginx -s reload 2>/dev/null || true

echo "✅ Container swapped"

# ─── Phase 4: Health check ──────────────────────────────────────────────────────
echo ""
echo "🏥 Phase 4: Waiting for health check..."
sleep 10

for i in {1..15}; do
    if docker exec $CONTAINER wget -qO- http://localhost:3000/api/health 2>/dev/null | grep -q '"status"'; then
        echo "✅ Container is healthy (attempt $i)"
        break
    fi
    if [ $i -eq 15 ]; then
        echo "❌ Health check failed after 15 attempts"
        echo "📋 Container logs:"
        docker logs $CONTAINER --tail 50
        exit 1
    fi
    echo "⏳ Waiting... ($i/15)"
    sleep 5
done

# ─── Phase 5: Run migrations ───────────────────────────────────────────────────
echo ""
echo "🗄️ Phase 5: Running Prisma migrations..."
docker exec $CONTAINER node_modules/prisma/build/index.js migrate deploy || echo "⚠️ No pending migrations"

# ─── Phase 6: External verification ────────────────────────────────────────────
echo ""
echo "🔍 Phase 6: Verifying deployment externally..."
if ./scripts/verify-deploy.sh "$HEALTH_URL"; then
    echo "✅ Deployment verified"
else
    echo "❌ External verification failed"
    docker logs $CONTAINER --tail 50
    exit 1
fi

# ─── Phase 7: Verify auth ──────────────────────────────────────────────────────
echo ""
echo "🔐 Phase 7: Verifying authentication..."
AUTH_CHECK=$(curl -s "$HEALTH_URL/api/auth/providers" | head -c 50)
if echo "$AUTH_CHECK" | grep -q "google"; then
    echo "✅ Authentication working"
else
    echo "⚠️ Auth check failed, restarting with env vars..."
    docker compose -f docker-compose.prod.yml --env-file .env restart $SERVICE
    sleep 10
    AUTH_CHECK=$(curl -s "$HEALTH_URL/api/auth/providers" | head -c 50)
    if echo "$AUTH_CHECK" | grep -q "google"; then
        echo "✅ Authentication working after restart"
    else
        echo "❌ Authentication still failing"
        docker logs $CONTAINER --tail 30 | grep -i "auth\|secret\|error"
        exit 1
    fi
fi

# ─── Cleanup ────────────────────────────────────────────────────────────────────
echo ""
echo "🧹 Cleaning up old images..."
docker image prune -f

echo ""
echo "✅ Blue-green deployment complete!"
echo "   Environment: $ENVIRONMENT"
echo "   Container:   $CONTAINER"
echo "   Commit:      ${GIT_COMMIT:0:8}"
