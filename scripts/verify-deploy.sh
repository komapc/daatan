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

# Check Health and Version
echo -n "Checking Health and Version... "
# Use a random query parameter to bypass cache
CACHE_BUSTER=$(date +%s)
HEALTH_RESPONSE_FULL=$(curl -s -v "$URL/api/health?cb=$CACHE_BUSTER" 2>&1)
HEALTH_RESPONSE=$(echo "$HEALTH_RESPONSE_FULL" | sed -n '/^{/p')
DEPLOYED_VERSION=$(echo "$HEALTH_RESPONSE" | grep -o '"version":"[^"]*"' | cut -d'"' -f4)
HEALTH_STATUS=$(echo "$HEALTH_RESPONSE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

if [ "$HEALTH_STATUS" == "ok" ] && [ "$DEPLOYED_VERSION" == "$EXPECTED_VERSION" ]; then
    echo -e "${GREEN}OK ($DEPLOYED_VERSION)${NC}"
else
    echo -e "${RED}FAILED${NC}"
    echo -e "  Expected Version: ${GREEN}$EXPECTED_VERSION${NC}"
    echo -e "  Deployed Version: ${RED}$DEPLOYED_VERSION${NC}"
    echo -e "  Health Status: ${RED}$HEALTH_STATUS${NC}"
    echo -e "  Full Response Log:"
    echo "$HEALTH_RESPONSE_FULL"
    exit 1
fi

echo -e "${GREEN}✅ Verification Successful!${NC}"
exit 0
