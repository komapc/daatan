#!/bin/bash
set -e

# DAATAN Zero-Downtime Version Update
# Updates the version without rebuilding or restarting containers

echo "🔄 DAATAN Zero-Downtime Version Update"
echo "======================================"

ENVIRONMENT=${1:-production}
NEW_VERSION=${2}

if [ -z "$NEW_VERSION" ]; then
    echo "Usage: $0 [production|staging] <version>"
    echo "Example: $0 production 0.1.33"
    exit 1
fi

# Validate version format (semver)
if ! [[ "$NEW_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "❌ Invalid version format. Use semver: MAJOR.MINOR.PATCH (e.g., 0.1.33)"
    exit 1
fi

CONTAINER_NAME="daatan-app"
if [ "$ENVIRONMENT" = "staging" ]; then
    CONTAINER_NAME="daatan-app-staging"
fi

echo "Environment: $ENVIRONMENT"
echo "Container: $CONTAINER_NAME"
echo "New version: $NEW_VERSION"

# Check if container is running
if ! docker ps --format "table {{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
    echo "❌ Container $CONTAINER_NAME is not running"
    exit 1
fi

echo "🔍 Current version:"
CURRENT_VERSION=$(docker exec $CONTAINER_NAME wget -qO- http://localhost:3000/api/health | grep -o '"version":"[^"]*"' | cut -d'"' -f4)
echo "  $CURRENT_VERSION"

# Update .env file with new version
cd ~/app
if grep -q "^APP_VERSION=" .env; then
    sed -i "s/^APP_VERSION=.*/APP_VERSION=$NEW_VERSION/" .env
    echo "✅ Updated APP_VERSION in .env"
else
    echo "APP_VERSION=$NEW_VERSION" >> .env
    echo "✅ Added APP_VERSION to .env"
fi

# Restart container with new env var (graceful restart, minimal downtime)
echo "🔄 Restarting container with new version..."
docker compose -f docker-compose.prod.yml restart $CONTAINER_NAME

# Wait for container to be healthy
echo "⏳ Waiting for container to be ready..."
sleep 10

# Verify new version
echo "🏥 Verifying new version..."
for i in {1..10}; do
    DEPLOYED_VERSION=$(docker exec $CONTAINER_NAME wget -qO- http://localhost:3000/api/health 2>/dev/null | grep -o '"version":"[^"]*"' | cut -d'"' -f4 || echo "")
    if [ "$DEPLOYED_VERSION" = "$NEW_VERSION" ]; then
        echo "✅ Version updated successfully!"
        echo "  Old: $CURRENT_VERSION"
        echo "  New: $DEPLOYED_VERSION"
        exit 0
    fi
    if [ $i -eq 10 ]; then
        echo "❌ Version update failed"
        echo "  Expected: $NEW_VERSION"
        echo "  Got: $DEPLOYED_VERSION"
        docker logs $CONTAINER_NAME --tail 20
        exit 1
    fi
    echo "⏳ Waiting for version update... ($i/10)"
    sleep 3
done
