#!/bin/bash
set -e

# DAATAN Deployment Scripts Test Suite
# Tests rollback and blue-green deployment scripts locally

echo "🧪 DAATAN Deployment Scripts Test Suite"
echo "======================================"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0

# Helper functions
test_start() {
    echo -e "${BLUE}▶ Testing: $1${NC}"
}

test_pass() {
    echo -e "${GREEN}✓ PASS: $1${NC}"
    ((TESTS_PASSED++))
}

test_fail() {
    echo -e "${RED}✗ FAIL: $1${NC}"
    ((TESTS_FAILED++))
}

# Test 1: Check if scripts exist
test_start "Scripts exist"
if [ -f "$SCRIPT_DIR/rollback.sh" ] && [ -f "$SCRIPT_DIR/blue-green-deploy.sh" ]; then
    test_pass "Both scripts found"
else
    test_fail "One or more scripts missing"
fi

# Test 2: Check if scripts are executable
test_start "Scripts are executable"
if [ -x "$SCRIPT_DIR/rollback.sh" ] && [ -x "$SCRIPT_DIR/blue-green-deploy.sh" ]; then
    test_pass "Both scripts are executable"
else
    test_fail "One or more scripts not executable"
    chmod +x "$SCRIPT_DIR/rollback.sh" "$SCRIPT_DIR/blue-green-deploy.sh"
    echo "  Fixed: Made scripts executable"
fi

# Test 3: Check bash syntax
test_start "Bash syntax validation"
if bash -n "$SCRIPT_DIR/rollback.sh" 2>/dev/null && bash -n "$SCRIPT_DIR/blue-green-deploy.sh" 2>/dev/null; then
    test_pass "Both scripts have valid bash syntax"
else
    test_fail "One or more scripts have syntax errors"
fi

# Test 4: Check for required commands in rollback.sh
test_start "Rollback script dependencies"
REQUIRED_CMDS=("git" "docker" "grep" "sed")
MISSING_CMDS=()
for cmd in "${REQUIRED_CMDS[@]}"; do
    if ! command -v "$cmd" &> /dev/null; then
        MISSING_CMDS+=("$cmd")
    fi
done

if [ ${#MISSING_CMDS[@]} -eq 0 ]; then
    test_pass "All required commands available"
else
    test_fail "Missing commands: ${MISSING_CMDS[*]}"
fi

# Test 5: Check for required commands in blue-green-deploy.sh
test_start "Blue-green script dependencies"
REQUIRED_CMDS=("docker" "grep" "sed" "sleep")
MISSING_CMDS=()
for cmd in "${REQUIRED_CMDS[@]}"; do
    if ! command -v "$cmd" &> /dev/null; then
        MISSING_CMDS+=("$cmd")
    fi
done

if [ ${#MISSING_CMDS[@]} -eq 0 ]; then
    test_pass "All required commands available"
else
    test_fail "Missing commands: ${MISSING_CMDS[*]}"
fi

# Test 6: Check if verify scripts exist
test_start "Verify scripts exist"
VERIFY_MISSING=()
for script in verify-health.sh verify-logs.sh verify-deploy.sh; do
    if [ ! -f "$SCRIPT_DIR/$script" ]; then
        VERIFY_MISSING+=("$script")
    fi
done
if [ ${#VERIFY_MISSING[@]} -eq 0 ]; then
    test_pass "verify-health.sh, verify-logs.sh, verify-deploy.sh found"
else
    test_fail "Missing: ${VERIFY_MISSING[*]}"
fi

# Test 7: Check docker-compose file
test_start "Docker-compose file validation"
if [ -f "$PROJECT_ROOT/docker-compose.prod.yml" ]; then
    test_pass "docker-compose.prod.yml found"
else
    test_fail "docker-compose.prod.yml not found"
fi

# Test 8: Check nginx config
test_start "Nginx config validation"
if [ -f "$PROJECT_ROOT/nginx-ssl.conf" ]; then
    test_pass "nginx-ssl.conf found"
else
    test_fail "nginx-ssl.conf not found"
fi

# Test 9: Validate nginx config syntax (if docker available)
test_start "Nginx config syntax check"
if command -v docker &> /dev/null; then
    if docker run --rm -v "$PROJECT_ROOT/nginx-ssl.conf:/etc/nginx/nginx.conf:ro" nginx:alpine nginx -t 2>&1 | grep -q "successful"; then
        test_pass "Nginx config syntax is valid"
    else
        # nginx -t returns 0 even with warnings, so we check differently
        if docker run --rm -v "$PROJECT_ROOT/nginx-ssl.conf:/etc/nginx/nginx.conf:ro" nginx:alpine nginx -t 2>&1 | grep -q "emerg"; then
            test_fail "Nginx config has errors"
        else
            test_pass "Nginx config syntax is valid (with warnings)"
        fi
    fi
else
    echo "  ⊘ Skipped: Docker not available"
fi

# Test 10: Check .env file
test_start ".env file exists"
if [ -f "$PROJECT_ROOT/.env" ]; then
    test_pass ".env file found"
    # Check for required variables
    REQUIRED_VARS=("POSTGRES_PASSWORD" "NEXTAUTH_SECRET" "GOOGLE_CLIENT_ID" "GOOGLE_CLIENT_SECRET")
    MISSING_VARS=()
    for var in "${REQUIRED_VARS[@]}"; do
        if ! grep -q "^$var=" "$PROJECT_ROOT/.env"; then
            MISSING_VARS+=("$var")
        fi
    done
    if [ ${#MISSING_VARS[@]} -eq 0 ]; then
        test_pass "All required environment variables present"
    else
        test_fail "Missing environment variables: ${MISSING_VARS[*]}"
    fi
else
    test_fail ".env file not found"
fi

# Test 11: Check git repository
test_start "Git repository validation"
if cd "$PROJECT_ROOT" && git rev-parse --git-dir > /dev/null 2>&1; then
    test_pass "Valid git repository"
    
    # Check if we can get commit history
    if git log -1 --oneline > /dev/null 2>&1; then
        test_pass "Git history accessible"
    else
        test_fail "Cannot access git history"
    fi
else
    test_fail "Not a valid git repository"
fi

# Test 12: Check package.json
test_start "package.json validation"
if [ -f "$PROJECT_ROOT/package.json" ]; then
    test_pass "package.json found"
    
    # Check if build script exists
    if grep -q '"build"' "$PROJECT_ROOT/package.json"; then
        test_pass "Build script defined"
    else
        test_fail "Build script not defined"
    fi
else
    test_fail "package.json not found"
fi

# Summary
echo ""
echo "======================================"
echo -e "Test Results:"
echo -e "${GREEN}✓ Passed: $TESTS_PASSED${NC}"
echo -e "${RED}✗ Failed: $TESTS_FAILED${NC}"
echo "======================================"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed. Please review above.${NC}"
    exit 1
fi
