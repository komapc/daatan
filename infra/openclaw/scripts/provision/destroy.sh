#!/bin/bash
# Destroy OpenClaw infrastructure on EC2
# Usage: ./scripts/provision/destroy.sh [--auto-approve]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Source common functions
source "$INFRA_DIR/scripts/lib/common.sh"

# =============================================================================
# Configuration
# =============================================================================

AUTO_APPROVE=false
KEEP_BACKUP=true

# =============================================================================
# Parse Arguments
# =============================================================================

while [[ $# -gt 0 ]]; do
    case $1 in
        --auto-approve)
            AUTO_APPROVE=true
            shift
            ;;
        --no-backup)
            KEEP_BACKUP=false
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [--auto-approve] [--no-backup]"
            echo ""
            echo "Options:"
            echo "  --auto-approve     Skip confirmation prompt"
            echo "  --no-backup        Skip .env backup before destroy"
            echo "  -h, --help         Show this help message"
            echo ""
            echo "WARNING: This will permanently destroy all infrastructure!"
            echo "         - EC2 instance will be terminated"
            echo "         - EIP will be released"
            echo "         - All data on instance will be lost"
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
    log_warning "OpenClaw Infrastructure Destruction"
    log_warning "===================================="
    echo ""
    echo "This will PERMANENTLY destroy:"
    echo "  - EC2 instance (t4g.medium)"
    echo "  - Elastic IP address"
    echo "  - All data on the instance"
    echo ""
    echo "Data that will be LOST:"
    echo "  - Cloned repositories (daatan, year-shape)"
    echo "  - Docker containers and images"
    echo "  - Ollama models"
    echo "  - Any uncommitted changes"
    echo ""
    echo "Data that will be PRESERVED:"
    echo "  - Terraform state (local)"
    echo "  - This script and infrastructure code"
    echo ""
    
    # Backup .env before destroy
    if [[ "$KEEP_BACKUP" == "true" ]]; then
        log_step "Backing up .env file..."
        if [[ -f "$INFRA_DIR/.env" ]]; then
            backup_env_local "$INFRA_DIR/.env" "$INFRA_DIR/backups"
            log_info "Backup created. Keep this file if you want to restore later."
        else
            log_warning "No .env file found to backup"
        fi
    fi
    
    # Confirmation
    if [[ "$AUTO_APPROVE" != "true" ]]; then
        echo ""
        log_warning "This action CANNOT be undone!"
        echo ""
        if ! confirm "Type 'destroy' to confirm destruction"; then
            local response
            read -r response
            if [[ "$response" != "destroy" ]]; then
                log_info "Destruction cancelled"
                exit 0
            fi
        fi
    else
        log_warning "Auto-approve enabled - proceeding without confirmation"
    fi
    
    # Check prerequisites
    check_aws_credentials
    check_terraform
    
    # Initialize Terraform (in case .terraform doesn't exist)
    cd "$TERRAFORM_DIR"
    if [[ ! -d ".terraform" ]]; then
        log_info "Initializing Terraform..."
        terraform init
    fi
    
    # Check if state exists
    if [[ ! -f "terraform.tfstate" ]]; then
        log_warning "No Terraform state found. Nothing to destroy."
        exit 0
    fi
    
    # Destroy
    log_step "Destroying infrastructure..."
    if [[ "$AUTO_APPROVE" == "true" ]]; then
        terraform destroy -auto-approve
    else
        terraform destroy
    fi
    
    # Cleanup
    log_step "Cleanup..."
    rm -f "$INFRA_DIR/.instance-info"
    log_info "Removed instance info file"
    
    # Summary
    echo ""
    log_success "Infrastructure destroyed successfully!"
    echo ""
    echo "What was destroyed:"
    echo "  - EC2 instance"
    echo "  - Elastic IP"
    echo "  - Security group"
    echo ""
    echo "What remains:"
    echo "  - Terraform state: $TERRAFORM_DIR/terraform.tfstate"
    echo "  - Infrastructure code: $INFRA_DIR/terraform/"
    echo "  - Backup files: $INFRA_DIR/backups/"
    echo ""
    echo "To recreate infrastructure:"
    echo "  ./scripts/provision/create.sh"
    echo ""
}

# Run main function
main "$@"
