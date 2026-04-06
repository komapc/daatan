#!/bin/bash
# Pre-PR hook: blocks `gh pr create` until docs and tests are confirmed ready.
# Claude Code passes the tool input as JSON on stdin.

COMMAND=$(python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('command',''))" 2>/dev/null)

if echo "$COMMAND" | grep -q "gh pr create"; then
  echo "BLOCKED — pre-PR checklist not satisfied."
  echo ""
  echo "Before creating a PR you must:"
  echo "  1. Improve or add documentation for any changed behaviour"
  echo "  2. Add or update tests for changed code"
  echo ""
  echo "Steps:"
  echo "  a) Run /simplify to review code quality"
  echo "  b) Add missing tests (unit + integration where applicable)"
  echo "  c) Update relevant docs / comments / prompt files"
  echo "  d) Once done, re-run the PR creation command"
  exit 2
fi
