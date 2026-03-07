#!/bin/bash
# check-env-parity.sh — Verify that blue-green-deploy.sh and docker-compose.prod.yml
# pass the same set of environment variables to the app container.
#
# Run in CI on every PR to catch env var drift before it reaches production.
# Usage: ./scripts/check-env-parity.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."

BLUE_GREEN="$ROOT/scripts/blue-green-deploy.sh"
COMPOSE="$ROOT/docker-compose.prod.yml"

# Extract env keys from blue-green-deploy.sh:
#   ENV_ARGS="$ENV_ARGS -e KEY=..."  or  ENV_ARGS="$ENV_ARGS -e KEY=${VAR}"
blue_green_keys() {
  grep -oP '(?<=-e )[A-Z_]+(?==)' "$BLUE_GREEN" | sort -u
}

# Extract env keys from docker-compose.prod.yml app service (between "app:" and "app-staging:").
# Matches lines of the form:  - KEY=...  or  - KEY=${VAR}
compose_app_keys() {
  awk '/^  app:$/,/^  app-staging:$/' "$COMPOSE" \
    | grep -oP '(?<=- )[A-Z_]+(?==)' \
    | sort -u
}

BG=$(blue_green_keys)
CP=$(compose_app_keys)

# Keys in blue-green but not in compose
only_bg=$(comm -23 <(echo "$BG") <(echo "$CP"))
# Keys in compose but not in blue-green
only_cp=$(comm -13 <(echo "$BG") <(echo "$CP"))

FAIL=0

if [[ -n "$only_bg" ]]; then
  echo "FAIL: env vars in blue-green-deploy.sh but NOT in docker-compose.prod.yml (app service):"
  echo "$only_bg" | sed 's/^/  - /'
  FAIL=1
fi

if [[ -n "$only_cp" ]]; then
  echo "FAIL: env vars in docker-compose.prod.yml (app service) but NOT in blue-green-deploy.sh:"
  echo "$only_cp" | sed 's/^/  - /'
  FAIL=1
fi

if [[ $FAIL -eq 0 ]]; then
  echo "OK: blue-green-deploy.sh and docker-compose.prod.yml app env vars are in sync."
  echo "    ($(echo "$BG" | wc -l | tr -d ' ') vars checked)"
fi

exit $FAIL
