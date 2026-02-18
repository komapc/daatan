#!/bin/bash
# Common functions for OpenClaw EC2 deployment scripts
# Source this file in other scripts: source "$(dirname "$0")/lib/common.sh"

set -euo pipefail

# =============================================================================
# Configuration
# =============================================================================

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
readonly INFRA_DIR="$PROJECT_ROOT"
readonly TERRAFORM_DIR="$INFRA_DIR/terraform"
readonly SSH_KEY_NAME="daatan-key"
readonly SSH_KEY_PATH="${OPENCLAW_KEY:-$HOME/.ssh/$SSH_KEY_NAME.pem}"

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

# =============================================================================
# Logging Functions
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

log_step() {
    echo -e "\n${GREEN}==>${NC} $*"
}

# =============================================================================
# Validation Functions
# =============================================================================

require_command() {
    local cmd="$1"
    if ! command -v "$cmd" &> /dev/null; then
        log_error "Required command '$cmd' not found. Please install it first."
        exit 1
    fi
}

require_env() {
    local var="$1"
    local desc="${2:-$var}"
    if [[ -z "${!var:-}" ]]; then
        log_error "Required environment variable '$desc' ($var) is not set."
        exit 1
    fi
}

check_aws_credentials() {
    log_step "Checking AWS credentials..."
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials not configured or invalid."
        log_info "Run 'aws configure' or set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY."
        exit 1
    fi
    local account_id
    account_id=$(aws sts get-caller-identity --query Account --output text)
    if [[ "$account_id" != "272007598366" ]]; then
        log_error "Wrong AWS account. Expected 272007598366, got $account_id."
        exit 1
    fi
    log_success "AWS credentials valid (account: $account_id)"
}

check_ssh_key() {
    log_step "Checking SSH key..."
    if [[ ! -f "$SSH_KEY_PATH" ]]; then
        log_error "SSH key not found at $SSH_KEY_PATH"
        log_info "Set OPENCLAW_KEY environment variable or place key at expected location."
        exit 1
    fi
    if [[ ! -r "$SSH_KEY_PATH" ]]; then
        log_error "SSH key not readable. Check permissions (should be 400 or 600)."
        exit 1
    fi
    log_success "SSH key found at $SSH_KEY_PATH"
}

check_terraform() {
    log_step "Checking Terraform..."
    require_command terraform
    local version
    version=$(terraform version -json | jq -r '.terraform_version' 2>/dev/null || terraform version | head -1)
    log_info "Terraform version: $version"
}

check_prerequisites() {
    log_step "Checking prerequisites..."
    require_command aws
    require_command terraform
    require_command jq
    require_command ssh
    require_command scp
    
    check_aws_credentials
    check_ssh_key
    check_terraform
}

# =============================================================================
# Terraform Helper Functions
# =============================================================================

terraform_init() {
    log_step "Initializing Terraform..."
    cd "$TERRAFORM_DIR"
    if [[ ! -d ".terraform" ]]; then
        terraform init
    else
        terraform init -upgrade
    fi
    log_success "Terraform initialized"
}

terraform_apply() {
    local auto_approve="${1:-false}"
    log_step "Applying Terraform..."
    cd "$TERRAFORM_DIR"
    
    if [[ "$auto_approve" == "true" ]]; then
        terraform apply -auto-approve
    else
        terraform apply
    fi
    
    if [[ $? -eq 0 ]]; then
        log_success "Terraform apply completed"
    else
        log_error "Terraform apply failed"
        exit 1
    fi
}

terraform_destroy() {
    local auto_approve="${1:-false}"
    log_step "Destroying infrastructure..."
    cd "$TERRAFORM_DIR"
    
    if [[ "$auto_approve" == "true" ]]; then
        terraform destroy -auto-approve
    else
        terraform destroy
    fi
    
    if [[ $? -eq 0 ]]; then
        log_success "Infrastructure destroyed"
    else
        log_error "Terraform destroy failed"
        exit 1
    fi
}

get_output() {
    local output_name="$1"
    cd "$TERRAFORM_DIR"
    terraform output -raw "$output_name" 2>/dev/null || echo ""
}

