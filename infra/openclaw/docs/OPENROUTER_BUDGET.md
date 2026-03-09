# OpenRouter Budget-Friendly Models

**Budget:** $5/month  

---

## Recommended Models (Free Tier)

| Model | ID (use in config) | Context | Best For |
|-------|--------------------|---------|----------|
| **Gemini 2.0 Flash Exp** | `openrouter/google/gemini-2.0-flash-exp:free` | 1M | Primary model, fast & capable |
| **Llama 3.3 70B** | `openrouter/meta-llama/llama-3.3-70b-instruct:free` | 128k | High quality fallback |
| **Mistral Small 3** | `openrouter/mistralai/mistral-small-24b-instruct-2501:free` | 32k | Balanced fallback |
| **Best Available Free** | `openrouter/free` | Varies | Catch-all fallback |

---

## Current Configuration

```json
{
  "agents": {
    "defaults": {
      "model": "openrouter/google/gemini-2.0-flash-exp:free"
    }
  }
}
```

**Why Gemini 2.0 Flash?** Massive context window and state-of-the-art performance for a free model.

---

## Usage Estimates

### Daatan Platform (Typical Day)

| Activity | Tokens/Day | Cost/Day | Cost/Month |
|----------|------------|----------|------------|
| **Free Tier Models** | Any | $0.00 | $0.00 |

**With $5 budget:** Primarily used for non-free models if needed, otherwise $0.

---

## Cost Optimization Tips

### 1. Use Local Fallback

```json
{
  "auth": {
    "profiles": {
      "ollama:default": {
        "provider": "ollama",
        "mode": "api_key"
      }
    }
  }
}
```

**Strategy:** If OpenRouter is down or rate-limited, OpenClaw can fallback to local Ollama if configured.

---

### 2. Set Default Model

```json
{
  "agents": {
    "defaults": {
      "model": "openrouter/google/gemini-2.0-flash-exp:free"
    }
  }
}
```

---

### 3. Monitor Usage

```bash
# Check OpenRouter models
docker exec openclaw node openclaw.mjs models list
```

---

## Fallback Chain (Optimized)

```
┌─────────────────────────────────────────────────────┐
│  Primary: openrouter/google/gemini-2.0-flash:free   │
│  (Best free model, huge context)                    │
└─────────────────┬───────────────────────────────────┘
                  │ (Rate limited or unavailable)
                  ▼
┌─────────────────────────────────────────────────────┐
│  Fallback: openrouter/meta-llama/llama-3.3-70b:free │
│  (High intelligence, reliable)                      │
└─────────────────┬───────────────────────────────────┘
                  │ (Still unavailable)
                  ▼
┌─────────────────────────────────────────────────────┐
│  Last Resort: ollama/qwen2.5:1.5b                   │
│  (Local, free, always available)                    │
└─────────────────────────────────────────────────────┘
```

---

## Quick Reference

### Check Current Model

```bash
docker exec -it openclaw openclaw config get agents.list
```

### Force Model Change

```bash
# Edit config
nano infra/openclaw/config/unified.json

# Restart
docker compose restart
```

### Estimate Monthly Cost

```
Daily tokens × 30 × price_per_1K / 1000 = Monthly cost

Example: 100K tokens/day × 30 × $0.00035 / 1000 = $1.05/month
```

---

## Emergency: Budget Exceeded

If you hit $5 before month ends:

### Option 1: Disable Cloud Fallback

```json
{
  "routing": {
    "fallback": "ollama/qwen2.5:1.5b"
  }
}
```

### Option 2: Reduce Usage

- Pause non-essential agents
- Use `/compact` command to reduce context
- Switch to local-only mode

### Option 3: Add Temporary Funds

```bash
# Add $5 more at openrouter.ai/billing
# Or wait for next billing cycle
```

---

## Links

| Resource | URL |
|----------|-----|
| OpenRouter Dashboard | https://openrouter.ai |
| Usage/Activity | https://openrouter.ai/activity |
| Settings/Budget | https://openrouter.ai/settings |
| Model List | https://openrouter.ai/models?q=qwen |
| API Docs | https://openrouter.ai/docs |
