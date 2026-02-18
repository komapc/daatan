#!/bin/bash
# Manage OpenClaw secrets in AWS Secrets Manager
# Usage: ./scripts/utils/secrets.sh [get|set|list|delete] <secret-name> [value]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OPENCLAW_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# =============================================================================
# Configuration
# =============================================================================

readonly SECRET_PREFIX="openclaw"
readonly AWS_REGION="${AWS_REGION:-eu-central-1}"

# Secret names
readonly SECRET_GEMINI="$SECRET_PREFIX/gemini-api-key"
readonly SECRET_OPENROUTER="$SECRET_PREFIX/openrouter-api-key"
readonly SECRET_TELEGRAM_DAATAN="$SECRET_PREFIX/telegram-bot-token-daatan"
readonly SECRET_TELEGRAM_CALENDAR="$SECRET_PREFIX/telegram-bot-token-calendar"
readonly SECRET_ANTHROPIC="$SECRET_PREFIX/anthropic-api-key"

# =============================================================================
# Colors
# =============================================================================

readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

# =============================================================================
# Helper Functions
# =============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $*"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $*"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $*"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*" >&2
}

check_aws() {
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI not found. Install: pip install awscli"
        exit 1
    fi
    
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials not configured. Run: aws configure"
        exit 1
    fi
}

# =============================================================================
# Secret Management Functions
# =============================================================================

secret_exists() {
    local secret_name="$1"
    aws secretsmanager describe-secret --secret-id "$secret_name" --region "$AWS_REGION" &> /dev/null
}

create_or_update_secret() {
    local secret_name="$1"
    local secret_value="$2"
    local description="${3:-OpenClaw secret}"
    
    if secret_exists "$secret_name"; then
        log_info "Updating secret: $secret_name"
        aws secretsmanager update-secret \
            --secret-id "$secret_name" \
            --secret-string "$secret_value" \
            --region "$AWS_REGION"
    else
        log_info "Creating secret: $secret_name"
        aws secretsmanager create-secret \
            --name "$secret_name" \
            --description "$description" \
            --secret-string "$secret_value" \
            --region "$AWS_REGION"
    fi
}

get_secret() {
    local secret_name="$1"
    aws secretsmanager get-secret-value \
        --secret-id "$secret_name" \
        --query SecretString \
        --output text \
        --region "$AWS_REGION" 2>/dev/null
}

delete_secret() {
    local secret_name="$1"
    local force="${2:-false}"
    
    if [[ "$force" == "true" ]]; then
        aws secretsmanager delete-secret \
            --secret-id "$secret_name" \
            --force-delete-without-recovery \
            --region "$AWS_REGION"
    else
        aws secretsmanager delete-secret \
            --secret-id "$secret_name" \
            --recovery-window-in-days 7 \
            --region "$AWS_REGION"
    fi
}

list_secrets() {
    log_info "OpenClaw secrets in AWS Secrets Manager ($AWS_REGION):"
    echo ""
    aws secretsmanager list-secrets \
        --filters "Key=name,Values=$SECRET_PREFIX" \
        --query 'SecretList[*].[Name,LastChangedDate]' \
        --output table \
        --region "$AWS_REGION"
}

# =============================================================================
# .env Integration
# =============================================================================

