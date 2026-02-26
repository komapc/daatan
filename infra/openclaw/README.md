# OpenClaw EC2 Deployment

Deploy OpenClaw AI agents on AWS EC2 with Telegram integration.

## Quick Start

### Prerequisites

- AWS account with EC2 access
- OpenRouter API key (https://openrouter.ai/keys) — free tier sufficient
- Telegram Bot tokens (from @BotFather)
- SSH key configured in AWS EC2 (default: `daatan-key`)

### One-Command Deploy

```bash
cd infra/openclaw

# 1. Configure
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars: set allowed_ssh_cidr to your IP

cp .env.example .env
# Edit .env: add OPENROUTER_API_KEY (free tier works) and TELEGRAM_BOT_TOKEN_*

# 2. Deploy
./scripts/provision/deploy-all.sh

# 3. Test
# Message your Telegram bot @YourBotName
```

---

## Architecture

```
┌─────────────────┐
│   Telegram      │
│  (2 bots)       │
└────────┬────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│   EC2 Instance  63.182.142.184           │
│   t4g.medium · eu-central-1 · arm64      │
│                                          │
│   ┌──────────────────────────────────┐   │
│   │  openclaw-daatan:local           │   │
│   │  port 18789  ←→  mission.daatan.com  │
│   │                                  │   │
│   │  agents:                         │   │
│   │    daatan   → /workspace/daatan  │   │
│   │    calendar → /workspace/year-shape  │
│   └──────────────────────────────────┘   │
└──────────────────────────┬───────────────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
     ┌──────────────────┐      ┌──────────────┐
     │ OpenRouter (free)│      │ Ollama       │
     │ qwen3-coder 480B │      │ (local)      │
     │ llama-3.3-70b    │      │ qwen2.5:1.5b │
     │ + 3 more models  │      │              │
     └──────────────────┘      └──────────────┘
```

---

## Directory Structure

```
infra/openclaw/
├── scripts/
│   ├── provision/       # Terraform wrappers
│   │   ├── create.sh
│   │   ├── destroy.sh
│   │   └── deploy-all.sh
│   ├── setup/           # EC2 setup scripts
│   │   ├── on-ec2.sh
│   │   └── validate-env.sh
│   └── utils/           # Maintenance utilities
│       ├── backup-env.sh
│       ├── health-check.sh
│       └── secrets.sh
├── terraform/           # Infrastructure as Code
│   ├── main.tf
│   ├── vpc.tf
│   └── variables.tf
├── config/              # OpenClaw configuration
│   ├── unified.json         # Active config (v2 schema) — deployed to EC2
│   ├── openclaw.json        # DEPRECATED: old v1 format, superseded by unified.json
│   └── openclaw.json.example # Template based on unified.json (v2 format)
├── docs/                # Documentation
│   ├── RUNBOOK.md
│   ├── SECRETS_MANAGER.md
│   └── TROUBLESHOOTING.md
└── Dockerfile           # Custom OpenClaw image
```

---

## Configuration

### Required Environment Variables (.env)

| Variable | Description | Example |
|----------|-------------|---------|
| `OPENROUTER_API_KEY` | OpenRouter API key (free tier works) | `sk-or-v1-...` |
| `TELEGRAM_BOT_TOKEN_DAATAN` | Daatan bot token | `123456:ABC...` |
| `TELEGRAM_BOT_TOKEN_CALENDAR` | Calendar bot token | `789012:DEF...` |
| `TELEGRAM_CHAT_ID` | Your Telegram ID | `188323801` |

### Models (via OpenRouter free tier)

| Role | Model | Notes |
|------|-------|-------|
| Agent (daatan, calendar) | `qwen/qwen3-coder:free` | 480B coding-specialized, 262k ctx |
| Gateway default (compaction) | `meta-llama/llama-3.3-70b-instruct:free` | 70B, 128k ctx |
| Available alternates | Qwen3 80B, Hermes 3 405B, GPT OSS 120B | selectable in UI |

All models are free via OpenRouter. No Gemini or Anthropic API key required.

### Terraform Variables (terraform.tfvars)

| Variable | Description | Example |
|----------|-------------|---------|
| `allowed_ssh_cidr` | Your IP for SSH access | `1.2.3.4/32` |
| `ec2_instance_type` | EC2 instance type | `t4g.medium` |
| `ssh_key_name` | AWS SSH key name | `daatan-key` |
| `aws_region` | AWS region | `eu-central-1` |

---

## Scripts Reference

### Provisioning

| Script | Description |
|--------|-------------|
| `scripts/provision/create.sh` | Create EC2 infrastructure |
| `scripts/provision/destroy.sh` | Destroy infrastructure |
| `scripts/provision/deploy-all.sh` | Full deployment (create + setup) |
| `scripts/provision/copy-infra.sh` | Copy code to EC2 |
| `scripts/provision/run-setup.sh` | Run setup on EC2 |

### Setup

| Script | Description |
|--------|-------------|
| `scripts/setup/on-ec2.sh` | Clone repos, start containers |
| `scripts/setup/validate-env.sh` | Validate environment file |

### Utilities

| Script | Description |
|--------|-------------|
| `scripts/utils/backup-env.sh` | Backup .env to local/S3 |
| `scripts/utils/restore-env.sh` | Restore .env from backup |
| `scripts/utils/health-check.sh` | Health monitoring |
| `scripts/utils/secrets.sh` | AWS Secrets Manager CLI |

---

## Maintenance

### Check Status

```bash
# SSH to instance
ssh -i ~/.ssh/daatan-key.pem ubuntu@63.182.142.184

# Check container
docker compose ps

# Check bot status
docker exec openclaw npx --yes openclaw channels status
```

### View Logs

```bash
# Real-time
docker compose logs -f openclaw

# Last 100 lines
docker compose logs --tail=100 openclaw

# Search for errors
docker compose logs 2>&1 | grep -i error
```

### Update Configuration

```bash
# Edit agent config — hot-reloads automatically (no restart needed)
nano ~/projects/openclaw/config/unified.json

# Edit .env (API keys) — requires restart
nano ~/projects/openclaw/.env
cd ~/projects/openclaw && docker compose down && docker compose up -d

# Verify
docker exec openclaw env | grep OPENROUTER
```

### Access the UI Panel

https://mission.daatan.com (nginx → port 18789, SSL)

Enter the gateway token from `unified.json → gateway.auth.token` in the Control UI settings on first visit.

### Backup

```bash
# Backup .env
cp ~/projects/openclaw/.env ~/projects/openclaw/.env.backup.$(date +%Y%m%d)

# Backup config
docker exec openclaw cat /home/node/.openclaw/openclaw.json > backup.json
```

---

## Troubleshooting

See [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) for common issues and solutions.

### Quick Fixes

| Issue | Fix |
|-------|-----|
| HTTP 401 error | Update OpenRouter key + restart container |
| No bot response | Check `openclaw channels status` |
| SSH connection failed | Update security group with your IP |

---

## Cost Estimate

| Resource | Monthly Cost |
|----------|--------------|
| EC2 t4g.medium | ~$24 |
| EIP (if not attached) | ~$3 |
| 30GB GP3 volume | ~$3 |
| OpenRouter API | $0 (free models only) |
| **Total** | **~$30/month** |

---

## Security

- ✅ SSH restricted to your IP only
- ✅ Secrets stored in AWS Secrets Manager
- ✅ IAM role for EC2 (no hardcoded credentials)
- ✅ Docker container runs as non-root user
- ✅ Security group allows only SSH (port 22)

### Best Practices

1. **Rotate API keys regularly**
2. **Backup .env before changes**
3. **Use AWS Secrets Manager for production**
4. **Monitor OpenRouter usage** (set budget alerts)
5. **Keep security group updated** (your IP may change)

---

## Related Documentation

- [RUNBOOK.md](docs/RUNBOOK.md) - Operational procedures
- [SECRETS_MANAGER.md](docs/SECRETS_MANAGER.md) - AWS Secrets setup
- [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) - Common issues
- [OPENROUTER_BUDGET.md](docs/OPENROUTER_BUDGET.md) - Cost management

---

## Support

- **OpenClaw Docs:** https://docs.openclaw.ai
- **GitHub Issues:** https://github.com/openclaw/openclaw/issues
- **Telegram Bot API:** https://core.telegram.org/bots/api
