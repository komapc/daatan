#!/bin/bash
#
# DAATAN Local Verification Script
# Comprehensive verification that developers can run manually before pushing
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 DAATAN Local Verification${NC}"
echo "============================"
echo ""

FAILED=0

# 1. Check Node version
echo -n "Checking Node.js version... "
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -ge 18 ]; then
  echo -e "${GREEN}OK${NC} ($(node -v))"
else
  echo -e "${RED}FAILED${NC}"
  echo -e "  Node.js 18+ required, found: $(node -v)"
  FAILED=1
fi

# 2. Verify dependencies
echo -n "Checking dependencies... "
if [ -d "node_modules" ]; then
  echo -e "${GREEN}OK${NC}"
else
  echo -e "${YELLOW}WARNING${NC}"
  echo "  node_modules not found. Run: npm install"
  FAILED=1
fi

# 3. Check for uncommitted changes
echo -n "Checking git status... "
if [ -z "$(git status --porcelain)" ]; then
  echo -e "${GREEN}Clean${NC}"
else
  echo -e "${YELLOW}Uncommitted changes${NC}"
  git status --short
fi

# 4. Verify environment variables
echo -n "Checking environment setup... "
if [ -f ".env" ] || [ -f ".env.local" ]; then
  echo -e "${GREEN}OK${NC}"
else
  echo -e "${YELLOW}WARNING${NC}"
  echo "  No .env file found (may be expected for build)"
fi

# 5. Run build
echo ""
echo -e "${BLUE}📦 Building application...${NC}"
export DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
export NEXTAUTH_SECRET="dummy-secret-for-build"
export NEXTAUTH_URL="http://localhost:3000"

if npm run build; then
  echo -e "${GREEN}✅ Build successful${NC}"
else
  echo -e "${RED}❌ Build failed${NC}"
  FAILED=1
fi

# 6. Run tests
echo ""
echo -e "${BLUE}🧪 Running tests...${NC}"
if npm test; then
  echo -e "${GREEN}✅ All tests passed${NC}"
else
  echo -e "${RED}❌ Tests failed${NC}"
  FAILED=1
fi

# 7. Run linter
echo ""
echo -e "${BLUE}🔍 Running linter...${NC}"
if npm run lint; then
  echo -e "${GREEN}✅ No linting issues${NC}"
else
  echo -e "${YELLOW}⚠️  Linting issues detected${NC}"
  # Don't fail on lint issues
fi

# Summary
echo ""
echo "============================"
if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ Local verification passed!${NC}"
  echo ""
  echo "Your code is ready to push."
  exit 0
else
  echo -e "${RED}❌ Local verification failed${NC}"
  echo ""
  echo "Please fix the issues above before pushing."
  exit 1
fi
