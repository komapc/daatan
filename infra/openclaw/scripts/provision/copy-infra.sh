#!/bin/bash
# Copy infrastructure and configuration to EC2 instance
# Usage: ./scripts/provision/copy-infra.sh [instance-ip]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Source common functions
source "$INFRA_DIR/scripts/lib/common.sh"

# =============================================================================
# Main
# =============================================================================

main() {
    local ip="${1:-}"
    
    log_info "Copying OpenClaw infrastructure to EC2"
    log_info "======================================="
    
    # Get instance IP if not provided
    if [[ -z "$ip" ]]; then
        if [[ -f "$INFRA_DIR/.instance-info" ]]; then
            # shellcheck disable=SC1091
            source "$INFRA_DIR/.instance-info"
            ip="$PUBLIC_IP"
        else
            ip=$(get_public_ip)
        fi
    fi
    
    if [[ -z "$ip" ]]; then
        log_error "Could not determine instance IP"
        log_info "Usage: $0 <instance-ip>"
        exit 1
    fi
    
    log_info "Target instance: $ip"
    
    # Validate .env exists
    if [[ ! -f "$INFRA_DIR/.env" ]]; then
        log_error ".env file not found at $INFRA_DIR/.env"
        log_info "Copy .env.example to .env and fill in values first."
        exit 1
    fi
    
    # Create projects directory on instance
    log_step "Creating directory structure on instance..."
    ssh_exec "$ip" "mkdir -p ~/projects"
    
    # Copy openclaw directory
    log_step "Copying infrastructure to instance..."
    scp_to_instance "$ip" "$INFRA_DIR" ~/projects/
    
    # Copy .env separately (already included in openclaw dir, but ensure it's there)
    log_step "Copying .env file..."
    scp_to_instance "$ip" "$INFRA_DIR/.env" ~/projects/openclaw/.env
    
    # Set permissions
    log_step "Setting permissions..."
    ssh_exec "$ip" "chmod 600 ~/projects/openclaw/.env"
    ssh_exec "$ip" "chmod +x ~/projects/openclaw/scripts/setup/*.sh"
    ssh_exec "$ip" "chmod +x ~/projects/openclaw/scripts/utils/*.sh"
    
    # Verify
    log_step "Verifying copy..."
    if ssh_exec "$ip" "test -f ~/projects/openclaw/.env && echo 'OK'"; then
        log_success "Infrastructure copied successfully!"
    else
        log_error "Verification failed"
        exit 1
    fi
    
    echo ""
    echo "Next Steps:"
    echo "  1. SSH into instance: ssh -i $SSH_KEY_PATH ubuntu@$ip"
    echo "  2. Run setup: ~/projects/openclaw/scripts/setup/on-ec2.sh"
    echo ""
    echo "Or run remotely:"
    echo "  ./scripts/provision/run-setup.sh $ip"
    echo ""
}

# Run main function
main "$@"
