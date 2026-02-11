#!/bin/bash
# Setup OpenClaw on EC2: clone both repos to ~/projects/, bootstrap calendar agent, start containers.
# Run after: scp -r infra/openclaw ubuntu@<IP>:~/projects/
# Prerequisite: Add ~/.ssh/id_github.pub to GitHub as deploy key for daatan and year-shape repos.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OPENCLAW_DIR="$(dirname "$SCRIPT_DIR")"
PROJECTS="$HOME/projects"

mkdir -p "$PROJECTS" && cd "$PROJECTS"
export GIT_SSH_COMMAND="ssh -i $HOME/.ssh/id_github -o IdentitiesOnly=yes"

if [ -d "daatan" ]; then
  (cd daatan && git pull)
else
  git clone git@github.com:komapc/daatan.git
fi
if [ -d "year-shape" ]; then
  (cd year-shape && git pull)
else
  git clone git@github.com:komapc/year-shape.git
fi

# Copy calendar agent bootstrap into year-shape repo
mkdir -p year-shape/agents/main
cp "$OPENCLAW_DIR/calendar-agent-bootstrap/agents/main/SOUL.md" year-shape/agents/main/
cp "$OPENCLAW_DIR/calendar-agent-bootstrap/agents/main/AGENTS.md" year-shape/agents/main/

# Config and docker-compose are already at ~/projects/openclaw/ (from scp)

if [ ! -f "$PROJECTS/openclaw/.env" ]; then
  echo "ERROR: Create $PROJECTS/openclaw/.env with GEMINI_API_KEY, TELEGRAM_CHAT_ID, TELEGRAM_BOT_TOKEN_DAATAN, TELEGRAM_BOT_TOKEN_CALENDAR"
  exit 1
fi

cd "$PROJECTS/openclaw"
# Use sg docker so it works even before ubuntu user has logged out/in after usermod -aG docker
sg docker -c "docker compose up -d"
echo "OpenClaw agents started. Check: sg docker -c 'docker compose ps'"