generate_env_from_secrets() {
    local output_file="${1:-$OPENCLAW_DIR/.env}"
    local template_file="$OPENCLAW_DIR/.env.example"
    
    log_info "Generating .env from AWS Secrets Manager..."
    
    # Start with template (without secrets)
    if [[ -f "$template_file" ]]; then
        # Remove any existing secret values from template
        grep -v "^GEMINI_API_KEY=" \
        | grep -v "^OPENROUTER_API_KEY=" \
        | grep -v "^ANTHROPIC_API_KEY=" \
        | grep -v "^TELEGRAM_BOT_TOKEN_DAATAN=" \
        | grep -v "^TELEGRAM_BOT_TOKEN_CALENDAR=" \
        < "$template_file" > "$output_file.tmp"
    else
        touch "$output_file.tmp"
    fi
    
    # Add secrets
    {
        cat "$output_file.tmp"
        echo ""
        echo "# Secrets from AWS Secrets Manager"
        
        local gemini_key
        gemini_key=$(get_secret "$SECRET_GEMINI" 2>/dev/null || echo "")
        if [[ -n "$gemini_key" ]]; then
            echo "GEMINI_API_KEY=$gemini_key"
        else
            echo "# GEMINI_API_KEY= (not found in Secrets Manager)"
        fi
        
        local openrouter_key
        openrouter_key=$(get_secret "$SECRET_OPENROUTER" 2>/dev/null || echo "")
        if [[ -n "$openrouter_key" ]]; then
            echo "OPENROUTER_API_KEY=$openrouter_key"
        else
            echo "# OPENROUTER_API_KEY= (not found in Secrets Manager)"
        fi
        
        local anthropic_key
        anthropic_key=$(get_secret "$SECRET_ANTHROPIC" 2>/dev/null || echo "")
        if [[ -n "$anthropic_key" ]]; then
            echo "ANTHROPIC_API_KEY=$anthropic_key"
        else
            echo "# ANTHROPIC_API_KEY= (not found in Secrets Manager)"
        fi
        
        local telegram_daatan
        telegram_daatan=$(get_secret "$SECRET_TELEGRAM_DAATAN" 2>/dev/null || echo "")
        if [[ -n "$telegram_daatan" ]]; then
            echo "TELEGRAM_BOT_TOKEN_DAATAN=$telegram_daatan"
        else
            echo "# TELEGRAM_BOT_TOKEN_DAATAN= (not found in Secrets Manager)"
        fi
        
        local telegram_calendar
        telegram_calendar=$(get_secret "$SECRET_TELEGRAM_CALENDAR" 2>/dev/null || echo "")
        if [[ -n "$telegram_calendar" ]]; then
            echo "TELEGRAM_BOT_TOKEN_CALENDAR=$telegram_calendar"
        else
            echo "# TELEGRAM_BOT_TOKEN_CALENDAR= (not found in Secrets Manager)"
        fi
        
        # Chat ID is not a secret, keep as placeholder
        echo "TELEGRAM_CHAT_ID="
    } > "$output_file"
    
    rm -f "$output_file.tmp"
    chmod 600 "$output_file"
    
    log_success "Generated: $output_file"
}

# =============================================================================
# EC2 Integration
# =============================================================================

fetch_secrets_on_ec2() {
    local output_file="${1:-/home/ubuntu/projects/openclaw/.env}"
    
    log_info "Fetching secrets from AWS Secrets Manager..."
    
    # This runs on EC2, uses instance IAM role
    {
        echo "# OpenClaw .env (generated from AWS Secrets Manager)"
        echo "# Generated: $(date -Iseconds)"
        echo ""
        
        local gemini_key
        gemini_key=$(get_secret "$SECRET_GEMINI" 2>/dev/null || echo "")
        if [[ -n "$gemini_key" ]]; then
            echo "GEMINI_API_KEY=$gemini_key"
        fi
        
        local openrouter_key
        openrouter_key=$(get_secret "$SECRET_OPENROUTER" 2>/dev/null || echo "")
        if [[ -n "$openrouter_key" ]]; then
            echo "OPENROUTER_API_KEY=$openrouter_key"
        fi
        
        local telegram_daatan
        telegram_daatan=$(get_secret "$SECRET_TELEGRAM_DAATAN" 2>/dev/null || echo "")
        if [[ -n "$telegram_daatan" ]]; then
            echo "TELEGRAM_BOT_TOKEN_DAATAN=$telegram_daatan"
        fi
        
        local telegram_calendar
        telegram_calendar=$(get_secret "$SECRET_TELEGRAM_CALENDAR" 2>/dev/null || echo "")
        if [[ -n "$telegram_calendar" ]]; then
            echo "TELEGRAM_BOT_TOKEN_CALENDAR=$telegram_calendar"
        fi
        
        echo "TELEGRAM_CHAT_ID="
    } > "$output_file"
    
    chmod 600 "$output_file"
    log_success "Secrets fetched to: $output_file"
}

# =============================================================================
# Commands
# =============================================================================

cmd_set() {
    local secret_name="$1"
    local secret_value="$2"
    
    if [[ -z "$secret_name" || -z "$secret_value" ]]; then
        log_error "Usage: $0 set <secret-name> <value>"
        exit 1
    fi
    
    check_aws
    create_or_update_secret "$secret_name" "$secret_value"
    log_success "Secret stored: $secret_name"
}

cmd_get() {
    local secret_name="$1"
    
    if [[ -z "$secret_name" ]]; then
        log_error "Usage: $0 get <secret-name>"
        exit 1
    fi
    
    check_aws
    local value
    value=$(get_secret "$secret_name")
    
    if [[ -n "$value" ]]; then
        echo "$value"
    else
        log_error "Secret not found: $secret_name"
        exit 1
    fi
}

cmd_list() {
    check_aws
    list_secrets
}

