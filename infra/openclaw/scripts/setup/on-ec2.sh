#!/bin/bash
# Setup OpenClaw on EC2 instance
# Run this ONCE after infrastructure is created and code is copied
# Usage: ~/projects/openclaw/scripts/setup/on-ec2.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OPENCLAW_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
PROJECTS_DIR="$HOME/projects"

# =============================================================================
# Configuration
# =============================================================================

readonly GITHUB_DAATAN="git@github.com:komapc/daatan.git"
readonly GITHUB_YEAR_SHAPE="git@github.com:komapc/year-shape.git"
readonly SSH_KEY="$HOME/.ssh/id_github"
readonly ENV_FILE="$OPENCLAW_DIR/.env"

# =============================================================================
# Helper Functions
# =============================================================================

log_info() {
    echo -e "\033[0;34m[INFO]\033[0m $*"
}

log_success() {
    echo -e "\033[0;32m[SUCCESS]\033[0m $*"
}

log_warning() {
    echo -e "\033[1;33m[WARNING]\033[0m $*"
}

log_error() {
    echo -e "\033[0;31m[ERROR]\033[0m $*" >&2
}

log_step() {
    echo -e "\n\033[0;32m==>\033[0m \033[1m$*\033[0m"
}

die() {
    log_error "$1"
    exit 1
}

# =============================================================================
# Setup Steps
# =============================================================================

setup_git_ssh() {
    log_step "Configuring Git SSH..."
    
    export GIT_SSH_COMMAND="ssh -i $SSH_KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=no"
    
    # Test SSH key
    if [[ ! -f "$SSH_KEY" ]]; then
        die "GitHub SSH key not found: $SSH_KEY"
    fi
    
    log_success "Git SSH configured"
}

clone_repos() {
    log_step "Cloning repositories..."
    
    cd "$PROJECTS_DIR"
    
    # Clone daatan
    if [[ -d "daatan" ]]; then
        log_info "daatan already exists, pulling latest..."
        (cd daatan && git pull)
    else
        log_info "Cloning daatan..."
        git clone "$GITHUB_DAATAN" || die "Failed to clone daatan"
    fi
    
    # Clone year-shape
    if [[ -d "year-shape" ]]; then
        log_info "year-shape already exists, pulling latest..."
        (cd year-shape && git pull)
    else
        log_info "Cloning year-shape..."
        git clone "$GITHUB_YEAR_SHAPE" || die "Failed to clone year-shape"
    fi
    
    log_success "Repositories cloned"
}

bootstrap_calendar_agent() {
    log_step "Bootstrapping Calendar agent..."
    
    local bootstrap_dir="$OPENCLAW_DIR/calendar-agent-bootstrap"
    local year_shape_agents="$PROJECTS_DIR/year-shape/agents/main"
    
    if [[ ! -d "$bootstrap_dir" ]]; then
        log_warning "Bootstrap directory not found: $bootstrap_dir"
        log_warning "Skipping Calendar agent bootstrap"
        return 0
    fi
    
    mkdir -p "$year_shape_agents"
    
    # Copy SOUL.md
    if [[ -f "$bootstrap_dir/agents/main/SOUL.md" ]]; then
        cp "$bootstrap_dir/agents/main/SOUL.md" "$year_shape_agents/"
        log_info "Copied SOUL.md"
    else
        log_warning "SOUL.md not found in bootstrap directory"
    fi
    
    # Copy AGENTS.md
    if [[ -f "$bootstrap_dir/agents/main/AGENTS.md" ]]; then
        cp "$bootstrap_dir/agents/main/AGENTS.md" "$year_shape_agents/"
        log_info "Copied AGENTS.md"
    else
        log_warning "AGENTS.md not found in bootstrap directory"
    fi
    
    log_success "Calendar agent bootstrapped"
}

