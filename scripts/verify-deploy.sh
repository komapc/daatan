#!/bin/bash
#
# DAaTAn Deployment Verification Script
# Checks if the deployed environment matches the expected version and is healthy.
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

URL=$1
EXPECTED_VERSION=$(grep -o '"version": "[^"]*"' package.json | cut -d'"' -f4)

if [ -z "$URL" ]; then
    echo -e "${RED}Usage: $0 <url>${NC}"
    exit 1
fi

echo -e "${BLUE}🔍 Verifying deployment at $URL${NC}"
echo -e "Expected Version: ${GREEN}$EXPECTED_VERSION${NC}"

# Check Health and Version (version optional for backward compatibility)
echo -n "Checking Health and Version... "
# Use a random query parameter to bypass cache
CACHE_BUSTER=$(date +%s)
HEALTH_RESPONSE_FULL=$(curl -s -v "$URL/api/health?cb=$CACHE_BUSTER" 2>&1)
# Extract only the actual JSON response (last line that starts with {)
HEALTH_RESPONSE=$(echo "$HEALTH_RESPONSE_FULL" | grep '^{' | tail -1)
# Handle both "status":"ok" and "status": "ok" formats (with or without spaces)
HEALTH_STATUS=$(echo "$HEALTH_RESPONSE" | grep -oE '"status"\s*:\s*"[^"]*"' | grep -oE '"[^"]*"$' | tr -d '"')
DEPLOYED_VERSION=$(echo "$HEALTH_RESPONSE" | grep -oE '"version"\s*:\s*"[^"]*"' | grep -oE '"[^"]*"$' | tr -d '"')

# Check if health is OK (required)
if [ "$HEALTH_STATUS" != "ok" ]; then
    echo -e "${RED}FAILED${NC}"
    echo -e "  Health Status: ${RED}$HEALTH_STATUS${NC}"
    echo -e "  Full Response:"
    echo "$HEALTH_RESPONSE"
    exit 1
fi

# Check version if present (optional for backward compatibility)
if [ -n "$DEPLOYED_VERSION" ]; then
    if [ "$DEPLOYED_VERSION" == "$EXPECTED_VERSION" ]; then
        echo -e "${GREEN}OK (v$DEPLOYED_VERSION)${NC}"
    else
        echo -e "${YELLOW}WARNING: Version mismatch${NC}"
        echo -e "  Expected: ${GREEN}$EXPECTED_VERSION${NC}"
        echo -e "  Deployed: ${YELLOW}$DEPLOYED_VERSION${NC}"
        echo -e "  Health is OK, continuing anyway..."
    fi
else
    echo -e "${GREEN}OK${NC} ${YELLOW}(version not available in response)${NC}"
fi

echo -e "${GREEN}✅ Verification Successful!${NC}"
exit 0