cmd_delete() {
    local secret_name="$1"
    local force="${2:-false}"
    
    if [[ -z "$secret_name" ]]; then
        log_error "Usage: $0 delete <secret-name> [--force]"
        exit 1
    fi
    
    check_aws
    
    if [[ "$force" == "true" || "$force" == "--force" ]]; then
        log_warning "Force deleting (no recovery): $secret_name"
        delete_secret "$secret_name" true
    else
        log_info "Scheduling deletion (7-day recovery): $secret_name"
        delete_secret "$secret_name"
    fi
    
    log_success "Secret deletion scheduled: $secret_name"
}

cmd_sync() {
    local direction="${1:-to-aws}"
    
    case "$direction" in
        to-aws)
            log_info "Syncing .env to AWS Secrets Manager..."
            
            if [[ ! -f "$OPENCLAW_DIR/.env" ]]; then
                log_error ".env file not found: $OPENCLAW_DIR/.env"
                exit 1
            fi
            
            # Read .env and store each secret
            while IFS='=' read -r key value; do
                # Skip comments and empty lines
                [[ "$key" =~ ^#.*$ || -z "$key" ]] && continue
                
                case "$key" in
                    GEMINI_API_KEY)
                        create_or_update_secret "$SECRET_GEMINI" "$value" "Gemini API Key"
                        ;;
                    OPENROUTER_API_KEY)
                        create_or_update_secret "$SECRET_OPENROUTER" "$value" "OpenRouter API Key"
                        ;;
                    ANTHROPIC_API_KEY)
                        create_or_update_secret "$SECRET_ANTHROPIC" "$value" "Anthropic API Key"
                        ;;
                    TELEGRAM_BOT_TOKEN_DAATAN)
                        create_or_update_secret "$SECRET_TELEGRAM_DAATAN" "$value" "Telegram Bot Token (Daatan)"
                        ;;
                    TELEGRAM_BOT_TOKEN_CALENDAR)
                        create_or_update_secret "$SECRET_TELEGRAM_CALENDAR" "$value" "Telegram Bot Token (Calendar)"
                        ;;
                esac
            done < "$OPENCLAW_DIR/.env"
            
            log_success "Synced to AWS Secrets Manager"
            ;;
        from-aws)
            generate_env_from_secrets
            ;;
        *)
            log_error "Unknown direction: $direction (use: to-aws or from-aws)"
            exit 1
            ;;
    esac
}

cmd_init() {
    log_info "Initializing AWS Secrets Manager for OpenClaw..."
    check_aws
    
    # Store the OpenRouter key that was provided
    local openrouter_key="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"
    
    create_or_update_secret "$SECRET_OPENROUTER" "$openrouter_key" "OpenRouter API Key (Budget: \$5/month)"
    
    log_success "Initialized secrets:"
    echo ""
    list_secrets
    echo ""
    log_info "Next steps:"
    echo "  1. Set remaining secrets:"
    echo "     $0 set openclaw/gemini-api-key <your-key>"
    echo "     $0 set openclaw/telegram-bot-token-daatan <token>"
    echo "     $0 set openclaw/telegram-bot-token-calendar <token>"
    echo ""
    echo "  2. Generate .env from secrets:"
    echo "     $0 sync from-aws"
}

# =============================================================================
# Main
# =============================================================================

show_help() {
    cat << EOF
OpenClaw Secrets Manager

Usage: $0 <command> [arguments]

Commands:
  init                          Initialize secrets with default values
  set <name> <value>            Store a secret
  get <name>                    Retrieve a secret value
  list                          List all OpenClaw secrets
  delete <name> [--force]       Delete a secret
  sync to-aws                   Sync local .env to AWS Secrets Manager
  sync from-aws                 Generate .env from AWS Secrets Manager
  fetch-ec2                     Fetch secrets on EC2 instance (for user-data)

Secret Names:
  openclaw/gemini-api-key
  openclaw/openrouter-api-key
  openclaw/anthropic-api-key
  openclaw/telegram-bot-token-daatan
  openclaw/telegram-bot-token-calendar

Examples:
  $0 init
  $0 set openclaw/gemini-api-key "AIza..."
  $0 get openclaw/openrouter-api-key
  $0 sync from-aws
  $0 fetch-ec2

EOF
}

main() {
    local command="${1:-help}"
    shift || true
    
    case "$command" in
        init)
            cmd_init
            ;;
        set)
            cmd_set "$@"
            ;;
        get)
            cmd_get "$@"
            ;;
        list)
            cmd_list
            ;;
        delete)
            cmd_delete "$@"
            ;;
        sync)
            cmd_sync "$@"
            ;;
        fetch-ec2)
            fetch_secrets_on_ec2 "$@"
            ;;
        -h|--help|help)
            show_help
            ;;
        *)
            log_error "Unknown command: $command"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
