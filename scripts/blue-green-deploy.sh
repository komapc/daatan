#!/bin/bash
set -e

# DAATAN Blue-Green Deployment Script
# True zero-downtime: builds new container, health-checks it, runs migrations,
# then swaps traffic using Docker network aliases.
#
# How it works:
# 1. Build new image while old container serves traffic
# 2. Start new container with a temporary name (no network alias yet)
# 3. Health-check the new container directly
# 4. Run migrations on the new container (before swap — if they fail, old stays live)
# 5. Swap traffic: disconnect old container's network alias, connect new container
#    with the service alias so nginx resolves to the new container instantly
# 6. Stop old container
#
# Nginx uses variable-based upstream ($upstream_staging / $upstream_prod) with
# Docker DNS resolver (127.0.0.11 valid=30s), so it re-resolves on each request.
# By swapping network aliases, Docker DNS points to the new container immediately.
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
# SERVICE_ALIAS is the DNS name nginx uses to reach the app container
if [ "$ENVIRONMENT" = "staging" ]; then
    SERVICE="app-staging"
    SERVICE_ALIAS="app-staging"
    CONTAINER="daatan-app-staging"
    CONTAINER_NEW="daatan-app-staging-new"
    DB_SERVICE="postgres-staging"
    HEALTH_URL="https://staging.daatan.com"
elif [ "$ENVIRONMENT" = "production" ]; then
    SERVICE="app"
    SERVICE_ALIAS="app"
    CONTAINER="daatan-app"
    CONTAINER_NEW="daatan-app-new"
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

echo ""
echo "🧹 Pre-build cleanup: Docker disk usage before prune"
docker system df || true

echo ""
echo "🧹 Pre-build cleanup: pruning unused Docker data to free space..."
docker image prune -af || true
docker builder prune -af || true
docker volume prune -f || true

echo ""
echo "🧹 Pre-build cleanup: Docker disk usage after prune"
docker system df || true

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
if [ "${SKIP_BUILD}" == "true" ]; then
    echo "🔨 Phase 2: Skipping build (using pre-pulled image)..."
    IMAGE_NAME="daatan-app:staging-latest"
else
    # Build the image without stopping the running container
    docker compose -f docker-compose.prod.yml build $NO_CACHE_FLAG $BUILD_ARGS $SERVICE
    echo "✅ New image built successfully"
fi

# ─── Phase 3: Start new container alongside old one ─────────────────────────────
echo ""
echo "🆕 Phase 3: Starting new container alongside old one..."

# Clean up any leftover new container from a previous failed deploy
docker rm -f $CONTAINER_NEW 2>/dev/null || true

# Get the image name that was just built (or pre-pulled)
if [ "${SKIP_BUILD}" == "true" ]; then
    IMAGE_NAME="daatan-app:staging-latest"
elif [ "$ENVIRONMENT" = "staging" ]; then
    IMAGE_NAME="daatan-app:staging-${DEPLOY_ID}"
else
    IMAGE_NAME="daatan-app:latest"
fi

# Get environment variables from the compose file for the new container
# We run the new container directly (not via compose) to avoid name conflicts
ENV_ARGS=""
ENV_ARGS="$ENV_ARGS -e NODE_ENV=production"
ENV_ARGS="$ENV_ARGS -e NEXT_PUBLIC_ENV=${ENVIRONMENT}"
ENV_ARGS="$ENV_ARGS -e NEXTAUTH_SECRET=${NEXTAUTH_SECRET}"
ENV_ARGS="$ENV_ARGS -e GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}"
ENV_ARGS="$ENV_ARGS -e GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}"
ENV_ARGS="$ENV_ARGS -e SERPER_API_KEY=${SERPER_API_KEY}"
ENV_ARGS="$ENV_ARGS -e GEMINI_API_KEY=${GEMINI_API_KEY}"
ENV_ARGS="$ENV_ARGS -e APP_VERSION=${APP_VERSION:-0.1.19}"

if [ "$ENVIRONMENT" = "staging" ]; then
    ENV_ARGS="$ENV_ARGS -e DATABASE_URL=postgresql://daatan:${POSTGRES_PASSWORD}@postgres-staging:5432/daatan_staging"
    ENV_ARGS="$ENV_ARGS -e NEXTAUTH_URL=https://staging.daatan.com"
    ENV_ARGS="$ENV_ARGS -e AUTH_TRUST_HOST=true"