get_instance_id() {
    get_output "openclaw_instance_id"
}

get_public_ip() {
    get_output "openclaw_public_ip"
}

# =============================================================================
# SSH Helper Functions
# =============================================================================

ssh_to_instance() {
    local ip="${1:-$(get_public_ip)}"
    if [[ -z "$ip" ]]; then
        log_error "Could not get instance IP. Is Terraform state available?"
        exit 1
    fi
    log_info "SSH into ubuntu@$ip..."
    ssh -i "$SSH_KEY_PATH" \
        -o StrictHostKeyChecking=no \
        -o UserKnownHostsFile=/dev/null \
        ubuntu@"$ip" "$@"
}

scp_to_instance() {
    local ip="${1:-$(get_public_ip)}"
    local source="$2"
    local dest="$3"
    if [[ -z "$ip" || -z "$source" || -z "$dest" ]]; then
        log_error "Usage: scp_to_instance <ip> <source> <dest>"
        exit 1
    fi
    log_info "Copying $source to $ip:$dest..."
    scp -i "$SSH_KEY_PATH" \
        -o StrictHostKeyChecking=no \
        -o UserKnownHostsFile=/dev/null \
        -r "$source" ubuntu@"$ip":"$dest"
}

ssh_exec() {
    local ip="${1:-$(get_public_ip)}"
    shift
    log_info "Executing on $ip: $*"
    ssh -i "$SSH_KEY_PATH" \
        -o StrictHostKeyChecking=no \
        -o UserKnownHostsFile=/dev/null \
        ubuntu@"$ip" "$@"
}

# =============================================================================
# Environment Validation
# =============================================================================

