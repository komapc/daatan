# OpenClaw Backend Strategy

## TL;DR

| Phase | Backend | Config file | Monthly cost | When |
|---|---|---|---|---|
| **Now** (AWS credits) | Amazon Bedrock | `config/openclaw-bedrock.json` | ~$0 (credits) | Default until credits run out |
| **Later** (post-credits) | OpenRouter + LiteLLM | `config/openclaw-openrouter.json` | ~$1–5 | Switch when credits exhaust |

---

## Phase 1: Amazon Bedrock (use while credits last)

### Why Bedrock first

- **AWS credits cover the cost** — effectively free while they last
- **No API key** — auth via IAM instance profile; the EC2 role just works, nothing to rotate
- **No LiteLLM proxy needed** — one fewer service, simpler stack, `t3.medium` is sufficient
- **Stays inside AWS network** — lower latency, no egress charges

### Models available (eu-central-1 has fewer; use us-east-1)

| Model | Bedrock ID | $/M in | $/M out | Use for |
|---|---|---|---|---|
| Claude 3.5 Haiku | `anthropic.claude-3-5-haiku-20241022-v1:0` | $0.80 | $4.00 | Default — fast, cheap, good tool use |
| Claude 3.5 Sonnet | `anthropic.claude-3-5-sonnet-20241022-v2:0` | $3.00 | $15.00 | Complex tasks, use sparingly |

> **Note:** Bedrock Claude pricing is identical to api.anthropic.com — no discount.
> The advantage is credits, not price.

### Setup

1. **IAM role** — the Terraform already attaches `AmazonBedrockFullAccess` equivalent via
   the instance profile. No additional config needed.

2. **Switch config:**
   ```bash
   # On the EC2 instance:
   cd ~/projects/openclaw
   cp config/openclaw-bedrock.json config/openclaw.json   # or update docker-compose volume mount
   docker compose restart openclaw
   ```

3. **No LiteLLM** — remove or comment out the `litellm` service in `docker-compose.yml`,
   and drop the `OPENROUTER_API_KEY` from `.env`. The `LITELLM_MASTER_KEY` env var is also
   not needed.

4. **Region** — Bedrock model availability varies by region. `us-east-1` has the widest
   selection. Set `region: "us-east-1"` in `openclaw-bedrock.json` even if your EC2 is in
   `eu-central-1` — cross-region Bedrock calls work fine and add only ~80ms latency.

### Instance size with Bedrock

`t3.medium` (2 vCPU, 4 GB, ~$30/mo) is sufficient — no LiteLLM proxy means lower memory
overhead. Full comparison:

| Instance | RAM | $/mo | Bedrock fit |
|---|---|---|---|
| t3.small | 2 GB | ~$15 | Tight — only if single agent, low traffic |
| **t3.medium** | 4 GB | ~$30 | ✅ Recommended for Bedrock (no LiteLLM) |
| t3.large | 8 GB | ~$60 | Overkill for Bedrock; better for OpenRouter+LiteLLM |
| t4g.medium | 4 GB | ~$22 | ARM equivalent — cheapest option overall |

---

## Phase 2: OpenRouter + LiteLLM (after credits run out)

### Why switch

- Bedrock Claude pricing is high at scale (~$100–180/mo at moderate usage)
- OpenRouter routes to much cheaper models: Gemini 2.5 Flash at $0.15/M vs Claude Haiku at $0.80/M
- Free-tier models (Llama, Qwen) available for low-stakes tasks

### Model matrix

| Alias | Model | $/M in | $/M out | Context | Best for |
|---|---|---|---|---|---|
| `claude-sonnet-4-6` (default) | gemini-2.5-flash | $0.15 | $0.60 | 1M | General tasks |
| `claude-opus-4-6` | gemini-2.5-pro | $1.25 | $10.00 | 1M | Heavy reasoning |
| `cheap/mini` | gemini-flash-1.5-8b | $0.04 | $0.15 | 1M | Simple/quick |
| `cheap/fast` | gemini-2.0-flash-lite | $0.075 | $0.30 | 1M | Fast lookups |
| `cheap/code` | qwen-2.5-coder-32b | $0.10 | $0.18 | 32K | Code + file/DB writes |
| `cheap/smart` | qwen-2.5-72b | $0.35 | $0.40 | 128K | Analysis |
| `cheap/deepseek` | deepseek-chat-v3 | $0.28 | $1.10 | 64K | Reasoning + structured output |
| `cheap/mistral` | mistral-small-3.2-24b | $0.10 | $0.30 | 128K | General |
| `free/llama` | llama-3.1-8b:free | $0 | $0 | 128K | Testing / non-critical |
| `free/qwen` | qwen-2.5-7b:free | $0 | $0 | 128K | Testing / non-critical |

### Setup

1. Add `OPENROUTER_API_KEY` to AWS Secrets Manager: `openclaw/openrouter-api-key`
2. Switch config:
   ```bash
   cd ~/projects/openclaw
   cp config/openclaw-openrouter.json config/openclaw.json
   docker compose up -d   # starts both openclaw + litellm
   ```
3. Upgrade instance to `t3.large` if not already (LiteLLM needs ~512 MB extra RAM)

---

## Switching between backends

Both config files are pre-built. The switch is one command + restart:

```bash
# → Bedrock
cp config/openclaw-bedrock.json config/openclaw.json
docker compose restart openclaw
# (stop litellm if running: docker compose stop litellm)

# → OpenRouter
cp config/openclaw-openrouter.json config/openclaw.json
docker compose up -d   # starts litellm too
```

No Terraform changes needed — the instance and IAM role work for both.

---

## Cost monitoring

Set a monthly budget alert in AWS to catch runaway agent loops:

```
AWS Console → Billing → Budgets → Create budget
  Type: Cost budget
  Amount: $50/month
  Alert at: 80% actual, 100% forecasted
  Email: your@email.com
```

Also set `maxTurns` in the agent config to cap per-session token use.
