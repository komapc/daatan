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

# Check Health
echo -n "Checking Health... "
HEALTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$URL/api/health")

if [ "$HEALTH_CODE" == "200" ]; then
    echo -e "${GREEN}OK (200)${NC}"
else
    echo -e "${RED}FAILED ($HEALTH_CODE)${NC}"
    exit 1
fi

# Check Version
echo -n "Checking Version... "
VERSION_RESPONSE=$(curl -s "$URL/api/system-version")
DEPLOYED_VERSION=$(echo "$VERSION_RESPONSE" | grep -o '"version":"[^"]*"' | cut -d'"' -f4)

if [ "$DEPLOYED_VERSION" == "$EXPECTED_VERSION" ]; then
    echo -e "${GREEN}MATCH ($DEPLOYED_VERSION)${NC}"
else
    echo -e "${RED}MISMATCH${NC}"
    echo -e "  Expected: ${GREEN}$EXPECTED_VERSION${NC}"
    echo -e "  Deployed: ${RED}$DEPLOYED_VERSION${NC}"
    echo -e "  Response: $VERSION_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✅ Verification Successful!${NC}"
exit 0
