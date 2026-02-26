#!/bin/bash

# Check if version was bumped in src/lib/version.ts
# This script should be run in pre-commit or CI

# Get the current branch
BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Skip check on main branch (version already bumped)
if [ "$BRANCH" = "main" ]; then
  exit 0
fi

# Skip check on merge commits (conflicts already resolved; version bumped in prior commit)
if [ -f .git/MERGE_HEAD ]; then
  exit 0
fi

# Check if version.ts was modified
if git diff --cached --name-only | grep -q "src/lib/version.ts"; then
  echo "✅ Version file modified"
  exit 0
fi

# Check if this is a feature/fix branch (not chore, docs, etc.)
if [[ "$BRANCH" =~ ^(feat|fix|feature)/ ]]; then
  echo "⚠️  WARNING: Version not bumped in src/lib/version.ts"
  echo "   Please update the version before committing."
  echo "   Current version: $(grep "VERSION = " src/lib/version.ts)"
  exit 1
fi

# For other branch types, just warn but don't fail
if [[ "$BRANCH" != "main" ]]; then
  echo "ℹ️  Note: Consider bumping version in src/lib/version.ts for this change"
fi

exit 0