validate_env() {
    log_step "Validating environment file..."
    
    if [[ ! -f "$ENV_FILE" ]]; then
        die "Environment file not found: $ENV_FILE"
    fi
    
    # Check required variables
    local required_vars=(
        "GEMINI_API_KEY"
        "TELEGRAM_CHAT_ID"
        "TELEGRAM_BOT_TOKEN_DAATAN"
        "TELEGRAM_BOT_TOKEN_CALENDAR"
    )
    
    local missing=()
    for var in "${required_vars[@]}"; do
        if ! grep -q "^$var=" "$ENV_FILE" || [[ -z "$(grep "^$var=" "$ENV_FILE" | cut -d'=' -f2)" ]]; then
            missing+=("$var")
        fi
    done
    
    if [[ ${#missing[@]} -gt 0 ]]; then
        die "Missing required environment variables: ${missing[*]}"
    fi
    
    # Optional: Check for Qwen Cloud API key
    if grep -q "^QWEN_CLOUD_API_KEY=" "$ENV_FILE" && [[ -n "$(grep "^QWEN_CLOUD_API_KEY=" "$ENV_FILE" | cut -d'=' -f2)" ]]; then
        log_info "Qwen Cloud API key found - will use cloud fallback"
    else
        log_info "Qwen Cloud API key not found - will use local fallback only"
    fi
    
    log_success "Environment validated"
}

start_containers() {
    log_step "Starting Docker containers..."
    
    cd "$OPENCLAW_DIR"
    
    # Check if Docker is available
    if ! command -v docker &> /dev/null; then
        die "Docker not found"
    fi
    
    # Use sg docker to ensure we have permissions
    sg docker -c "docker compose up -d" || die "Failed to start containers"
    
    log_success "Containers started"
}

verify_deployment() {
    log_step "Verifying deployment..."
    
    cd "$OPENCLAW_DIR"
    
    # Wait for container to be healthy
    log_info "Waiting for container to start..."
    sleep 10
    
    # Check container status
    if sg docker -c "docker compose ps | grep -q 'openclaw.*running'"; then
        log_success "OpenClaw container is running"
    else
        log_warning "Container status unknown - check manually"
        sg docker -c "docker compose ps"
    fi
    
    # Check Ollama
    if command -v ollama &> /dev/null; then
        if ollama list | grep -q "qwen"; then
            log_success "Qwen model available"
        else
            log_warning "Qwen model not found - may need to pull"
        fi
    else
        log_warning "Ollama not found in PATH"
    fi
    
    log_success "Verification complete"
}

show_next_steps() {
    echo ""
    echo "================================"
    echo "Setup Complete!"
    echo "================================"
    echo ""
    echo "OpenClaw is now running on this instance."
    echo ""
    echo "Next Steps:"
    echo ""
    echo "1. Add GitHub deploy key (if not done):"
    echo "   cat $SSH_KEY.pub"
    echo "   (Add to GitHub with write access for both repos)"
    echo ""
    echo "2. Test Telegram bots:"
    echo "   Message @DaatanBot with /start"
    echo "   Message @CalendarBot with /start"
    echo ""
    echo "3. View logs:"
    echo "   cd $OPENCLAW_DIR"
    echo "   docker compose logs -f"
    echo ""
    echo "4. Run OpenClaw commands:"
    echo "   docker exec -it openclaw openclaw tui"
    echo "   docker exec -it openclaw openclaw doctor"
    echo ""
    echo "5. Check pairing requests (if any):"
    echo "   docker exec -it openclaw openclaw pairing list telegram"
    echo ""
}

# =============================================================================
# Main
# =============================================================================

main() {
    log_info "OpenClaw EC2 Setup"
    log_info "=================="
    echo ""
    echo "This script will:"
    echo "  1. Clone repositories (daatan, year-shape)"
    echo "  2. Bootstrap Calendar agent"
    echo "  3. Validate environment"
    echo "  4. Start Docker containers"
    echo "  5. Verify deployment"
    echo ""
    
    # Run setup steps
    setup_git_ssh
    clone_repos
    bootstrap_calendar_agent
    validate_env
    start_containers
    verify_deployment
    
    # Show next steps
    show_next_steps
}

# Run main function
main "$@"