validate_env_file() {
    local env_file="${1:-$INFRA_DIR/.env}"
    log_step "Validating environment file: $env_file"
    
    if [[ ! -f "$env_file" ]]; then
        log_error "Environment file not found: $env_file"
        log_info "Copy .env.example to .env and fill in values."
        return 1
    fi
    
    local required_vars=(
        "GEMINI_API_KEY"
        "TELEGRAM_CHAT_ID"
        "TELEGRAM_BOT_TOKEN_DAATAN"
        "TELEGRAM_BOT_TOKEN_CALENDAR"
    )
    
    local missing=()
    for var in "${required_vars[@]}"; do
        if ! grep -q "^$var=" "$env_file" || [[ -z "$(grep "^$var=" "$env_file" | cut -d'=' -f2)" ]]; then
            missing+=("$var")
        fi
    done
    
    if [[ ${#missing[@]} -gt 0 ]]; then
        log_error "Missing or empty required variables: ${missing[*]}"
        return 1
    fi
    
    # Validate API key formats
    if ! grep "^GEMINI_API_KEY=" "$env_file" | grep -qE "^GEMINI_API_KEY=[A-Za-z0-9_-]{30,}"; then
        log_warning "GEMINI_API_KEY format looks invalid"
    fi
    
    if ! grep "^TELEGRAM_BOT_TOKEN_DAATAN=" "$env_file" | grep -qE "^TELEGRAM_BOT_TOKEN_DAATAN=[0-9]+:[A-Za-z0-9_-]+"; then
        log_warning "TELEGRAM_BOT_TOKEN_DAATAN format looks invalid"
    fi
    
    if ! grep "^TELEGRAM_BOT_TOKEN_CALENDAR=" "$env_file" | grep -qE "^TELEGRAM_BOT_TOKEN_CALENDAR=[0-9]+:[A-Za-z0-9_-]+"; then
        log_warning "TELEGRAM_BOT_TOKEN_CALENDAR format looks invalid"
    fi
    
    log_success "Environment file validated"
    return 0
}

# =============================================================================
# Backup Functions
# =============================================================================

backup_env_local() {
    local env_file="${1:-$INFRA_DIR/.env}"
    local backup_dir="${2:-$INFRA_DIR/backups}"
    local timestamp
    timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$backup_dir/env_$timestamp.bak"
    
    if [[ ! -f "$env_file" ]]; then
        log_error "Cannot backup: $env_file does not exist"
        return 1
    fi
    
    mkdir -p "$backup_dir"
    cp "$env_file" "$backup_file"
    chmod 600 "$backup_file"
    
    log_success "Environment backed up to: $backup_file"
    echo "$backup_file"
}

backup_env_s3() {
    local env_file="${1:-$INFRA_DIR/.env}"
    local bucket="${2:-daatan-openclaw-backups}"
    local key="env/$(date +%Y/%m/%d)/env_$(date +%H%M%S).bak"
    
    if [[ ! -f "$env_file" ]]; then
        log_error "Cannot backup: $env_file does not exist"
        return 1
    fi
    
    log_info "Backing up .env to s3://$bucket/$key..."
    aws s3 cp "$env_file" "s3://$bucket/$key" --sse AES256
    
    if [[ $? -eq 0 ]]; then
        log_success "Environment backed up to s3://$bucket/$key"
        return 0
    else
        log_error "S3 backup failed"
        return 1
    fi
}

restore_env_s3() {
    local bucket="${1:-daatan-openclaw-backups}"
    local key="${2:-}"
    local dest="${3:-$INFRA_DIR/.env}"
    
    if [[ -z "$key" ]]; then
        log_info "Finding latest backup in s3://$bucket/env/..."
        key=$(aws s3 ls "s3://$bucket/env/" --recursive | sort | tail -1 | awk '{print $4}')
        if [[ -z "$key" ]]; then
            log_error "No backups found in s3://$bucket/env/"
            return 1
        fi
        log_info "Found latest: $key"
    fi
    
    log_info "Restoring from s3://$bucket/$key to $dest..."
    aws s3 cp "s3://$bucket/$key" "$dest"
    
    if [[ $? -eq 0 ]]; then
        chmod 600 "$dest"
        log_success "Environment restored from backup"
        return 0
    else
        log_error "S3 restore failed"
        return 1
    fi
}

# =============================================================================
# Health Check Functions
# =============================================================================

check_instance_health() {
    local ip="${1:-$(get_public_ip)}"
    log_step "Checking instance health..."
    
    # Check SSH connectivity
    if ! ssh_exec "$ip" "echo 'SSH OK'" &> /dev/null; then
        log_error "Cannot connect via SSH"
        return 1
    fi
    
    # Check Docker
    if ! ssh_exec "$ip" "docker info" &> /dev/null; then
        log_error "Docker not running"
        return 1
    fi
    
    # Check Ollama
    if ! ssh_exec "$ip" "ollama list" &> /dev/null; then
        log_error "Ollama not running"
        return 1
    fi
    
    # Check containers
    local container_status
    container_status=$(ssh_exec "$ip" "docker compose ps --format json" 2>/dev/null | jq -r '.[].State' || echo "unknown")
    if [[ "$container_status" != "running" ]]; then
        log_error "OpenClaw container not running (status: $container_status)"
        return 1
    fi
    
    log_success "Instance health check passed"
    return 0
}

# =============================================================================
# Utility Functions
# =============================================================================

confirm() {
    local message="${1:-Are you sure?}"
    echo -n "${YELLOW}$message [y/N]: ${NC}"
    read -r response
    case "$response" in
        [yY][eE][sS]|[yY])
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

wait_for_ssh() {
    local ip="${1:-$(get_public_ip)}"
    local max_attempts="${2:-30}"
    local attempt=1
    
    log_step "Waiting for SSH to be available on $ip..."
    
    while [[ $attempt -le $max_attempts ]]; do
        if ssh -i "$SSH_KEY_PATH" \
            -o StrictHostKeyChecking=no \
            -o UserKnownHostsFile=/dev/null \
            -o ConnectTimeout=5 \
            ubuntu@"$ip" "echo 'SSH ready'" &> /dev/null; then
            log_success "SSH available after $attempt attempts"
            return 0
        fi
        ((attempt++))
        sleep 5
    done
    
    log_error "SSH not available after $max_attempts attempts"
    return 1
}

# =============================================================================
# Main Entry Point (for sourcing)
# =============================================================================

# Only set these if this script is sourced, not executed directly
if [[ "${BASH_SOURCE[0]}" != "${0}" ]]; then
    log_info "OpenClaw common library loaded"
fi
