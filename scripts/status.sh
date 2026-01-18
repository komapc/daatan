#!/bin/bash
#
# DAaTAn Status Check Script
# Checks health and version of production and staging environments
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# URLs
PROD_URL="https://daatan.com"
STAGING_URL="https://staging.daatan.com"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  DAaTAn Status Check${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Function to check environment
check_environment() {
    local name=$1
    local url=$2
    local color=$3
    
    echo -e "${color}▸ $name${NC} ($url)"
    
    # Health check
    local health_response
    local http_code
    
    http_code=$(curl -s -o /dev/null -w "%{http_code}" "$url/api/health" --max-time 10 2>/dev/null || echo "000")
    
    if [ "$http_code" = "200" ]; then
        health_response=$(curl -s "$url/api/health" --max-time 10 2>/dev/null)
        echo -e "  Health:  ${GREEN}✓ OK${NC} (HTTP $http_code)"
        
        # Parse timestamp if available
        local timestamp=$(echo "$health_response" | grep -o '"timestamp":"[^"]*"' | cut -d'"' -f4 2>/dev/null || echo "")
        if [ -n "$timestamp" ]; then
            echo -e "  Time:    ${CYAN}$timestamp${NC}"
        fi
    elif [ "$http_code" = "000" ]; then
        echo -e "  Health:  ${RED}✗ UNREACHABLE${NC} (connection failed)"
    else
        echo -e "  Health:  ${YELLOW}⚠ ERROR${NC} (HTTP $http_code)"
    fi
    
    # Version check (try multiple endpoints)
    local version=""
    
    # Try /api/version endpoint
    local version_response=$(curl -s "$url/api/version" --max-time 5 2>/dev/null || echo "")
    if [ -n "$version_response" ] && [[ "$version_response" != *"404"* ]] && [[ "$version_response" != *"error"* ]]; then
        version=$(echo "$version_response" | grep -o '"version":"[^"]*"' | cut -d'"' -f4 2>/dev/null || echo "")
    fi
    
    if [ -n "$version" ]; then
        echo -e "  Version: ${GREEN}$version${NC}"
    else
        echo -e "  Version: ${YELLOW}(not available)${NC}"
    fi
    
    # Response time
    local response_time=$(curl -s -o /dev/null -w "%{time_total}" "$url" --max-time 10 2>/dev/null || echo "0")
    if [ "$response_time" != "0" ]; then
        # Convert to milliseconds
        local ms=$(echo "$response_time * 1000" | bc 2>/dev/null | cut -d'.' -f1 || echo "$response_time")
        echo -e "  Latency: ${CYAN}${ms}ms${NC}"
    fi
    
    echo ""
}

# Check Production
check_environment "PRODUCTION" "$PROD_URL" "$GREEN"

# Check Staging
check_environment "STAGING" "$STAGING_URL" "$YELLOW"

# Git info
echo -e "${BLUE}▸ Local Repository${NC}"
cd "$(dirname "$0")/.." 2>/dev/null || cd ~/projects/daatan 2>/dev/null || true

if git rev-parse --git-dir > /dev/null 2>&1; then
    local_branch=$(git branch --show-current 2>/dev/null || echo "unknown")
    local_commit=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    latest_tag=$(git describe --tags --abbrev=0 2>/dev/null || echo "no tags")
    
    echo -e "  Branch:  ${CYAN}$local_branch${NC}"
    echo -e "  Commit:  ${CYAN}$local_commit${NC}"
    echo -e "  Tag:     ${GREEN}$latest_tag${NC}"
    
    # Check if there are uncommitted changes
    if ! git diff-index --quiet HEAD -- 2>/dev/null; then
        echo -e "  Status:  ${YELLOW}uncommitted changes${NC}"
    else
        echo -e "  Status:  ${GREEN}clean${NC}"
    fi
else
    echo -e "  ${YELLOW}Not in a git repository${NC}"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Quick summary
prod_status=$(curl -s -o /dev/null -w "%{http_code}" "$PROD_URL/api/health" --max-time 5 2>/dev/null || echo "000")
staging_status=$(curl -s -o /dev/null -w "%{http_code}" "$STAGING_URL/api/health" --max-time 5 2>/dev/null || echo "000")

if [ "$prod_status" = "200" ] && [ "$staging_status" = "200" ]; then
    echo -e "${GREEN}✓ All systems operational${NC}"
elif [ "$prod_status" = "200" ]; then
    echo -e "${YELLOW}⚠ Production OK, Staging has issues${NC}"
elif [ "$staging_status" = "200" ]; then
    echo -e "${RED}✗ Production DOWN, Staging OK${NC}"
else
    echo -e "${RED}✗ Both environments have issues${NC}"
fi

