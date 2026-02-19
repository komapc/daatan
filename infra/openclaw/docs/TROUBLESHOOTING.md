# OpenClaw EC2 Deployment - Troubleshooting Guide

## Quick Reference

| Symptom | Likely Cause | Solution |
|---------|--------------|----------|
| "HTTP 401: User not found" | Invalid OpenRouter API key | Update key in `.env` and restart container |
| No response from bot | Container has old env vars | Full restart: `docker compose down && docker compose up -d` |
| "User not authorized" | User not in allowFrom list | Set `allowFrom: ["*"]` in config |
| Bot not receiving messages | Telegram polling stopped | Check `openclaw channels status` |

---

## Common Issues

### 1. HTTP 401: User not found

**Symptom:** Every message to the bot returns "HTTP 401: User not found."

**Cause:** OpenRouter API key is invalid, expired, or the container has an old key cached.

**Solution:**

```bash
# 1. Update .env with new key
cd ~/projects/openclaw
nano .env  # Replace OPENROUTER_API_KEY

# 2. Full container restart (required!)
docker compose down
docker compose up -d

# 3. Verify new key is loaded
docker exec openclaw env | grep OPENROUTER

# 4. Test the key directly
curl -X POST "https://openrouter.ai/api/v1/chat/completions" \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen/qwen-2.5-7b-instruct","messages":[{"role":"user","content":"Hello"}]}'
```

**Expected result:** Should return a valid response with `choices[0].message.content`

---

### 2. Bot Not Responding (No Error)

**Symptom:** Bot receives messages but doesn't respond.

**Cause:** Telegram polling may have stopped or config issue.

**Solution:**

```bash
# Check channel status
docker exec openclaw npx --yes openclaw channels status

# Expected output:
# - Telegram daatan (Daatan): enabled, configured, running, mode:polling

# If not running, restart container
docker compose restart openclaw

# Check logs for errors
docker compose logs -f openclaw | grep -i telegram
```

---

### 3. User Not Authorized

**Symptom:** "You are not authorized to use this command."

**Cause:** User ID not in `allowFrom` list.

**Solution:**

Edit `~/.openclaw/openclaw.json`:

```json
{
  "channels": {
    "telegram": {
      "allowFrom": ["*"],
      "accounts": {
        "daatan": {
          "allowFrom": ["*"],
          "dmPolicy": "open"
        }
      }
    }
  }
}
```

Then restart:
```bash
docker compose restart openclaw
```

---

### 4. Container Won't Start

**Symptom:** `docker compose up -d` fails or container exits immediately.

**Solution:**

```bash
# Check logs
docker compose logs openclaw

# Common fixes:
# 1. Check .env file exists and has all required keys
cat ~/projects/openclaw/.env

# 2. Check config is valid JSON
docker exec openclaw cat /home/node/.openclaw/openclaw.json | jq .

# 3. Clear cache and restart
docker compose down
rm -rf /tmp/openclaw/*
docker compose up -d
```

---

## Maintenance Commands

### Check Bot Status

```bash
docker exec openclaw npx --yes openclaw channels status
```

### View Logs

```bash
# Real-time logs
docker compose logs -f openclaw

# Last 100 lines
docker compose logs --tail=100 openclaw

# Search for errors
docker compose logs 2>&1 | grep -i error
```

### Update API Keys

```bash
cd ~/projects/openclaw

# Edit .env
nano .env

# Restart container (REQUIRED - env vars are loaded at startup)
docker compose down
docker compose up -d

# Verify
docker exec openclaw env | grep -E 'OPENROUTER|TELEGRAM'
```

### Backup Configuration

```bash
# Backup .env
cp ~/projects/openclaw/.env ~/projects/openclaw/.env.backup.$(date +%Y%m%d)

# Backup openclaw.json
docker exec openclaw cat /home/node/.openclaw/openclaw.json > ~/openclaw-config-backup.json
```

### Test OpenRouter Key

```bash
# Replace YOUR_KEY with actual key
curl -s -X POST "https://openrouter.ai/api/v1/chat/completions" \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen/qwen-2.5-7b-instruct",
    "messages": [{"role": "user", "content": "Hello"}]
  }' | jq '.choices[0].message.content'
```

---

## Configuration Files

### .env (Host: ~/projects/openclaw/.env)

```bash
# OpenRouter API Key (required)
OPENROUTER_API_KEY=sk-or-v1-...

# Telegram Bot Tokens (required)
TELEGRAM_BOT_TOKEN_DAATAN=123456:ABC...
TELEGRAM_BOT_TOKEN_CALENDAR=789012:DEF...

# Your Telegram Chat ID (for notifications)
TELEGRAM_CHAT_ID=188323801
```

### openclaw.json (Container: /home/node/.openclaw/openclaw.json)

Auto-generated from `.env` at container startup. Do NOT edit manually - changes will be overwritten.

---

## Emergency Procedures

### Bot Completely Broken

```bash
# 1. Stop container
docker compose down

# 2. Clear all caches
rm -rf /tmp/openclaw/*
rm -rf ~/.openclaw/*

# 3. Recreate config from .env
docker compose up -d

# 4. Wait 30 seconds for initialization
sleep 30

# 5. Check status
docker exec openclaw npx --yes openclaw channels status
```

### Lost API Keys

1. **OpenRouter:** Visit https://openrouter.ai/keys to generate new key
2. **Telegram:** Message @BotFather to create new bot or get existing token

Then update `.env` and restart container.

---

## Support Resources

- **OpenClaw Docs:** https://docs.openclaw.ai
- **OpenRouter:** https://openrouter.ai
- **Telegram Bot API:** https://core.telegram.org/bots/api
- **GitHub Issues:** https://github.com/openclaw/openclaw/issues
