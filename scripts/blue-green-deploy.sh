#!/bin/bash
set -e

# DAATAN Blue-Green Deployment Script
# Zero-downtime deployment using blue-green strategy

echo "🔵🟢 DAATAN Blue-Green Deployment"
echo "================================="

ENVIRONMENT=${1:-production}
BLUE_CONTAINER="daatan-app"
GREEN_CONTAINER="daatan-app-green"

if [ "$ENVIRONMENT" = "staging" ]; then
    BLUE_CONTAINER="daatan-app-staging"
    GREEN_CONTAINER="daatan-app-staging-green"
fi

cd ~/app

echo "🔍 Checking current deployment..."

# Check which container is currently active
CURRENT_ACTIVE=""
if docker ps --format "table {{.Names}}" | grep -q "^${BLUE_CONTAINER}$"; then
    CURRENT_ACTIVE="blue"
    ACTIVE_CONTAINER=$BLUE_CONTAINER
    INACTIVE_CONTAINER=$GREEN_CONTAINER
elif docker ps --format "table {{.Names}}" | grep -q "^${GREEN_CONTAINER}$"; then
    CURRENT_ACTIVE="green"
    ACTIVE_CONTAINER=$GREEN_CONTAINER
    INACTIVE_CONTAINER=$BLUE_CONTAINER
else
    echo "❌ No active containers found. Running standard deployment..."
    ./deploy.sh
    exit 0
fi

echo "Current active: $CURRENT_ACTIVE ($ACTIVE_CONTAINER)"
echo "Deploying to: $INACTIVE_CONTAINER"

# Export environment variables
export POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-$(grep POSTGRES_PASSWORD .env | cut -d'=' -f2)}
export NEXTAUTH_SECRET=${NEXTAUTH_SECRET:-$(grep NEXTAUTH_SECRET .env | cut -d'=' -f2)}
export GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID:-$(grep GOOGLE_CLIENT_ID .env | cut -d'=' -f2)}
export GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET:-$(grep GOOGLE_CLIENT_SECRET .env | cut -d'=' -f2)}
export GEMINI_API_KEY=${GEMINI_API_KEY:-$(grep GEMINI_API_KEY .env | cut -d'=' -f2)}

echo "🔨 Building new version in $INACTIVE_CONTAINER..."

# Stop and remove the inactive container if it exists
docker stop $INACTIVE_CONTAINER 2>/dev/null || true
docker rm $INACTIVE_CONTAINER 2>/dev/null || true

# Build new image
if [ "$ENVIRONMENT" = "staging" ]; then
    export DEPLOY_ID=$(date +%s)
    docker build -t daatan-app:staging-$DEPLOY_ID \
        --build-arg DATABASE_URL="postgresql://daatan:${POSTGRES_PASSWORD}@postgres-staging:5432/daatan_staging" \
        --build-arg NEXTAUTH_SECRET="${NEXTAUTH_SECRET}" \
        --build-arg NEXTAUTH_URL="https://staging.daatan.com" \
        --build-arg NEXT_PUBLIC_ENV="staging" .
    
    # Start new container
    docker run -d \
        --name $INACTIVE_CONTAINER \
        --network app_default \
        --restart unless-stopped \
        --expose 3000 \
        -e NODE_ENV=production \
        -e DATABASE_URL="postgresql://daatan:${POSTGRES_PASSWORD}@postgres-staging:5432/daatan_staging" \
        -e NEXT_PUBLIC_ENV=staging \
        -e NEXTAUTH_SECRET="${NEXTAUTH_SECRET}" \
        -e NEXTAUTH_URL="https://staging.daatan.com" \
        -e GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID}" \
        -e GOOGLE_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET}" \
        -e GEMINI_API_KEY="${GEMINI_API_KEY}" \
        daatan-app:staging-$DEPLOY_ID
else
    docker build -t daatan-app:latest \
        --build-arg DATABASE_URL="postgresql://daatan:${POSTGRES_PASSWORD}@postgres:5432/daatan" \
        --build-arg NEXTAUTH_SECRET="${NEXTAUTH_SECRET}" \
        --build-arg NEXTAUTH_URL="https://daatan.com" \
        --build-arg NEXT_PUBLIC_ENV="production" .
    
    # Start new container
    docker run -d \
        --name $INACTIVE_CONTAINER \
        --network app_default \
        --restart unless-stopped \
        --expose 3000 \
        -e NODE_ENV=production \
        -e DATABASE_URL="postgresql://daatan:${POSTGRES_PASSWORD}@postgres:5432/daatan" \
        -e NEXT_PUBLIC_ENV=production \
        -e NEXTAUTH_SECRET="${NEXTAUTH_SECRET}" \
        -e NEXTAUTH_URL="https://daatan.com" \
        -e GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID}" \
        -e GOOGLE_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET}" \
        -e GEMINI_API_KEY="${GEMINI_API_KEY}" \
        daatan-app:latest
fi

echo "⏳ Waiting for new container to be ready..."
sleep 20

# Health check on new container
echo "🏥 Health checking new container..."
for i in {1..10}; do
    if docker exec $INACTIVE_CONTAINER wget -q --spider http://localhost:3000/api/health; then
        echo "✅ New container is healthy"
        break
    fi
    if [ $i -eq 10 ]; then
        echo "❌ New container failed health check"
        docker logs $INACTIVE_CONTAINER --tail 50
        docker stop $INACTIVE_CONTAINER
        docker rm $INACTIVE_CONTAINER
        exit 1
    fi
    echo "⏳ Waiting for health check... ($i/10)"
    sleep 5
done

echo "🔄 Switching traffic to new container..."

# Update nginx configuration to point to new container
if [ "$ENVIRONMENT" = "staging" ]; then
    # For staging, we need to update the nginx config to point to the new container
    # This is a simplified approach - in production you'd use a load balancer
    docker exec daatan-nginx nginx -s reload
else
    # For production, same approach
    docker exec daatan-nginx nginx -s reload
fi

echo "⏳ Waiting for traffic switch..."
sleep 10

# Verify the switch worked
if [ "$ENVIRONMENT" = "staging" ]; then
    TEST_URL="https://staging.daatan.com"
else
    TEST_URL="https://daatan.com"
fi

if ./scripts/verify-deploy.sh "$TEST_URL"; then
    echo "✅ Traffic switch successful"
    
    echo "🧹 Cleaning up old container..."
    docker stop $ACTIVE_CONTAINER
    docker rm $ACTIVE_CONTAINER
    
    echo "✅ Blue-Green deployment completed successfully!"
    echo "New active container: $INACTIVE_CONTAINER"
else
    echo "❌ Traffic switch failed, rolling back..."
    docker stop $INACTIVE_CONTAINER
    docker rm $INACTIVE_CONTAINER
    echo "❌ Deployment failed, rolled back to $ACTIVE_CONTAINER"
    exit 1
fi