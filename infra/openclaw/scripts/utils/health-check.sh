#!/bin/bash
# Health check for OpenClaw deployment
# Usage: ./scripts/utils/health-check.sh [instance-ip] [--verbose]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OPENCLAW_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Source common functions if available
if [[ -f "$OPENCLAW_DIR/scripts/lib/common.sh" ]]; then
    source "$OPENCLAW_DIR/scripts/lib/common.sh"
fi

# =============================================================================
# Configuration
# =============================================================================

VERBOSE=false
INSTANCE_IP=""
EXIT_ON_ERROR=false

# =============================================================================
# Parse Arguments
# =============================================================================

while [[ $# -gt 0 ]]; do
    case $1 in
        --verbose|-v)
            VERBOSE=true
            shift
            ;;
        --exit-on-error)
            EXIT_ON_ERROR=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [instance-ip] [--verbose] [--exit-on-error]"
            echo ""
            echo "Options:"
            echo "  instance-ip      EC2 instance IP (optional, uses .instance-info if available)"
            echo "  --verbose, -v    Show detailed output"
            echo "  --exit-on-error  Exit with error code if any check fails"
            echo "  -h, --help       Show this help message"
            exit 0
            ;;
        -*)
            echo "Unknown option: $1"
            exit 1
            ;;
        *)
            INSTANCE_IP="$1"
            shift
            ;;
    esac
done

# =============================================================================
# Helper Functions
# =============================================================================

log_check() {
    local status="$1"
    local name="$2"
    local details="${3:-}"
    
    case "$status" in
        ok)
            echo -e "✓ \033[0;32m$name\033[0m"
            ;;
        warn)
            echo -e "⚠ \033[1;33m$name\033[0m"
            ;;
        fail)
            echo -e "✗ \033[0;31m$name\033[0m"
            ;;
        *)
            echo "  $name"
            ;;
    esac
    
    if [[ -n "$details" && "$VERBOSE" == "true" ]]; then
        echo "    $details"
    fi
}

run_check() {
    local name="$1"
    local cmd="$2"
    
    if eval "$cmd" &> /dev/null; then
        log_check "ok" "$name"
        return 0
    else
        log_check "fail" "$name"
        if [[ "$EXIT_ON_ERROR" == "true" ]]; then
            return 1
        fi
        return 0
    fi
}

run_ssh_check() {
    local name="$1"
    local cmd="$2"
    
    if [[ -z "$INSTANCE_IP" ]]; then
        log_check "warn" "$name" "No instance IP available"
        return 0
    fi
    
    local ssh_cmd="ssh -i $SSH_KEY_PATH -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null ubuntu@$INSTANCE_IP"
    
    if $ssh_cmd "$cmd" &> /dev/null; then
        log_check "ok" "$name"
        return 0
    else
        log_check "fail" "$name"
        if [[ "$VERBOSE" == "true" ]]; then
            echo "    Command: $cmd"
        fi
        if [[ "$EXIT_ON_ERROR" == "true" ]]; then
            return 1
        fi
        return 0
    fi
}

get_ssh_cmd() {
    if [[ -n "$INSTANCE_IP" ]]; then
        echo "ssh -i $SSH_KEY_PATH -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null ubuntu@$INSTANCE_IP"
    else
        echo ""
    fi
}

# =============================================================================
# Health Checks
# =============================================================================

check_local_prerequisites() {
    echo ""
    echo "Local Prerequisites"
    echo "==================="
    
    run_check "AWS CLI" "command -v aws"
    run_check "Terraform" "command -v terraform"
    run_check "SSH" "command -v ssh"
    
    if [[ -f "$OPENCLAW_DIR/.instance-info" ]]; then
        log_check "ok" "Instance info file"
    else
        log_check "warn" "Instance info file" "Not found - may need to run create.sh first"
    fi
}

check_instance_connectivity() {
    echo ""
    echo "Instance Connectivity"
    echo "====================="
    
    if [[ -z "$INSTANCE_IP" ]]; then
        if [[ -f "$OPENCLAW_DIR/.instance-info" ]]; then
            # shellcheck disable=SC1091
            source "$OPENCLAW_DIR/.instance-info"
            INSTANCE_IP="$PUBLIC_IP"
            log_check "ok" "Instance IP from .instance-info" "$INSTANCE_IP"
        else
            log_check "fail" "Instance IP" "Not available"
            return 0
        fi
    fi
    
    run_check "SSH connectivity" "ssh -i $SSH_KEY_PATH -o ConnectTimeout=5 -o StrictHostKeyChecking=no ubuntu@$INSTANCE_IP 'echo OK'"
    
    if [[ "$VERBOSE" == "true" ]]; then
        echo ""
        echo "Instance Details:"
        echo "  IP: $INSTANCE_IP"
        echo "  SSH: $(get_ssh_cmd)"
    fi
}

