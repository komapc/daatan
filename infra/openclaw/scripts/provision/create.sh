#!/bin/bash
# Create OpenClaw infrastructure on EC2
# Usage: ./scripts/provision/create.sh [--auto-approve]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Source common functions
source "$INFRA_DIR/scripts/lib/common.sh"

# =============================================================================
# Configuration
# =============================================================================

AUTO_APPROVE=false
SKIP_VALIDATION=false

# =============================================================================
# Parse Arguments
# =============================================================================

while [[ $# -gt 0 ]]; do
    case $1 in
        --auto-approve)
            AUTO_APPROVE=true
            shift
            ;;
        --skip-validation)
            SKIP_VALIDATION=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [--auto-approve] [--skip-validation]"
            echo ""
            echo "Options:"
            echo "  --auto-approve     Skip Terraform confirmation prompt"
            echo "  --skip-validation  Skip environment validation (use with caution)"
            echo "  -h, --help         Show this help message"
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
    log_info "OpenClaw Infrastructure Creation"
    log_info "================================"
    
    # Pre-flight checks
    if [[ "$SKIP_VALIDATION" != "true" ]]; then
        check_prerequisites
        validate_env_file "$INFRA_DIR/.env"
    else
        log_warning "Skipping validation (--skip-validation)"
    fi
    
    # Check Terraform state
    cd "$TERRAFORM_DIR"
    if [[ -f "terraform.tfstate" ]]; then
        log_info "Existing Terraform state found"
        local existing_ip
        existing_ip=$(terraform output -raw openclaw_public_ip 2>/dev/null || echo "")
        if [[ -n "$existing_ip" ]]; then
            log_warning "Infrastructure may already exist (IP: $existing_ip)"
            if [[ "$AUTO_APPROVE" != "true" ]]; then
                if ! confirm "Continue anyway? This will update existing infrastructure"; then
                    log_info "Aborted"
                    exit 0
                fi
            fi
        fi
    fi
    
    # Initialize Terraform
    terraform_init
    
    # Show plan
    log_step "Terraform Plan"
    terraform plan -out=/tmp/openclaw.tfplan
    
    # Apply
    if [[ "$AUTO_APPROVE" == "true" ]]; then
        log_warning "Auto-approve enabled - no confirmation required"
        terraform apply /tmp/openclaw.tfplan
    else
        if confirm "Apply Terraform plan?"; then
            terraform apply /tmp/openclaw.tfplan
        else
            log_info "Aborted"
            exit 0
        fi
    fi
    
    # Post-provision
    log_step "Post-Provision Tasks"
    
    local ip
    ip=$(get_public_ip)
    local instance_id
    instance_id=$(get_instance_id)
    
    if [[ -z "$ip" ]]; then
        log_error "Could not get public IP from Terraform output"
        exit 1
    fi
    
    log_success "Infrastructure created successfully!"
    echo ""
    echo "Instance Details:"
    echo "  Public IP:     $ip"
    echo "  Instance ID:   $instance_id"
    echo "  SSH Command:   ssh -i $SSH_KEY_PATH ubuntu@$ip"
    echo ""
    echo "Next Steps:"
    echo "  1. Add GitHub deploy key (run on instance: cat ~/.ssh/id_github.pub)"
    echo "  2. Copy infra to instance: ./scripts/provision/copy-infra.sh"
    echo "  3. Run setup: ./scripts/setup/on-ec2.sh (via SSH)"
    echo ""
    echo "Or run the all-in-one script:"
    echo "  ./scripts/provision/deploy-all.sh"
    echo ""
    
    # Save connection info
    cat > "$INFRA_DIR/.instance-info" << EOF
# OpenClaw Instance Information
# Generated: $(date -Iseconds)

PUBLIC_IP=$ip
INSTANCE_ID=$instance_id
SSH_KEY=$SSH_KEY_PATH
SSH_USER=ubuntu
REGION=$(aws configure get region || echo "eu-central-1")

# SSH Command
SSH_CMD="ssh -i $SSH_KEY_PATH ubuntu@$ip"

# SCP Command
SCP_CMD="scp -i $SSH_KEY_PATH"
EOF
    chmod 600 "$INFRA_DIR/.instance-info"
    log_info "Instance info saved to: $INFRA_DIR/.instance-info"
}

# Run main function
main "$@"
