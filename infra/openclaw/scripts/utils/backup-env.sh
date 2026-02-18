#!/bin/bash
# Backup OpenClaw .env file
# Usage: ./scripts/utils/backup-env.sh [--local] [--s3] [--bucket NAME]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OPENCLAW_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$OPENCLAW_DIR/.env"

# =============================================================================
# Configuration
# =============================================================================

BACKUP_LOCAL=true
BACKUP_S3=false
S3_BUCKET="daatan-openclaw-backups"

# =============================================================================
# Parse Arguments
# =============================================================================

while [[ $# -gt 0 ]]; do
    case $1 in
        --local)
            BACKUP_LOCAL=true
            shift
            ;;
        --s3)
            BACKUP_S3=true
            shift
            ;;
        --bucket)
            S3_BUCKET="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [--local] [--s3] [--bucket NAME]"
            echo ""
            echo "Options:"
            echo "  --local        Backup to local backups/ directory (default)"
            echo "  --s3           Backup to S3 bucket"
            echo "  --bucket NAME  S3 bucket name (default: daatan-openclaw-backups)"
            echo "  -h, --help     Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# =============================================================================
# Backup Functions
# =============================================================================

backup_local() {
    local backup_dir="$OPENCLAW_DIR/backups"
    local timestamp
    timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$backup_dir/env_$timestamp.bak"
    
    echo "Creating local backup..."
    
    mkdir -p "$backup_dir"
    cp "$ENV_FILE" "$backup_file"
    chmod 600 "$backup_file"
    
    echo "✓ Local backup created: $backup_file"
    
    # Keep only last 10 backups
    local backup_count
    backup_count=$(ls -1 "$backup_dir"/env_*.bak 2>/dev/null | wc -l)
    if [[ $backup_count -gt 10 ]]; then
        echo "Cleaning up old backups (keeping last 10)..."
        ls -1t "$backup_dir"/env_*.bak | tail -n +11 | xargs rm -f
    fi
}

backup_s3() {
    local key="env/$(date +%Y/%m/%d)/env_$(date +%H%M%S).bak"
    
    echo "Creating S3 backup..."
    echo "Bucket: $S3_BUCKET"
    echo "Key: $key"
    
    if ! command -v aws &> /dev/null; then
        echo "❌ AWS CLI not found. Install with: pip install awscli"
        exit 1
    fi
    
    aws s3 cp "$ENV_FILE" "s3://$S3_BUCKET/$key" --sse AES256 || {
        echo "❌ S3 backup failed"
        exit 1
    }
    
    echo "✓ S3 backup created: s3://$S3_BUCKET/$key"
}

# =============================================================================
# Main
# =============================================================================

main() {
    echo "OpenClaw Environment Backup"
    echo "==========================="
    echo ""
    
    if [[ ! -f "$ENV_FILE" ]]; then
        echo "❌ Environment file not found: $ENV_FILE"
        exit 1
    fi
    
    if [[ "$BACKUP_LOCAL" == "true" ]]; then
        backup_local
    fi
    
    if [[ "$BACKUP_S3" == "true" ]]; then
        backup_s3
    fi
    
    echo ""
    echo "Backup complete!"
}

# Run main function
main "$@"
