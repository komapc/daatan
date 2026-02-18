#!/bin/bash
# All-in-one deployment script: create + copy + setup
# Usage: ./scripts/provision/deploy-all.sh [--auto-approve]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Source common functions
source "$INFRA_DIR/scripts/lib/common.sh"

# =============================================================================
# Configuration
# =============================================================================

AUTO_APPROVE=false

# =============================================================================
# Parse Arguments
# =============================================================================

while [[ $# -gt 0 ]]; do
    case $1 in
        --auto-approve)
            AUTO_APPROVE=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [--auto-approve]"
            echo ""
            echo "Options:"
            echo "  --auto-approve     Skip all confirmation prompts"
            echo "  -h, --help         Show this help message"
            echo ""
            echo "This script will:"
            echo "  1. Create EC2 infrastructure (Terraform)"
            echo "  2. Wait for instance to be ready"
            echo "  3. Copy infrastructure code to instance"
            echo "  4. Run setup script on instance"
            echo "  5. Verify deployment"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# =============================================================================
# Main
# =============================================================================

main() {
    log_info "OpenClaw Full Deployment"
    log_info "========================"
    echo ""
    echo "This script will perform a complete deployment:"
    echo "  1. Create EC2 infrastructure"
    echo "  2. Copy code to instance"
    echo "  3. Run setup on instance"
    echo "  4. Verify deployment"
    echo ""
    echo "Estimated time: 10-15 minutes"
    echo ""
    
    if [[ "$AUTO_APPROVE" != "true" ]]; then
        if ! confirm "Continue with full deployment?"; then
            log_info "Deployment cancelled"
            exit 0
        fi
    fi
    
    # Step 1: Create infrastructure
    log_step "Step 1/4: Creating infrastructure..."
    "$SCRIPT_DIR/create.sh" ${AUTO_APPROVE:+--auto-approve}
    
    # Get instance IP
    local ip
    if [[ -f "$INFRA_DIR/.instance-info" ]]; then
        # shellcheck disable=SC1091
        source "$INFRA_DIR/.instance-info"
        ip="$PUBLIC_IP"
    else
        ip=$(get_public_ip)
    fi
    
    if [[ -z "$ip" ]]; then
        log_error "Could not get instance IP"
        exit 1
    fi
    
    log_info "Instance IP: $ip"
    
    # Wait for SSH
    log_step "Step 2/4: Waiting for SSH..."
    wait_for_ssh "$ip"
    
    # Step 3: Copy infrastructure
    log_step "Step 3/4: Copying infrastructure..."
    "$SCRIPT_DIR/copy-infra.sh" "$ip"
    
    # Step 4: Run setup
    log_step "Step 4/4: Running setup..."
    "$SCRIPT_DIR/run-setup.sh" "$ip"
    
    # Final verification
    log_step "Final verification..."
    sleep 10
    if ssh_exec "$ip" "docker compose ps | grep -q 'openclaw.*running'"; then
        log_success "Deployment completed successfully!"
    else
        log_warning "Deployment may have issues. Check logs manually."
    fi
    
    echo ""
    echo "================================"
    echo "Deployment Complete!"
    echo "================================"
    echo ""
    echo "Instance: $ip"
    echo "SSH: ssh -i $SSH_KEY_PATH ubuntu@$ip"
    echo ""
    echo "Next Steps:"
    echo "  1. Add GitHub deploy key:"
    echo "     ssh -i $SSH_KEY_PATH ubuntu@$ip 'cat ~/.ssh/id_github.pub'"
    echo "     (Add to GitHub with write access for both repos)"
    echo ""
    echo "  2. Test Telegram bots:"
    echo "     Message @DaatanBot with /start"
    echo "     Message @CalendarBot with /start"
    echo ""
    echo "  3. View logs:"
    echo "     ssh -i $SSH_KEY_PATH ubuntu@$ip"
    echo "     cd ~/projects/openclaw"
    echo "     docker compose logs -f"
    echo ""
    echo "  4. Run health check:"
    echo "     ./scripts/utils/health-check.sh $ip"
    echo ""
}

# Run main function
main "$@"
