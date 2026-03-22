#!/bin/bash

# Check version consistency between package.json and src/lib/version.ts.
# Versions must match when both files are touched — but bumping on feature
# branches is not required. Version is bumped once in a release commit on main.

PKG_VERSION=$(node -p "require('./package.json').version")
TS_VERSION=$(grep -oP '// v\K[0-9]+\.[0-9]+\.[0-9]+' src/lib/version.ts)

echo "🔍 Checking version consistency..."
echo "   package.json:       v$PKG_VERSION"
echo "   src/lib/version.ts: v${TS_VERSION:-<no comment>}"

# If both files were staged, they must agree
STAGED=$(git diff --cached --name-only)
PKG_STAGED=$(echo "$STAGED" | grep -c "package.json" || true)
TS_STAGED=$(echo "$STAGED" | grep -c "src/lib/version.ts" || true)

if [ -n "$TS_VERSION" ] && [ "$PKG_VERSION" != "$TS_VERSION" ]; then
  echo "❌ ERROR: Version mismatch!"
  echo "   package.json ($PKG_VERSION) does not match src/lib/version.ts ($TS_VERSION)"
  echo "   Align both files before committing."
  exit 1
fi

echo "✅ Version consistency check passed"
exit 0
