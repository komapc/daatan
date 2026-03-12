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

# 4. Enforce bump for feat/fix branches
if [[ "$BRANCH" =~ ^(feat|fix|feature)/ ]]; then
  echo "⚠️  WARNING: Version not bumped in v$PKG_VERSION"
  echo "   Please update both package.json and src/lib/version.ts before committing."
  exit 1
fi

echo "✅ Version check passed"
exit 0
