#!/bin/bash
#
# DAaTAn Release Script
# Creates a version tag and GitHub release, triggering production deployment
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  DAaTAn Release Script${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check we're on main branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo -e "${YELLOW}⚠️  You're on branch '$CURRENT_BRANCH', not 'main'${NC}"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}Aborted.${NC}"
        exit 1
    fi
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo -e "${RED}❌ You have uncommitted changes. Please commit or stash them first.${NC}"
    git status --short
    exit 1
fi

# Pull latest
echo -e "${BLUE}📥 Pulling latest changes...${NC}"
git pull origin main --quiet

# Get latest tag
LATEST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "v0.0.0")
echo -e "Latest version: ${GREEN}$LATEST_TAG${NC}"

# Parse version components
VERSION_REGEX="v([0-9]+)\.([0-9]+)\.([0-9]+)"
if [[ $LATEST_TAG =~ $VERSION_REGEX ]]; then
    MAJOR="${BASH_REMATCH[1]}"
    MINOR="${BASH_REMATCH[2]}"
    PATCH="${BASH_REMATCH[3]}"
else
    MAJOR=0
    MINOR=0
    PATCH=0
fi

# Suggest next versions
NEXT_PATCH="v$MAJOR.$MINOR.$((PATCH + 1))"
NEXT_MINOR="v$MAJOR.$((MINOR + 1)).0"
NEXT_MAJOR="v$((MAJOR + 1)).0.0"

echo ""
echo -e "${YELLOW}Select version bump:${NC}"
echo -e "  1) Patch  → ${GREEN}$NEXT_PATCH${NC}  (bug fixes)"
echo -e "  2) Minor  → ${GREEN}$NEXT_MINOR${NC}  (new features)"
echo -e "  3) Major  → ${GREEN}$NEXT_MAJOR${NC}  (breaking changes)"
echo -e "  4) Custom (enter manually)"
echo ""

read -p "Choice [1-4]: " -n 1 CHOICE
echo ""

case $CHOICE in
    1) NEW_VERSION=$NEXT_PATCH ;;
    2) NEW_VERSION=$NEXT_MINOR ;;
    3) NEW_VERSION=$NEXT_MAJOR ;;
    4) 
        read -p "Enter version (e.g., v1.2.3): " NEW_VERSION
        if [[ ! $NEW_VERSION =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
            echo -e "${RED}❌ Invalid version format. Use vX.Y.Z${NC}"
            exit 1
        fi
        ;;
    *)
        echo -e "${RED}❌ Invalid choice${NC}"
        exit 1
        ;;
esac

# Check if tag already exists
if git rev-parse "$NEW_VERSION" >/dev/null 2>&1; then
    echo -e "${RED}❌ Tag $NEW_VERSION already exists!${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}📝 Enter release notes (end with empty line):${NC}"
RELEASE_NOTES=""
while IFS= read -r line; do
    [ -z "$line" ] && break
    RELEASE_NOTES+="$line"$'\n'
done

# Default release notes if empty
if [ -z "$RELEASE_NOTES" ]; then
    RELEASE_NOTES="Release $NEW_VERSION"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Review:${NC}"
echo -e "  Version:  ${GREEN}$NEW_VERSION${NC}"
echo -e "  Branch:   ${GREEN}$CURRENT_BRANCH${NC}"
echo -e "  Notes:    ${GREEN}${RELEASE_NOTES:0:50}...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}⚠️  This will trigger a PRODUCTION deployment!${NC}"
read -p "Create release $NEW_VERSION? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}Aborted.${NC}"
    exit 1
fi

# Create and push tag
echo -e "${BLUE}🏷️  Creating tag $NEW_VERSION...${NC}"
git tag -a "$NEW_VERSION" -m "$RELEASE_NOTES"

echo -e "${BLUE}📤 Pushing tag to origin...${NC}"
git push origin "$NEW_VERSION"

# Create GitHub release
echo -e "${BLUE}🚀 Creating GitHub release...${NC}"
gh release create "$NEW_VERSION" \
    --title "$NEW_VERSION" \
    --notes "$RELEASE_NOTES"

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Release $NEW_VERSION created successfully!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "📦 GitHub Release: ${BLUE}https://github.com/komapc/daatan/releases/tag/$NEW_VERSION${NC}"
echo -e "🔄 GitHub Actions: ${BLUE}https://github.com/komapc/daatan/actions${NC}"
echo ""
echo -e "${YELLOW}Production deployment triggered. Monitor Actions for progress.${NC}"

