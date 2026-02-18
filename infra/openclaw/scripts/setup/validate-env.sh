#!/bin/bash
# Validate OpenClaw environment file
# Usage: ./scripts/setup/validate-env.sh [--fix]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OPENCLAW_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$OPENCLAW_DIR/.env"

# =============================================================================
# Configuration
# =============================================================================

FIX_MODE=false

# =============================================================================
# Parse Arguments
# =============================================================================

while [[ $# -gt 0 ]]; do
    case $1 in
        --fix)
            FIX_MODE=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [--fix]"
            echo ""
            echo "Options:"
            echo "  --fix    Attempt to fix common issues"
            echo "  -h, --help  Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# =============================================================================
# Validation Functions
# =============================================================================

check_file_exists() {
    if [[ ! -f "$ENV_FILE" ]]; then
        echo "❌ Environment file not found: $ENV_FILE"
        echo ""
        echo "Fix: Copy .env.example to .env"
        echo "  cp $OPENCLAW_DIR/.env.example $ENV_FILE"
        return 1
    fi
    echo "✓ Environment file exists"
    return 0
}

check_required_vars() {
    local required_vars=(
        "GEMINI_API_KEY"
        "TELEGRAM_CHAT_ID"
        "TELEGRAM_BOT_TOKEN_DAATAN"
        "TELEGRAM_BOT_TOKEN_CALENDAR"
    )
    
    local missing=()
    local empty=()
    
    for var in "${required_vars[@]}"; do
        if ! grep -q "^$var=" "$ENV_FILE"; then
            missing+=("$var")
        elif [[ -z "$(grep "^$var=" "$ENV_FILE" | cut -d'=' -f2)" ]]; then
            empty+=("$var")
        fi
    done
    
    if [[ ${#missing[@]} -gt 0 ]]; then
        echo "❌ Missing required variables: ${missing[*]}"
        return 1
    fi
    
    if [[ ${#empty[@]} -gt 0 ]]; then
        echo "❌ Empty required variables: ${empty[*]}"
        return 1
    fi
    
    echo "✓ All required variables present"
    return 0
}

check_gemini_key_format() {
    local key
    key=$(grep "^GEMINI_API_KEY=" "$ENV_FILE" | cut -d'=' -f2)
    
    if [[ ${#key} -lt 30 ]]; then
        echo "⚠️  GEMINI_API_KEY looks too short (may be invalid)"
        return 1
    fi
    
    echo "✓ GEMINI_API_KEY format looks valid"
    return 0
}

check_telegram_tokens() {
    local daatan_token
    daatan_token=$(grep "^TELEGRAM_BOT_TOKEN_DAATAN=" "$ENV_FILE" | cut -d'=' -f2)
    local calendar_token
    calendar_token=$(grep "^TELEGRAM_BOT_TOKEN_CALENDAR=" "$ENV_FILE" | cut -d'=' -f2)
    
    local valid=true
    
    # Telegram tokens format: numeric_id:alphanumeric_string
    if ! [[ "$daatan_token" =~ ^[0-9]+:[A-Za-z0-9_-]+$ ]]; then
        echo "⚠️  TELEGRAM_BOT_TOKEN_DAATAN format looks invalid"
        valid=false
    fi
    
    if ! [[ "$calendar_token" =~ ^[0-9]+:[A-Za-z0-9_-]+$ ]]; then
        echo "⚠️  TELEGRAM_BOT_TOKEN_CALENDAR format looks invalid"
        valid=false
    fi
    
    if [[ "$valid" == "true" ]]; then
        echo "✓ Telegram bot tokens format looks valid"
    fi
    
    return 0
}

check_qwen_cloud_key() {
    if grep -q "^QWEN_CLOUD_API_KEY=" "$ENV_FILE"; then
        local key
        key=$(grep "^QWEN_CLOUD_API_KEY=" "$ENV_FILE" | cut -d'=' -f2)
        if [[ -n "$key" ]]; then
            echo "✓ Qwen Cloud API key configured (will use cloud fallback)"
            return 0
        fi
    fi
    
    echo "ℹ️  Qwen Cloud API key not configured (will use local fallback only)"
    return 0
}

check_file_permissions() {
    local perms
    perms=$(stat -c %a "$ENV_FILE" 2>/dev/null || echo "unknown")
    
    if [[ "$perms" != "600" && "$perms" != "400" ]]; then
        echo "⚠️  Environment file permissions are $perms (should be 600 or 400)"
        if [[ "$FIX_MODE" == "true" ]]; then
            chmod 600 "$ENV_FILE"
            echo "   Fixed: set permissions to 600"
        fi
        return 1
    fi
    
    echo "✓ File permissions are secure ($perms)"
    return 0
}

# =============================================================================
# Main
# =============================================================================

main() {
    echo "OpenClaw Environment Validation"
    echo "================================"
    echo ""
    echo "File: $ENV_FILE"
    echo ""
    
    local errors=0
    
    check_file_exists || ((errors++))
    check_required_vars || ((errors++))
    check_gemini_key_format || true  # Warning only
    check_telegram_tokens || true    # Warning only
    check_qwen_cloud_key || true     # Info only
    check_file_permissions || ((errors++))
    
    echo ""
    echo "================================"
    
    if [[ $errors -gt 0 ]]; then
        echo "❌ Validation failed with $errors error(s)"
        echo ""
        if [[ "$FIX_MODE" != "true" ]]; then
            echo "Run with --fix to attempt automatic fixes"
        fi
        exit 1
    else
        echo "✓ Validation passed!"
        exit 0
    fi
}

# Run main function
main "$@"
