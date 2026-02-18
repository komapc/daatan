#!/bin/bash
# Run setup script on EC2 instance
# Usage: ./scripts/provision/run-setup.sh [instance-ip]

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
    
    log_info "Running OpenClaw setup on EC2"
    log_info "=============================="
    
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
    
    # Wait for SSH to be available
    wait_for_ssh "$ip"
    
    # Run setup script
    log_step "Running setup script..."
    ssh_exec "$ip" "
        set -e
        cd ~/projects/openclaw
        ./scripts/setup/on-ec2.sh
    "
    
    if [[ $? -eq 0 ]]; then
        log_success "Setup completed successfully!"
    else
        log_error "Setup failed"
        exit 1
    fi
    
    # Verify containers are running
    log_step "Verifying containers..."
    sleep 5
    if ssh_exec "$ip" "docker compose ps | grep -q 'openclaw.*running'"; then
        log_success "OpenClaw container is running!"
    else
        log_warning "Container status unknown. Check manually."
    fi
    
    echo ""
    echo "Setup Complete!"
    echo ""
    echo "Verify manually:"
    echo "  ssh -i $SSH_KEY_PATH ubuntu@$ip"
    echo "  cd ~/projects/openclaw"
    echo "  docker compose ps"
    echo "  docker compose logs -f"
    echo ""
    echo "Test Telegram bots:"
    echo "  Message @DaatanBot with /start"
    echo "  Message @CalendarBot with /start"
    echo ""
}

# Run main function
main "$@"