check_instance_health() {
    echo ""
    echo "Instance Health"
    echo "==============="
    
    if [[ -z "$INSTANCE_IP" ]]; then
        log_check "warn" "Skipping" "No instance IP"
        return 0
    fi
    
    local ssh_cmd
    ssh_cmd=$(get_ssh_cmd)
    
    # Check Docker
    $ssh_cmd "docker info" &> /dev/null && log_check "ok" "Docker daemon" || log_check "fail" "Docker daemon"
    
    # Check Ollama
    $ssh_cmd "ollama list" &> /dev/null && log_check "ok" "Ollama service" || log_check "warn" "Ollama service" "Not running or not installed"
    
    # Check disk space
    local disk_usage
    disk_usage=$($ssh_cmd "df -h / | tail -1 | awk '{print \$5}'" 2>/dev/null | tr -d '%' || echo "unknown")
    if [[ "$disk_usage" != "unknown" ]]; then
        if [[ "$disk_usage" -lt 80 ]]; then
            log_check "ok" "Disk usage" "${disk_usage}%"
        elif [[ "$disk_usage" -lt 90 ]]; then
            log_check "warn" "Disk usage" "${disk_usage}% - consider cleaning up"
        else
            log_check "fail" "Disk usage" "${disk_usage}% - critical!"
        fi
    fi
    
    # Check memory
    local mem_usage
    mem_usage=$($ssh_cmd "free | grep Mem | awk '{printf \"%.0f\", \$3/\$2 * 100}'" 2>/dev/null || echo "unknown")
    if [[ "$mem_usage" != "unknown" ]]; then
        if [[ "$mem_usage" -lt 80 ]]; then
            log_check "ok" "Memory usage" "${mem_usage}%"
        elif [[ "$mem_usage" -lt 90 ]]; then
            log_check "warn" "Memory usage" "${mem_usage}% - high"
        else
            log_check "fail" "Memory usage" "${mem_usage}% - critical!"
        fi
    fi
}

check_containers() {
    echo ""
    echo "Docker Containers"
    echo "================="
    
    if [[ -z "$INSTANCE_IP" ]]; then
        log_check "warn" "Skipping" "No instance IP"
        return 0
    fi
    
    local ssh_cmd
    ssh_cmd=$(get_ssh_cmd)
    
    # Check if container is running
    if $ssh_cmd "docker compose ps | grep -q 'openclaw.*running'" 2>/dev/null; then
        log_check "ok" "OpenClaw container"
        
        if [[ "$VERBOSE" == "true" ]]; then
            echo ""
            echo "Container Status:"
            $ssh_cmd "docker compose ps" 2>/dev/null | head -5 || true
        fi
    else
        log_check "fail" "OpenClaw container" "Not running"
        
        if [[ "$VERBOSE" == "true" ]]; then
            echo ""
            echo "All containers:"
            $ssh_cmd "docker compose ps" 2>/dev/null || true
        fi
    fi
    
    # Check container logs for recent errors
    if [[ "$VERBOSE" == "true" ]]; then
        echo ""
        echo "Recent logs (last 10 lines):"
        $ssh_cmd "docker compose logs --tail=10" 2>/dev/null | tail -10 || true
    fi
}

check_openclaw_health() {
    echo ""
    echo "OpenClaw Application"
    echo "===================="
    
    if [[ -z "$INSTANCE_IP" ]]; then
        log_check "warn" "Skipping" "No instance IP"
        return 0
    fi
    
    local ssh_cmd
    ssh_cmd=$(get_ssh_cmd)
    
    # Check if we can run openclaw commands
    if $ssh_cmd "docker exec -it openclaw openclaw --version" &> /dev/null; then
        log_check "ok" "OpenClaw CLI"
        
        if [[ "$VERBOSE" == "true" ]]; then
            local version
            version=$($ssh_cmd "docker exec openclaw openclaw --version" 2>/dev/null || echo "unknown")
            echo "    Version: $version"
        fi
    else
        log_check "warn" "OpenClaw CLI" "Not accessible"
    fi
    
    # Check Ollama models
    if $ssh_cmd "ollama list | grep -q qwen" 2>/dev/null; then
        log_check "ok" "Qwen model"
    else
        log_check "warn" "Qwen model" "Not found - fallback may not work"
    fi
}

show_summary() {
    echo ""
    echo "================================"
    echo "Health Check Summary"
    echo "================================"
    echo ""
    
    if [[ -n "$INSTANCE_IP" ]]; then
        echo "Instance: $INSTANCE_IP"
        echo "SSH: ssh -i $SSH_KEY_PATH ubuntu@$INSTANCE_IP"
    else
        echo "Instance: Not available"
    fi
    
    echo ""
    echo "Quick Commands:"
    echo "  View logs:     ssh -i $SSH_KEY_PATH ubuntu@$INSTANCE_IP 'docker compose logs -f'"
    echo "  Restart:       ssh -i $SSH_KEY_PATH ubuntu@$INSTANCE_IP 'docker compose restart'"
    echo "  OpenClaw TUI:  ssh -i $SSH_KEY_PATH ubuntu@$INSTANCE_IP 'docker exec -it openclaw openclaw tui'"
    echo "  Doctor:        ssh -i $SSH_KEY_PATH ubuntu@$INSTANCE_IP 'docker exec openclaw openclaw doctor'"
    echo ""
}

# =============================================================================
# Main
# =============================================================================

main() {
    echo "OpenClaw Health Check"
    echo "====================="
    echo "Time: $(date -Iseconds)"
    
    check_local_prerequisites
    check_instance_connectivity
    check_instance_health
    check_containers
    check_openclaw_health
    show_summary
    
    echo "Health check complete!"
}

# Run main function
main "$@"
