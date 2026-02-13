#!/bin/bash
#
# DAaTAn Deployment Verification Script
# Checks if the deployed environment is healthy and reports version/commit info.
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

URL=$1

if [ -z "$URL" ]; then
    echo -e "${RED}Usage: $0 <url>${NC}"
    exit 1
fi

# Check for login errors in recent logs
echo "🔍 Checking logs for authentication errors..."
CONTAINER_NAME="daatan-app-staging"
if [[ "$URL" == *"daatan.com"* && "$URL" != *"staging"* ]]; then
    CONTAINER_NAME="daatan-app"
fi

# Check last 50 lines for specific error codes
if docker logs "$CONTAINER_NAME" --tail 50 2>&1 | grep -q "OAUTH_CALLBACK_ERROR"; then
    echo "⚠️  WARNING: Detected OAuth callback errors in logs!"
    echo "   Possible cause: Invalid Google Client Secret or Redirect URI mismatch."
    docker logs "$CONTAINER_NAME" --tail 10 2>&1 | grep "OAUTH_CALLBACK_ERROR"
    # We don't fail the deployment for this (app is running), but we warn loudly
fi
if docker logs "$CONTAINER_NAME" --tail 50 2>&1 | grep -q "invalid_client"; then
    echo "⚠️  WARNING: Detected 'invalid_client' errors in logs!"
    echo "   Possible cause: Incorrect Google Client ID or Client Secret."
    docker logs "$CONTAINER_NAME" --tail 10 2>&1 | grep "invalid_client"
    # We don't fail the deployment for this (app is running), but we warn loudly
fi

echo -e "${BLUE}🔍 Verifying deployment at $URL${NC}"

# Check Health and Version
echo -n "Checking Health... "
# Use a random query parameter to bypass cache
CACHE_BUSTER=$(date +%s)
HEALTH_RESPONSE_FULL=$(curl -s -v "$URL/api/health?cb=$CACHE_BUSTER" 2>&1)
# Extract only the actual JSON response (last line that starts with {)
HEALTH_RESPONSE=$(echo "$HEALTH_RESPONSE_FULL" | grep '^{' | tail -1)
# Handle both "status":"ok" and "status": "ok" formats (with or without spaces)
HEALTH_STATUS=$(echo "$HEALTH_RESPONSE" | grep -oE '"status"\s*:\s*"[^"]*"' | tail -1 | sed 's/.*"\([^"]*\)"$/\1/')
DEPLOYED_VERSION=$(echo "$HEALTH_RESPONSE" | grep -oE '"version"\s*:\s*"[^"]*"' | tail -1 | sed 's/.*"\([^"]*\)"$/\1/')
DEPLOYED_COMMIT=$(echo "$HEALTH_RESPONSE" | grep -oE '"commit"\s*:\s*"[^"]*"' | tail -1 | sed 's/.*"\([^"]*\)"$/\1/')

# Check if health is OK (required)
if [ "$HEALTH_STATUS" != "ok" ]; then
    echo -e "${RED}FAILED${NC}"
    echo -e "  Health Status: ${RED}$HEALTH_STATUS${NC}"
    echo -e "  Full Response:"
    echo "$HEALTH_RESPONSE"
    exit 1
fi

echo -e "${GREEN}OK${NC}"

# Report deployed version and commit (informational only)
if [ -n "$DEPLOYED_VERSION" ]; then
    echo -e "  Version: ${GREEN}$DEPLOYED_VERSION${NC}"
fi
if [ -n "$DEPLOYED_COMMIT" ]; then
    echo -e "  Commit:  ${GREEN}${DEPLOYED_COMMIT:0:8}${NC}"
fi

echo -e "${GREEN}✅ Verification Successful!${NC}"
exit 0