else
    ENV_ARGS="$ENV_ARGS -e DATABASE_URL=postgresql://daatan:${POSTGRES_PASSWORD}@postgres:5432/daatan"
    ENV_ARGS="$ENV_ARGS -e NEXTAUTH_URL=https://daatan.com"
fi

# Get the Docker network name (compose project network)
NETWORK=$(docker inspect $CONTAINER --format '{{range $key, $val := .NetworkSettings.Networks}}{{$key}}{{end}}' 2>/dev/null || echo "app_default")

# Start new container on the same network but with a temporary name
# No network alias yet — old container still owns the service alias
docker run -d \
    --name $CONTAINER_NEW \
    --network $NETWORK \
    --restart unless-stopped \
    $ENV_ARGS \
    $IMAGE_NAME

echo "✅ New container started as $CONTAINER_NEW"

# ─── Phase 4: Health check new container ─────────────────────────────────────────
echo ""
echo "🏥 Phase 4: Health-checking new container..."
sleep 5

for i in {1..20}; do
    if docker exec $CONTAINER_NEW wget -qO- http://localhost:3000/api/health 2>/dev/null | grep -q '"status"'; then
        echo "✅ New container is healthy (attempt $i)"
        break
    fi
    if [ $i -eq 20 ]; then
        echo "❌ New container failed health check after 20 attempts"
        echo "📋 New container logs:"
        docker logs $CONTAINER_NEW --tail 50
        # Clean up failed new container
        docker rm -f $CONTAINER_NEW 2>/dev/null || true
        echo "🔄 Old container still serving traffic — no downtime occurred"
        exit 1
    fi
    echo "⏳ Waiting... ($i/20)"
    sleep 3
done

# ─── Phase 5: Run migrations (BEFORE swap — old container still serves traffic) ─
echo ""
echo "🗄️ Phase 5: Running Prisma migrations on new container..."
docker exec $CONTAINER_NEW node_modules/prisma/build/index.js migrate deploy 2>&1 || {
    echo "❌ Migration failed! Aborting deployment."
    echo "📋 New container logs:"
    docker logs $CONTAINER_NEW --tail 30
    # Clean up failed new container — old container keeps serving
    docker rm -f $CONTAINER_NEW 2>/dev/null || true
    echo "🔄 Old container still serving traffic — no downtime occurred"
    exit 1
}
echo "✅ Migrations applied successfully"

# ─── Phase 6: Swap traffic via network aliases (zero downtime) ──────────────────
echo ""
echo "🔄 Phase 6: Swapping traffic to new container..."

# Disconnect old container from network (removes its DNS alias)
docker network disconnect $NETWORK $CONTAINER 2>/dev/null || true

# Reconnect new container with the service alias so nginx resolves to it
# First disconnect (it's already connected without alias), then reconnect with alias
docker network disconnect $NETWORK $CONTAINER_NEW 2>/dev/null || true
docker network connect --alias $SERVICE_ALIAS $NETWORK $CONTAINER_NEW

# Reload nginx to force immediate DNS re-resolution
docker exec daatan-nginx nginx -s reload 2>/dev/null || true

echo "✅ Traffic swapped to new container"

# Stop and remove old container
docker stop $CONTAINER 2>/dev/null || true
docker rm -f $CONTAINER 2>/dev/null || true

# Rename new container to the canonical name for future deploys
docker rename $CONTAINER_NEW $CONTAINER

echo "✅ Old container removed, new container is now $CONTAINER"

# ─── Phase 7: External verification ────────────────────────────────────────────
echo ""
echo "🔍 Phase 7: Verifying deployment externally..."
echo "   (waiting for nginx DNS cache to expire...)"
sleep 3
if ./scripts/verify-deploy.sh "$HEALTH_URL"; then
    echo "✅ Deployment verified"
else
    echo "❌ External verification failed"
    docker logs $CONTAINER --tail 50
    exit 1
fi

# ─── Phase 8: Verify auth ──────────────────────────────────────────────────────
echo ""
echo "🔐 Phase 8: Verifying authentication..."
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
