#!/bin/bash
#
# DAaTAn Log Inspection Script (server-only)
# Checks Docker container logs for known error patterns (OAuth, auth issues).
# Must be run on the EC2 instance where Docker containers are running.
#
# Usage: ./scripts/verify-logs.sh <environment>
#   e.g. ./scripts/verify-logs.sh staging
#   e.g. ./scripts/verify-logs.sh production

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ENVIRONMENT=${1:-staging}

if [ "$ENVIRONMENT" = "production" ]; then
    CONTAINER_NAME="daatan-app"
elif [ "$ENVIRONMENT" = "staging" ]; then
    CONTAINER_NAME="daatan-app-staging"
else
    echo -e "${RED}Usage: $0 <staging|production>${NC}"
    exit 1
fi

echo "🔍 Checking $ENVIRONMENT container logs for known errors..."

# Verify the container exists and is running
if ! docker inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Container '$CONTAINER_NAME' not found — skipping log inspection.${NC}"
    exit 0
fi

HAS_WARNINGS=false

# Check last 50 lines for specific error codes
if docker logs "$CONTAINER_NAME" --tail 50 2>&1 | grep -q "OAUTH_CALLBACK_ERROR"; then
    echo -e "${YELLOW}⚠️  WARNING: Detected OAuth callback errors in logs!${NC}"
    echo "   Possible cause: Invalid Google Client Secret or Redirect URI mismatch."
    docker logs "$CONTAINER_NAME" --tail 10 2>&1 | grep "OAUTH_CALLBACK_ERROR" || true
    HAS_WARNINGS=true
fi

if docker logs "$CONTAINER_NAME" --tail 50 2>&1 | grep -q "invalid_client"; then
    echo -e "${YELLOW}⚠️  WARNING: Detected 'invalid_client' errors in logs!${NC}"
    echo "   Possible cause: Incorrect Google Client ID or Client Secret."
    docker logs "$CONTAINER_NAME" --tail 10 2>&1 | grep "invalid_client" || true
    HAS_WARNINGS=true
fi

if [ "$HAS_WARNINGS" = true ]; then
    echo -e "${YELLOW}⚠️  Log inspection found warnings (deployment not blocked).${NC}"
else
    echo -e "${GREEN}✅ No known errors found in container logs.${NC}"
fi

# Warnings don't fail the deployment — the app is running, these are informational
exit 0
