# Deploying NanoClaw with LiteLLM (Gemini Backend)

This documents the Daatan deployment of NanoClaw using Google Gemini via LiteLLM
as the LLM backend instead of the default Anthropic API.

## Architecture

```
Browser → nginx :443 → nanoclaw :18789 (web channel, port 3000 internally)
                           ↓
                    agent container (nanoclaw-agent:latest)
                    ANTHROPIC_BASE_URL=http://host:3001
                           ↓
                    credential proxy :3001 (inside nanoclaw, exposed to host)
                    reads ANTHROPIC_BASE_URL from .env → forwards to LiteLLM
                           ↓
                    litellm :4000
                           ↓
                    Google Gemini API
```

## Prerequisites

- Docker + Docker Compose v2
- Root access (needed for /app symlink)
- Google Gemini API key (console.cloud.google.com)

## First-time Setup

```bash
git clone <repo>
cd nanoclaw

# 1. Required: symlink /app to this directory so Docker sibling container
#    volume mount paths resolve correctly (DinD path fix)
sudo ln -s "$(pwd)" /app

# 2. Configure environment
cp .env.example .env
# Edit .env and set GEMINI_API_KEY=your-key-here

# 3. Build images
docker build -t nanoclaw-agent:latest -f container/Dockerfile container/
docker compose build

# 4. Start
docker compose up -d
```

## Switching Models

Edit `litellm_config.yaml` to change the Gemini model:

```bash
# Switch to Gemini 3 Pro (smarter)
sed -i "s|gemini-3-flash-preview|gemini-3-pro-preview|g" litellm_config.yaml
docker restart litellm

# Switch back to Flash (faster)
sed -i "s|gemini-3-pro-preview|gemini-3-flash-preview|g" litellm_config.yaml
docker restart litellm
```

Or use the `/model` skill in the chat (switches for the current session):
- `/model flash` — Gemini 3 Flash (default, fast)
- `/model pro` — Gemini 3 Pro (smarter, slower)

## Key Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Defines nanoclaw + litellm services |
| `litellm_config.yaml` | LiteLLM model routing (Gemini backend) |
| `.env` | Secrets — not committed, see `.env.example` |
| `Dockerfile.orchestrator` | Custom orchestrator image with Docker CLI |
| `src/web-channel.ts` | Web chat channel (HTTP + WebSocket on port 3000) |
| `container/skills/model/` | `/model` slash command skill |

## Important Notes

### /app symlink (critical)
NanoClaw runs inside Docker but spawns sibling containers via the Docker socket.
Volume mount paths must resolve on the HOST. The orchestrator uses `process.cwd()`
(`/app` inside container) as path prefix for all mounts. Without the symlink,
Docker auto-creates an empty `/app/` directory on the host and mounts empty
dirs into agent containers (breaking TypeScript compilation).

### Port 3001 (credential proxy)
The credential proxy runs inside the nanoclaw container on port 3001 and MUST
be exposed to the host. Agent containers connect to it via `host.docker.internal:3001`.

### IPC permissions
The orchestrator runs as root but agent containers run as `node` (uid 1000).
The IPC input directory is created with chmod 777 so agents can delete their
own input files after processing.

## Nginx Config

See `nginx/mission.daatan.com.conf` for the nginx reverse proxy config.
WebSocket endpoint proxied at `/ws`, static files at `/`.