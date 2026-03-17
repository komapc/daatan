#!/bin/bash
# NanoClaw + LiteLLM (Gemini) deployment setup
# Run as root on the target server (Ubuntu/Debian, Docker installed)
set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
echo "Setting up NanoClaw at: $PROJECT_DIR"

# 1. Create /app symlink so Docker sibling container paths resolve correctly
if [ ! -L /app ] && [ ! -d /app ]; then
  ln -s "$PROJECT_DIR" /app
  echo "Created /app -> $PROJECT_DIR"
elif [ -L /app ]; then
  echo "/app symlink already exists -> $(readlink /app)"
elif [ -d /app ] && [ ! -L /app ]; then
  echo "WARNING: /app is a real directory. Remove it and re-run if paths break."
  echo "  sudo rm -rf /app && sudo ln -s $PROJECT_DIR /app"
fi

# 2. Create .env from example if missing
if [ ! -f "$PROJECT_DIR/.env" ]; then
  cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
  echo "Created .env from .env.example — fill in your API keys"
  exit 1
else
  echo ".env already exists"
fi

# 3. Create data directories
mkdir -p "$PROJECT_DIR/data/sessions/main" "$PROJECT_DIR/data/ipc/main/input"
chmod 777 "$PROJECT_DIR/data/ipc/main/input"
echo "Created data directories"

# 4. Start services
docker compose up -d
echo ""
echo "Done! Services:"
docker ps --filter name=nanoclaw --filter name=litellm --format "  {{.Names}}: {{.Status}}"
echo ""
echo "Web chat: http://localhost:18789"