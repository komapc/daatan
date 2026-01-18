#!/bin/bash
#
# DAaTAn Quick Health Check
# Simple up/down check for production and staging
#

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

check_url() {
    local name=$1
    local url=$2
    local code=$(curl -s -o /dev/null -w "%{http_code}" "$url/api/health" --max-time 5 2>/dev/null || echo "000")
    
    if [ "$code" = "200" ]; then
        echo -e "${GREEN}✓${NC} $name"
    elif [ "$code" = "000" ]; then
        echo -e "${RED}✗${NC} $name (unreachable)"
    else
        echo -e "${YELLOW}⚠${NC} $name (HTTP $code)"
    fi
}

echo "DAaTAn Health Check"
echo "-------------------"
check_url "Production " "https://daatan.com"
check_url "Staging    " "https://staging.daatan.com"

