#!/bin/bash
#
# DAaTAn Deployment Verification (wrapper)
# Runs both health check and log inspection. Intended for use on the server
# where Docker containers are available. For CI-only use, call verify-health.sh directly.
#
# Usage: ./scripts/verify-deploy.sh <url> [environment]
#   e.g. ./scripts/verify-deploy.sh https://staging.daatan.com staging
#   e.g. ./scripts/verify-deploy.sh https://daatan.com production
#
# If environment is omitted, it's inferred from the URL.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

URL=$1
ENVIRONMENT=$2

if [ -z "$URL" ]; then
    echo "Usage: $0 <url> [staging|production]"
    exit 1
fi

# Infer environment from URL if not provided
if [ -z "$ENVIRONMENT" ]; then
    if [[ "$URL" == *"staging"* ]]; then
        ENVIRONMENT="staging"
    else
        ENVIRONMENT="production"
    fi
fi

# 1. HTTP health check (CI-safe, always runs)
"$SCRIPT_DIR/verify-health.sh" "$URL"

# 2. Docker log inspection (server-only, non-fatal if containers don't exist)
"$SCRIPT_DIR/verify-logs.sh" "$ENVIRONMENT"
