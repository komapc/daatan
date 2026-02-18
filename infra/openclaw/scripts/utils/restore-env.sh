#!/bin/bash
# Restore OpenClaw .env file from backup
# Usage: ./scripts/utils/restore-env.sh [--local FILE] [--s3] [--bucket NAME] [--latest]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OPENCLAW_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$OPENCLAW_DIR/.env"
BACKUP_DIR="$OPENCLAW_DIR/backups"

# =============================================================================
# Configuration
# =============================================================================

RESTORE_FROM="local"
BACKUP_FILE=""
S3_BUCKET="daatan-openclaw-backups"
USE_LATEST=false

# =============================================================================
# Parse Arguments
# =============================================================================

while [[ $# -gt 0 ]]; do
    case $1 in
        --local)
            RESTORE_FROM="local"
            BACKUP_FILE="$2"
            shift 2
            ;;
        --s3)
            RESTORE_FROM="s3"
            shift
            ;;
        --bucket)
            S3_BUCKET="$2"
            shift 2
            ;;
        --latest)
            USE_LATEST=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [--local FILE] [--s3] [--bucket NAME] [--latest]"
            echo ""
            echo "Options:"
            echo "  --local FILE   Restore from local backup file"
            echo "  --s3           Restore from S3 bucket"
            echo "  --bucket NAME  S3 bucket name (default: daatan-openclaw-backups)"
            echo "  --latest       Use latest backup (auto for --s3, optional for --local)"
            echo "  -h, --help     Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0 --latest"
            echo "  $0 --local $BACKUP_DIR/env_20260218_120000.bak"
            echo "  $0 --s3 --latest"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# =============================================================================
# Restore Functions
# =============================================================================

find_latest_local() {
    if [[ ! -d "$BACKUP_DIR" ]]; then
        echo "❌ Backup directory not found: $BACKUP_DIR"
        exit 1
    fi
    
    local latest
    latest=$(ls -1t "$BACKUP_DIR"/env_*.bak 2>/dev/null | head -1)
    
    if [[ -z "$latest" ]]; then
        echo "❌ No local backups found"
        exit 1
    fi
    
    echo "$latest"
}

find_latest_s3() {
    if ! command -v aws &> /dev/null; then
        echo "❌ AWS CLI not found"
        exit 1
    fi
    
    local latest
    latest=$(aws s3 ls "s3://$S3_BUCKET/env/" --recursive 2>/dev/null | sort | tail -1 | awk '{print $4}')
    
    if [[ -z "$latest" ]]; then
        echo "❌ No S3 backups found in bucket: $S3_BUCKET"
        exit 1
    fi
    
    echo "$latest"
}

restore_local() {
    local backup_file="$1"
    
    echo "Restoring from local backup..."
    echo "Source: $backup_file"
    echo "Destination: $ENV_FILE"
    
    if [[ ! -f "$backup_file" ]]; then
        echo "❌ Backup file not found: $backup_file"
        exit 1
    fi
    
    # Backup current .env if it exists
    if [[ -f "$ENV_FILE" ]]; then
        local timestamp
        timestamp=$(date +%Y%m%d_%H%M%S)
        local backup_current="$ENV_FILE.$timestamp.bak"
        cp "$ENV_FILE" "$backup_current"
        echo "Current .env backed up to: $backup_current"
    fi
    
    cp "$backup_file" "$ENV_FILE"
    chmod 600 "$ENV_FILE"
    
    echo "✓ Environment restored from local backup"
}

restore_s3() {
    local s3_key="$1"
    
    echo "Restoring from S3 backup..."
    echo "Source: s3://$S3_BUCKET/$s3_key"
    echo "Destination: $ENV_FILE"
    
    if ! command -v aws &> /dev/null; then
        echo "❌ AWS CLI not found"
        exit 1
    fi
    
    # Backup current .env if it exists
    if [[ -f "$ENV_FILE" ]]; then
        local timestamp
        timestamp=$(date +%Y%m%d_%H%M%S)
        local backup_current="$ENV_FILE.$timestamp.bak"
        cp "$ENV_FILE" "$backup_current"
        echo "Current .env backed up to: $backup_current"
    fi
    
    aws s3 cp "s3://$S3_BUCKET/$s3_key" "$ENV_FILE" || {
        echo "❌ S3 restore failed"
        exit 1
    }
    
    chmod 600 "$ENV_FILE"
    
    echo "✓ Environment restored from S3 backup"
}

list_local_backups() {
    echo "Available local backups:"
    echo ""
    if [[ -d "$BACKUP_DIR" ]]; then
        ls -lht "$BACKUP_DIR"/env_*.bak 2>/dev/null | head -10
    else
        echo "  (none)"
    fi
    echo ""
}

list_s3_backups() {
    echo "Available S3 backups in s3://$S3_BUCKET/env/:"
    echo ""
    if command -v aws &> /dev/null; then
        aws s3 ls "s3://$S3_BUCKET/env/" --recursive 2>/dev/null | sort | tail -10
    else
        echo "  (AWS CLI not available)"
    fi
    echo ""
}

# =============================================================================
# Main
# =============================================================================

main() {
    echo "OpenClaw Environment Restore"
    echo "============================"
    echo ""
    
    case "$RESTORE_FROM" in
        local)
            if [[ "$USE_LATEST" == "true" ]]; then
                BACKUP_FILE=$(find_latest_local)
            fi
            
            if [[ -z "$BACKUP_FILE" ]]; then
                list_local_backups
                echo "Specify a backup file with --local FILE or use --latest"
                exit 1
            fi
            
            restore_local "$BACKUP_FILE"
            ;;
        s3)
            if [[ "$USE_LATEST" == "true" ]]; then
                BACKUP_FILE=$(find_latest_s3)
            fi
            
            if [[ -z "$BACKUP_FILE" ]]; then
                list_s3_backups
                echo "Specify a backup key with --s3 KEY or use --latest"
                exit 1
            fi
            
            restore_s3 "$BACKUP_FILE"
            ;;
        *)
            echo "❌ Unknown restore source: $RESTORE_FROM"
            exit 1
            ;;
    esac
    
    echo ""
    echo "Restore complete!"
    echo ""
    echo "Verify with:"
    echo "  ./scripts/setup/validate-env.sh"
}

# Run main function
main "$@"
