#!/bin/bash

# Check version consistency between package.json and src/lib/version.ts
# This script ensures every deployment uses the correct intended version.

# Get current branch
BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Extract version from package.json
PKG_VERSION=$(node -p "require('./package.json').version")

# Extract version from src/lib/version.ts (looking for the comment // v1.2.3)
TS_VERSION=$(grep -oP '// v\K[0-9]+\.[0-9]+\.[0-9]+' src/lib/version.ts)

echo "🔍 Checking version consistency..."
echo "   package.json:   v$PKG_VERSION"
echo "   src/lib/version.ts: v$TS_VERSION"

# 1. Check for consistency
if [ "$PKG_VERSION" != "$TS_VERSION" ]; then
  echo "❌ ERROR: Version mismatch detected!"
  echo "   package.json ($PKG_VERSION) does not match src/lib/version.ts ($TS_VERSION)"
  echo "   Please align both files before committing."
  exit 1
fi

# 2. Skip bump check on main branch or merge commits
if [ "$BRANCH" = "main" ] || [ -f .git/MERGE_HEAD ]; then
  echo "✅ Version consistency check passed"
  exit 0
fi

# 3. Check if version was actually modified in this commit
if git diff --cached --name-only | grep -qE "src/lib/version.ts|package.json"; then
  echo "✅ Version bump detected and consistent"
  exit 0
fi

# 4. Allow same version if it's already higher than main
echo "🔍 Comparing with main branch version..."
git fetch origin main --quiet 2>/dev/null || true
MAIN_VERSION=$(git show origin/main:package.json 2>/dev/null | node -p "JSON.parse(fs.readFileSync(0, 'utf-8')).version" 2>/dev/null || echo "0.0.0")

# Function to convert version string to comparable integer
version_to_int() {
    local v=$1
    # Remove 'v' prefix if present
    v=${v#v}
    # Split by dot and pad with zeros to ensure correct comparison (e.g. 1.10.0 > 1.2.0)
    printf "%03d%03d%03d" $(echo "$v" | tr '.' ' ')
}

if [ $(version_to_int "$PKG_VERSION") -gt $(version_to_int "$MAIN_VERSION") ]; then
  echo "✅ Version v$PKG_VERSION is already higher than main (v$MAIN_VERSION)"
  exit 0
fi

# 5. Enforce bump on ALL branches (every commit eventually deploys to staging via PR)
echo "⚠️  WARNING: Version not bumped in v$PKG_VERSION"
echo "   Every commit must bump the version — all branches deploy to staging."
echo "   Update both package.json and src/lib/version.ts before committing."
exit 1
