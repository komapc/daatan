# OpenRouter Budget-Friendly Models

**Budget:** $5/month  
**Key:** `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`

---

## Recommended Models (Cheapest First)

| Model | Price/1K Tokens | Tokens/$5 | Best For |
|-------|-----------------|-----------|----------|
| **qwen-2.5-7b-instruct** | $0.00035 | ~14M | Simple Q&A, health checks |
| **qwen-2.5-14b-instruct** | $0.00050 | ~10M | Code assistance, debugging |
| **qwen-2.5-32b-instruct** | $0.00060 | ~8M | Complex reasoning |
| **qwen-2.5-72b-instruct** | $0.00080 | ~6M | Best quality fallback |

---

## Current Configuration

```json
{
  "routing": {
    "fallback": "openrouter/qwen/qwen-2.5-7b-instruct"
  }
}
```

**Why 7B?** Best value for money. Good enough for most fallback scenarios.

---

## Usage Estimates

### Daatan Platform (Typical Day)

| Activity | Tokens/Day | Cost/Day | Cost/Month |
|----------|------------|----------|------------|
| **Light** (10 forecasts, 50 messages) | 20K | $0.007 | $0.21 |
| **Medium** (30 forecasts, 200 messages) | 100K | $0.035 | $1.05 |
| **Heavy** (100 forecasts, 1K messages) | 500K | $0.175 | $5.25 |

**With $5 budget:** Up to **Medium** usage + occasional Heavy days.

---

## Cost Optimization Tips

### 1. Use Local Fallback First

```json
{
  "routing": {
    "fallback": "openrouter/qwen/qwen-2.5-7b-instruct",
    "localFallback": "ollama/qwen2.5:1.5b"
  }
}
```

**Strategy:** Local handles 80% of fallback cases, cloud only for complex queries.

**Savings:** ~60-80% on cloud costs.

---

### 2. Set Per-Agent Limits

```json
{
  "agents": {
    "daatan": {
      "model": {
        "fallback": "openrouter/qwen/qwen-2.5-7b-instruct"
      }
    },
    "calendar": {
      "model": {
        "fallback": "ollama/qwen2.5:1.5b"
      }
    }
  }
}
```

**Why:** Calendar agent does simpler tasks → use local only.

---

### 3. Monitor Usage

```bash
# Check OpenRouter usage
curl -H "Authorization: Bearer sk-or-..." \
  https://openrouter.ai/api/v1/usage

# Or visit: https://openrouter.ai/activity
```

---

### 4. Upgrade Model Only When Needed

```json
{
  "agents": {
    "daatan": {
      "model": {
        "fallback": "openrouter/qwen/qwen-2.5-7b-instruct",
        "complex": "openrouter/qwen/qwen-2.5-72b-instruct"
      }
    }
  }
}
```

**Usage:** 72B only for complex code review, architecture decisions.

---

## Budget Alerts

### OpenRouter Dashboard

1. Visit: https://openrouter.ai/settings
2. Set spending limit: $5/month
3. Enable email alerts at: $4 (80%), $4.50 (90%), $5 (100%)

### Manual Tracking

```bash
# Add to crontab (weekly check)
0 9 * * 1 curl -s -H "Authorization: Bearer sk-or-..." \
  https://openrouter.ai/api/v1/usage | jq '.total_cost'
```

---

## Fallback Chain (Optimized)

```
┌─────────────────────────────────────────┐
│  Primary: google/gemini-1.5-pro         │
│  (Your main model, best quality)        │
└─────────────────┬───────────────────────┘
                  │ (Gemini unavailable or quota exhausted)
                  ▼
┌─────────────────────────────────────────┐
│  Fallback: openrouter/qwen-2.5-7b       │
│  ($0.00035/1K tokens, good quality)     │
└─────────────────┬───────────────────────┘
                  │ (OpenRouter fails or budget exceeded)
                  ▼
┌─────────────────────────────────────────┐
│  Local: ollama/qwen2.5:1.5b             │
│  (Free, always available)               │
└─────────────────────────────────────────┘
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
