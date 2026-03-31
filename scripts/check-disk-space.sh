#!/bin/bash
#
# DAATAN Disk Space Watchdog
# Checks disk usage and alerts Telegram if above threshold
#

set -e

THRESHOLD=90
ENVIRONMENT=${1:-staging}
INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id || echo "unknown-instance")

# Get usage of root partition
USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')

echo "Disk usage: $USAGE% (Threshold: $THRESHOLD%)"

if [ "$USAGE" -gt "$THRESHOLD" ]; then
    echo "⚠️ Disk usage high! Sending Telegram alert..."
    
    # We use direct curl here because this script runs on the server where we might
    # not have the full Node.js environment easily available for a simple check.
    # The environment variables should be available if sourced.
    
    if [ -f .env ]; then
        source .env
    fi
    
    if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_CHAT_ID" ]; then
        MESSAGE="💾 <b>[$ENVIRONMENT] Critical: Disk Space Low</b>%0AInstance: <code>$INSTANCE_ID</code>%0AUsage: <b>$USAGE%</b> (Threshold: $THRESHOLD%)%0AImmediate action required!"
        
        curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
            -d "chat_id=$TELEGRAM_CHAT_ID" \
            -d "text=$MESSAGE" \
            -d "parse_mode=HTML" > /dev/null
            
        echo "✅ Alert sent to Telegram"
    else
        echo "❌ Telegram not configured (missing env vars)"
        exit 1
    fi
else
    echo "✅ Disk space OK"
fi
