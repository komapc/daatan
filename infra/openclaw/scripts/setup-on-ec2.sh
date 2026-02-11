#!/bin/bash
# Setup OpenClaw on EC2: clone both repos, copy configs, start agents.
# Run from a directory containing infra/openclaw/ (e.g. after scp -r infra/openclaw ubuntu@<IP>:~/)
# Prerequisite: Add ~/.ssh/id_github.pub to GitHub as deploy key for daatan and year-shape repos.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OPENCLAW_DIR="$(dirname "$SCRIPT_DIR")"
TARGET="$HOME/openclaw"

mkdir -p "$TARGET" && cd "$TARGET"
export GIT_SSH_COMMAND="ssh -i $HOME/.ssh/id_github -o IdentitiesOnly=yes"

if [ ! -d "daatan" ]; then
  git clone git@github.com:komapc/daatan.git
fi
if [ ! -d "calendar" ]; then
  git clone git@github.com:komapc/year-shape.git calendar
fi

# Copy calendar agent bootstrap into calendar repo
mkdir -p calendar/agents/main
cp "$OPENCLAW_DIR/calendar-agent-bootstrap/agents/main/SOUL.md" calendar/agents/main/
cp "$OPENCLAW_DIR/calendar-agent-bootstrap/agents/main/AGENTS.md" calendar/agents/main/

# Copy config and docker-compose
cp -r "$OPENCLAW_DIR/config" "$TARGET/"
cp "$OPENCLAW_DIR/docker-compose.yml" "$TARGET/"

# Ensure docker-compose uses correct config paths (config/ is now in TARGET)
# The compose file expects ./config/daatan.json and ./config/calendar.json - we copied them
# Volumes: ./daatan, ./calendar - we have those. Good.

if [ ! -f "$TARGET/.env" ]; then
  echo "ERROR: Create $TARGET/.env with GEMINI_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID"
  exit 1
fi

cd "$TARGET"
docker compose up -d
echo "OpenClaw agents started. Check: docker compose ps"
