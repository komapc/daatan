# OpenClaw EC2 Deployment Plan

Deploy The Clawborators on a t4g.medium EC2 instance for Daatan and Calendar projects. Mixed Gemini + local Qwen fallback, best-practice personalities, full create/destroy workflow.

---

## Instance Sizing (t4g.medium)

**Specs:** 2 vCPU, 4 GiB RAM (ARM64, Graviton2).

| Component | Est. RAM | Notes |
|-----------|----------|-------|
| Ubuntu + Docker | ~500 MB | Base OS |
| Ollama daemon | ~300 MB | Idle |
| Qwen 1.5B model | ~1.2 GB | Loaded on first use |
| openclaw | ~300 MB | Single gateway (Daatan + Calendar agents) |
| **Total baseline** | ~2.2 GB | Leaves ~1.7 GB headroom |

**Docker socket:** Mounted so agents can run `docker build`, `docker run`, etc. DevOps and Calendar SOUL: never tag a release unless the user explicitly commands it.

**Phi4-mini upgrade:** ~2.5 GB RAM when loaded. Only consider if baseline usage is consistently under 2 GB. Use `ollama ps` to check; scale down to one agent or skip phi4 if swapping occurs.

**Ollama + Docker:** Containers use `host.docker.internal` to reach Ollama on host. No extra bridge overhead.

### Cost Optimization

**On-demand start/stop:** Instance costs ~$0.0336/hour (~$24/month continuous). To save costs:

```bash
# Stop (keeps EIP and volume, stops billing for compute)
aws ec2 stop-instances --instance-ids <instance-id>

# Start (compute billing resumes)
aws ec2 start-instances --instance-ids <instance-id>
```

**After start:** SSH in and run `sg docker -c "docker compose up -d"` in `~/projects/openclaw` (containers don't auto-start).

**Warning:** Stopping preserves data; terminating destroys instance and loses uncommitted data. EIP is released on termination unless explicitly preserved.

---

## Directory Layout (~/projects/)

Mirrors laptop structure for familiarity. Per-agent workspaces (see recommendation in plan):

```
~/projects/
  openclaw/      # Config, docker-compose.yml, .env — run docker compose from here
  daatan/        # daatan agent workspace
  year-shape/    # calendar agent workspace
```

---

## Naming Conventions

- **year-shape** — GitHub repo name and directory on EC2 (`~/projects/year-shape`)
- **YearWheel** — App/product name (used in SOUL/AGENTS); app code lives in `year-shape-calendar/` subdir
- **calendar** — OpenClaw agent ID for the YearWheel project

---

## Current State

The [infra/openclaw/](.) directory contains:

- **Terraform**: [main.tf](terraform/main.tf), [variables.tf](terraform/variables.tf), [outputs.tf](terraform/outputs.tf)
- **Docker Compose**: [docker-compose.yml](docker-compose.yml) with single `openclaw` gateway
- **Config**: [config/unified.json](config/unified.json) — multi-agent (daatan + calendar), two Telegram bots

---

## Refined Configuration (OpenClaw Official Schema)

### Models and Fallback

- Use `fallbacks` (array), not `fallback` (string): `"fallbacks": ["ollama/qwen:1.5b"]`
- Primary: `google/gemini-1.5-pro` (main/devops), `google/gemini-1.5-flash` (QA)
- Optional upgrade: `ollama/phi4-mini` (better reasoning, ~2.5GB RAM) if instance has headroom

### Ollama Provider (Critical)

Per [OpenClaw Ollama docs](https://www.getopenclaw.ai/help/ollama-local-models-setup):

```json
"ollama": {
  "baseUrl": "http://host.docker.internal:11434/v1",
  "apiKey": "ollama-local",
  "api": "openai-responses"
}
```

- `baseUrl` (camelCase) must end with `/v1`; `api` is required or models return 0 tokens.

### Channels (Telegram)

Use two Telegram bots (one per agent). `channels.telegram.accounts` with `accountId` bindings; `dmPolicy: "pairing"` for approval flow. See [config/unified.json](config/unified.json).

```json
"channels": {
  "telegram": {
    "enabled": true,
    "dmPolicy": "pairing",
    "streamMode": "partial",
    "chatId": "${TELEGRAM_CHAT_ID}",
    "accounts": {
      "daatan": { "name": "Daatan", "botToken": "${TELEGRAM_BOT_TOKEN_DAATAN}" },
      "calendar": { "name": "Calendar", "botToken": "${TELEGRAM_BOT_TOKEN_CALENDAR}" }
    }
  }
}
```

### Agent Identity

Add per-agent `identity` for personality:

- **Daatan**: Corvus (main), DevOps, QA — each with `name`, `theme`, `emoji`
- **Calendar**: `{ "name": "Calendar Agent", "theme": "Year-shape (Vite, TypeScript)", "emoji": "📅" }`

---

## Environment Variables (Required .env on EC2)

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google Gemini API key (OpenClaw + daatan use this; obtain from [Google AI Studio](https://aistudio.google.com/app/apikey)) |
| `TELEGRAM_CHAT_ID` | Yes | Primary user's chat ID. Get: message a bot, then `curl https://api.telegram.org/bot$TOKEN/getUpdates` — use `message.chat.id` |
| `TELEGRAM_BOT_TOKEN_DAATAN` | Yes | @BotFather token for Daatan bot |
| `TELEGRAM_BOT_TOKEN_CALENDAR` | Yes | @BotFather token for Calendar bot |

**Architecture:** Single OpenClaw gateway with two agents (daatan, calendar). Each agent has its own Telegram bot; Telegram allows one webhook per bot, so both work. Message @DaatanBot for Daatan project, @CalendarBot for YearWheel.

**Adding a second user (pairing):**

1. User 2 DMs a Telegram bot. With `dmPolicy: "pairing"`, unknown senders receive an 8-character pairing code; their messages are not processed until approved.
2. SSH to EC2. Run:
   ```bash
   docker exec -it openclaw openclaw pairing list telegram
   docker exec -it openclaw openclaw pairing approve telegram <CODE>
   ```
   Replace `<CODE>` with the 8-character code User 2 received.
3. After approval, User 2 is added to the allowlist for that bot.

GitHub: Uses SSH deploy key (generated on instance by Terraform user_data). No token needed for clone. Add deploy key to both repos with **write** access if agents will push; **read-only** suffices for clone-only. **Security:** Deploy key is instance-specific; rotate by generating new key on instance and updating GitHub.

### .env Backup Strategy

**Critical:** The `.env` file is stored only on the EC2 instance. If the instance is terminated, all secrets are lost.

**Options:**

1. **Manual backup (recommended for now):**
   ```bash
   # Before destroy, backup .env locally
   scp -i ~/.ssh/daatan-key.pem ubuntu@<IP>:~/projects/openclaw/.env ./openclaw.env.backup
   
   # After recreate, restore
   scp -i ~/.ssh/daatan-key.pem ./openclaw.env.backup ubuntu@<IP>:~/projects/openclaw/.env
   ```

2. **AWS Secrets Manager (future):** Store `.env` as a secret, retrieve in user_data or setup script.

3. **Encrypted S3 bucket:** Upload `.env.enc` (encrypted with KMS or age), decrypt on instance.

**Best practice:** Keep a local encrypted backup. The `.env` file contains only API keys and bot tokens — all replaceable, but re-creation is tedious.

---

## Personalities (Best-Practice SOUL.md and AGENTS.md)

Per [OpenClaw SOUL template](https://docs.molt.bot/reference/templates/SOUL) and community: keep SOUL under ~15 lines for specialized agents; main agents get full template + project rules. Avoid verbosity, overlapping rules, over-specification.

### Daatan - Corvus (main)

**Keep existing** [agents/corvus/SOUL.md](../../agents/corvus/SOUL.md) - it follows the template (Core Truths, Boundaries, Vibe, Continuity) and has strong DAATAN-specific rules (cost, safety, quiet hours). Optionally trim "Continuity" paragraph if token-budgeting.

### Daatan - DevOps

**Current** [agents/devops/SOUL.md](../../agents/devops/SOUL.md) is role-focused but verbose. Refine to:

```markdown
# SOUL.md - DevOps Agent

I maintain DAATAN infrastructure: Docker, Terraform, GitHub Actions, deployments.

**Style:** Precise, cautious. Prefer `terraform plan` and `npm audit --dry-run` before acting.
**Rule:** Never run `terraform apply`, `deploy.sh`, or prod migrations without explicit approval.
```

**AGENTS.md:** Keep existing; add key files: `terraform/`, `deploy.sh`, `.github/workflows/deploy.yml`, `scripts/`.

### Daatan - QA

**Current** [agents/qa/SOUL.md](../../agents/qa/SOUL.md) is good. Refine to:

```markdown
# SOUL.md - QA Agent

I ensure DAATAN quality: run tests, check health endpoints, report bugs.

**Style:** Meticulous, systematic. Observe and report; do not modify application code.
**Rule:** Bugs go in `bug_reports/` with steps-to-reproduce, expected vs actual.
```

**AGENTS.md:** Keep existing.

### Calendar - Main (new)

Create `calendar-agent-bootstrap/agents/main/SOUL.md`:

```markdown
# SOUL.md - Calendar Agent

I assist with the YearWheel calendar app (Vite, TypeScript, Tailwind). Interactive calendar visualization, Google Calendar integration, i18n.

**Style:** Concise, practical. Same Core Truths as Corvus: helpful without fluff, resourceful before asking, private stays private.
**Safety:** Never output secrets; ask before deploy. Deploy is Cloudflare Pages (see CLOUDFLARE_DEPLOY.md).
**Cost:** Use flash for routine; pro for complex. Fallback to local when quota exhausted.
```

Create `AGENTS.md`:

```markdown
# AGENTS.md - Calendar Agent

**Goal:** Development, testing, and deployment of YearWheel.
**App location:** `year-shape-calendar/` (Vite app subdir)
**Key files:** `year-shape-calendar/src/`, `year-shape-calendar/vite.config.ts`, `year-shape-calendar/CLOUDFLARE_DEPLOY.md`
**Commands:** `cd year-shape-calendar && npm run dev`, `npm test`, `npm run build`
**Deploy:** Cloudflare Pages via `wrangler` or GitHub Actions. Do not deploy without approval.
```

---

## Create/Destroy Workflow

**Create:** Use `scripts/raise-openclaw.sh` (or `terraform apply` with `terraform.tfvars` containing `allowed_ssh_cidr = "1.2.3.4/32"` — your IP)

**Destroy:** `scripts/destroy-openclaw.sh` or `terraform destroy` (releases EIP, terminates instance).

**State:** Local backend. Back up `terraform.tfstate`; if lost, you cannot destroy or manage the stack.

**Rollback:** If deployment fails mid-way, `terraform destroy` cleans up. Re-run `terraform apply` to recreate. No stateful app data on instance (repos are cloned fresh by setup script). Backup: `.env` and any local edits — recreate manually if needed.

---

## Pre-Flight Checklist

Before running `raise-openclaw.sh`, verify:

- [ ] **AWS credentials configured:** `aws sts get-caller-identity` works
- [ ] **SSH key exists in target region:** `aws ec2 describe-key-pairs --key-names daatan-key --region eu-central-1`
- [ ] **Local SSH key file:** `~/.ssh/daatan-key.pem` exists with `chmod 400`
- [ ] **Your IP for SSH:** `curl -s ifconfig.me` → update `allowed_ssh_cidr` in `terraform.tfvars`
- [ ] **Telegram bots created:** @BotFather → two bots, tokens saved
- [ ] **Your Telegram chat ID:** Message a bot, then `curl https://api.telegram.org/bot$TOKEN/getUpdates | jq '.result[0].message.chat.id'`
- [ ] **Gemini API key:** [Google AI Studio](https://aistudio.google.com/app/apikey) → create key
- [ ] **Disk space:** Instance has 30 GB GP3 (sufficient for repos + models)

---

## Post-Deployment Verification

After `docker compose up -d`, run these checks:

### 1. Container Health

```bash
# Check container status
docker compose ps
# Expected: openclaw is "Up (healthy)" if health checks configured

# Check logs for errors
docker compose logs --tail=50 | grep -i error
```

### 2. Ollama Model

```bash
# Verify model is loaded
ollama list
# Expected: qwen:1.5b in list

# Test Ollama directly
ollama run qwen:1.5b "Hello" --noword
```

### 3. GitHub Deploy Key

```bash
# Get the public key
cat ~/.ssh/id_github.pub

# Add to GitHub:
# 1. Go to https://github.com/komapc/daatan/settings/keys/new
# 2. Paste key, title "OpenClaw EC2", check "Allow write access"
# 3. Repeat for https://github.com/komapc/year-shape/settings/keys/new
```

### 4. Telegram Bot Response

```bash
# Message @DaatanBot with /start
# Expected: Bot responds (or prompts for pairing if first time)

# Message @CalendarBot with /start
# Expected: Bot responds (or prompts for pairing if first time)
```

### 5. Agent Workspace Access

Message Daatan bot:
```
List files in your workspace
```

Expected: Agent lists files from `~/projects/daatan/`

Message Calendar bot:
```
List files in your workspace
```

Expected: Agent lists files from `~/projects/year-shape/`

### 6. Fallback Path Test (Optional)

Temporarily test Ollama fallback:

```bash
# Edit .env, comment out GEMINI_API_KEY
docker compose restart openclaw

# Ask agent a simple question
# Expected: Slower response from Ollama, not error

# Restore GEMINI_API_KEY
docker compose restart openclaw
```

---

## Setup Script (Clones Both Projects)

`scripts/setup-on-ec2.sh` runs **on the EC2 instance**. Invoke after `scp -r infra/openclaw ubuntu@<IP>:~/projects/` → script lives at `~/projects/openclaw/scripts/setup-on-ec2.sh`. User-data creates only `~/projects`; daatan and year-shape dirs are created by `git clone` (setup does not create empty dirs).

**Detailed flow:**

1. **GIT_SSH_COMMAND** — `export GIT_SSH_COMMAND="ssh -i $HOME/.ssh/id_github -o IdentitiesOnly=yes"`
2. **Target dir** — `mkdir -p ~/projects && cd ~/projects`
3. **Clone daatan** — `git clone git@github.com:komapc/daatan.git` → `~/projects/daatan/` (skips if present)
4. **Clone year-shape** — `git clone git@github.com:komapc/year-shape.git` → `~/projects/year-shape/` (skips if present)
5. **Bootstrap calendar agent** — Copy `calendar-agent-bootstrap/agents/main/{SOUL.md,AGENTS.md}` → `~/projects/year-shape/agents/main/`
6. **Config/compose** — Already at `~/projects/openclaw/` (from scp)
7. **Env check** — Assert `~/projects/openclaw/.env` exists with `GEMINI_API_KEY`, `TELEGRAM_CHAT_ID`, `TELEGRAM_BOT_TOKEN_DAATAN`, `TELEGRAM_BOT_TOKEN_CALENDAR`; exit with instructions if missing
8. **Start** — `cd ~/projects/openclaw && docker compose up -d`

**Invocation:** `chmod +x ~/projects/openclaw/scripts/setup-on-ec2.sh && ~/projects/openclaw/scripts/setup-on-ec2.sh`

**Prerequisite:** Add `~/.ssh/id_github.pub` to GitHub as Deploy Key for `komapc/daatan` and `komapc/year-shape` **before** running (Terraform user_data generates the key on first boot).

---

## Fixes Required

### 1. Terraform User Data — ✅ Resolved

User data moved to external script [terraform/scripts/user-data.sh](terraform/scripts/user-data.sh). Loaded via `file()`. Ollama override uses `printf` to avoid whitespace issues.

### 2. Docker Compose - SSH volume paths — ✅ Resolved

[docker-compose.yml](docker-compose.yml) uses absolute paths `/home/ubuntu/.ssh/id_github` for host SSH keys. Config and SSH keys mount to `/home/node/.openclaw/` and `/home/node/.ssh/` (OpenClaw runs as `node` user).

### 3. Terraform - allowed_account_ids

Add `allowed_account_ids = ["272007598366"]` to match main project if using same AWS account. **For other AWS accounts:** Use a variable (e.g. `var.aws_account_id`) and set in `terraform.tfvars`. Prevents accidental applies against wrong account.

### 4. Terraform - tfvars.example

Add `terraform.tfvars.example` with placeholders for `allowed_ssh_cidr` and `ssh_key_name`.

### 5. Terraform User Data - Ollama pull

**Recommended:** Run synchronously with timeout so boot script waits (or fails gracefully). Example:

```bash
timeout 300 sudo -u ubuntu ollama pull qwen:1.5b || true
```

Alternative: systemd oneshot unit that runs after `ollama.service` and blocks until `ollama list` shows `qwen:1.5b`. Use oneshot if 5 minutes is insufficient on slow networks.

### 6. Terraform - Subnet

Add explicit `subnet_id` via `aws_default_subnet` or variable (default VPC assumption is fragile).

### 7. OpenClaw Docker image tag

Use `ghcr.io/openclaw/openclaw:main` (canonical). **Verification:**

```bash
docker pull ghcr.io/openclaw/openclaw:main
```

If tag is missing or deprecated, check [OpenClaw releases](https://github.com/openclaw/openclaw/releases) or [GHCR packages](https://github.com/orgs/openclaw/packages) for current tag.

## Config (unified.json)

Active config: [config/unified.json](config/unified.json). Key points:

- `agents.list`: daatan (workspace `/workspace/daatan`), calendar (workspace `/workspace/year-shape`)
- `bindings`: route `accountId: daatan` → daatan agent, `accountId: calendar` → calendar agent
- `channels.telegram.accounts`: two bots (TELEGRAM_BOT_TOKEN_DAATAN, TELEGRAM_BOT_TOKEN_CALENDAR)
- Ollama: `baseUrl`, `api`, `apiKey`; fallbacks `["ollama/qwen:1.5b"]`

Legacy [config/daatan.json](config/daatan.json) and [config/calendar.json](config/calendar.json) kept for reference only.

## Implementation Status

| Artifact | Status | Notes |
|----------|--------|-------|
| README.md | ✅ Present | Prerequisites, create/destroy, post-provision |
| scripts/setup-on-ec2.sh | ✅ Present | Clones repos, copies configs, checks .env |
| calendar-agent-bootstrap/ | ✅ Present | SOUL.md, AGENTS.md for main agent |
| config/unified.json | ✅ Present | Multi-agent, two Telegram accounts |
| docker-compose.yml | ✅ Present | Single openclaw container, both workspaces |
| terraform/* | ⚠️ Partial | user_data → external script; verify fixes applied |
| docker-compose | ✅ | Docker socket mounted for agent docker commands |

---

## Artifacts Reference

### README.md

[README.md](README.md) documents:

- **Prerequisites:** Terraform, AWS credentials, SSH key (`daatan-key`) in EC2 in target region
- **Create:** `raise-openclaw.sh` or terraform with `terraform.tfvars` (allowed_ssh_cidr = your IP/32)
- **Destroy:** `terraform destroy` (with note on EIP/volume cleanup)
- **Post-provision:** SSH in; get deploy key (`cat ~/.ssh/id_github.pub`); add to GitHub (daatan, year-shape) with write access
- **Setup script:** `scp -r infra/openclaw ubuntu@<IP>:~/projects/`; run `~/projects/openclaw/scripts/setup-on-ec2.sh`
- **Manual .env:** Create `~/projects/openclaw/.env` with `GEMINI_API_KEY`, `TELEGRAM_CHAT_ID`, `TELEGRAM_BOT_TOKEN_DAATAN`, `TELEGRAM_BOT_TOKEN_CALENDAR`
- **Start agents:** `cd ~/projects/openclaw && docker compose up -d`
- **On-demand:** `aws ec2 start-instances --instance-ids <id>` / `stop-instances`

### Calendar agent bootstrap

Create `calendar-agent-bootstrap/agents/main/SOUL.md` and `AGENTS.md` (content above). Setup script copies into `~/projects/year-shape/agents/main/`.

**CLOUDFLARE_DEPLOY.md:** Exists at `year-shape/year-shape-calendar/CLOUDFLARE_DEPLOY.md`. Calendar agent workspace is `~/projects/year-shape`; agent sees `year-shape-calendar/CLOUDFLARE_DEPLOY.md`.

## Verification (Post-Setup Smoke Test)

After `docker compose up -d`:

1. **Container running:**
   ```bash
   docker compose ps
   # openclaw should be Up
   ```

2. **Ollama model loaded:**
   ```bash
   ollama list
   # qwen:1.5b should appear
   ```

3. **Telegram bots responsive:** Send `/start` to each bot; expect a reply or pairing prompt.

4. **Agents can read workspace:** Message Daatan bot → ask to list files; message Calendar bot → ask to list files. Each sees its project structure.

5. **Fallback path (optional):** Temporarily unset `GEMINI_API_KEY` and ask agent a question; should fall back to Ollama (slower, lower quality) rather than error.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Container exits immediately | Missing .env or invalid vars | Create `~/projects/openclaw/.env` with GEMINI_API_KEY, TELEGRAM_CHAT_ID, TELEGRAM_BOT_TOKEN_DAATAN, TELEGRAM_BOT_TOKEN_CALENDAR; `docker compose up` (no -d) to see logs |
| `Permission denied (publickey)` on git clone | Deploy key not added or wrong key | `cat ~/.ssh/id_github.pub`; add to GitHub Deploy Keys for both repos with write access |
| Ollama 0 tokens / connection refused | Ollama not listening or wrong URL | `systemctl status ollama`; ensure `OLLAMA_HOST=0.0.0.0` in override; containers use `host.docker.internal:11434` |
| Systemd override invalid | Leading whitespace in override.conf | Override must have no indentation before `[Service]`; fix Terraform heredoc |
| Instance runs out of memory | Too many models or agents | `ollama ps`; stop unused models; consider phi4-mini only if headroom >2GB |
| Terraform apply fails (wrong account) | allowed_account_ids mismatch | Set `allowed_account_ids` to your AWS account ID in provider block or variable |
| `docker: command not found` in agent | Image lacks docker CLI | We use custom Dockerfile that adds docker.io |
| `permission denied` on docker socket | Container user not in docker group | `group_add: "999"` in compose; if host docker GID differs, run `getent group docker` and update group_add |
| Pairing code never arrives | Telegram bot webhook not set | Check bot token in .env; restart container; verify bot is not already managed elsewhere |
| Agents don't respond to DMs | Pairing not approved or wrong chat ID | Run `docker exec -it openclaw openclaw pairing list telegram`; approve pending codes; verify TELEGRAM_CHAT_ID |

### Docker Group Issue (Common)

After first boot, the `ubuntu` user may not be in the `docker` group yet:

```bash
# Quick fix (current session only)
sg docker -c "docker compose up -d"

# Permanent fix (requires logout)
usermod -aG docker ubuntu
# Then log out and back in
```

The setup script uses `sg docker` to work around this.

### Ollama Pull Timeout

User_data runs `timeout 300 ollama pull qwen:1.5b`. If network is slow:

```bash
# Check if model exists
ollama list

# If missing, pull manually
ollama pull qwen:1.5b

# Restart container
docker compose restart openclaw
```

### Terraform State Lost

If `terraform.tfstate` is lost, you cannot `terraform destroy`. Manual cleanup:

```bash
# Release EIP
aws ec2 release-address --allocation-id eipalloc-xxx

# Terminate instance
aws ec2 terminate-instances --instance-ids i-xxx

# Delete security group
aws ec2 delete-security-group --group-id sg-xxx

# Delete key pair
aws ec2 delete-key-pair --key-name daatan-key
```

### High Memory Usage

Monitor with:

```bash
# Check Ollama models loaded
ollama ps

# Check system memory
free -h

# Check container memory
docker stats --no-stream
```

If memory > 3.5 GB:
1. Stop unused models: `ollama stop <model>`
2. Reduce concurrent agents
3. Consider scaling to t4g.large (8 GB RAM)

---

**Legacy configs:** [config/daatan.json](config/daatan.json) and [config/calendar.json](config/calendar.json) remain for reference. The active config is [config/unified.json](config/unified.json).

---

## Security Considerations

### Deploy Keys

- **Scope:** Instance-specific (generated by user_data on first boot)
- **Access:** Add to GitHub with **write** access if agents will push commits; **read-only** suffices for clone-only
- **Rotation:** Generate new key on instance, update GitHub, delete old key
- **Storage:** `~/.ssh/id_github` on EC2; public key `~/.ssh/id_github.pub`

### SSH Access

- **Key:** `daatan-key` in AWS EC2 (target region)
- **Local file:** `~/.ssh/daatan-key.pem` with `chmod 400`
- **Restriction:** Security group allows only your IP (`allowed_ssh_cidr`)
- **Best practice:** Use AWS Session Manager for SSH if possible (no open port 22)

### Secrets Management

| Secret | Storage | Rotation |
|--------|---------|----------|
| `GEMINI_API_KEY` | `.env` on EC2 | Regenerate at [Google AI Studio](https://aistudio.google.com/app/apikey) |
| `TELEGRAM_BOT_TOKEN_*` | `.env` on EC2 | Revoke via @BotFather, create new bot |
| SSH deploy key | `~/.ssh/id_github` on EC2 | Generate new key, update GitHub |
| AWS credentials | Local Terraform machine | IAM user console or AWS CLI |

### Network Security

- **Ingress:** Port 22 (SSH) restricted to your IP
- **Egress:** All traffic allowed (required for apt, Docker Hub, Ollama, GitHub)
- **EIP:** Static public IP; update DNS if using domain

### Hardening Recommendations

1. **Fail2ban:** Install to block brute-force SSH attempts
2. **Unattended upgrades:** Enable security patches
3. **CloudWatch alarms:** CPU > 80%, memory > 90%, disk > 85%
4. **VPC endpoints:** For S3, Secrets Manager (reduces egress costs)
5. **IAM role:** Attach to instance for AWS API access (no credentials in .env)

---

## Architecture (Summary)

```mermaid
flowchart TB
    subgraph EC2 [EC2 t4g.medium]
        Ollama[Ollama + Qwen 1.5B]
        Docker[Docker]
        Gateway[openclaw gateway]
        subgraph Agents [Agents]
            Daatan[daatan]
            Calendar[calendar]
        end
    end
    Gemini[Gemini API]
    TgDaatan[@DaatanBot]
    TgCal[@CalendarBot]
    GitHub[GitHub]
    Gateway --> Daatan
    Gateway --> Calendar
    Daatan --> Gemini
    Daatan --> Ollama
    Calendar --> Gemini
    Calendar --> Ollama
    TgDaatan --> Gateway
    TgCal --> Gateway
    Daatan --> GitHub
    Calendar --> GitHub
```

## Execution Order

**One-time implementation (for maintainers):**

1. Create config/unified.json (multi-agent, two Telegram accounts, bindings)
2. Update docker-compose.yml for single openclaw container, mount `~/projects` as `/workspace`
3. Refine Daatan DevOps and QA SOUL.md (best-practice, concise)
4. Create calendar-agent-bootstrap (SOUL.md, AGENTS.md per templates above)
5. Create setup-on-ec2.sh (clone both repos with GIT_SSH_COMMAND, copy configs, calendar bootstrap)
6. Fix Terraform user_data (Ollama override, pull sync/oneshot, subnet), tfvars.example, allowed_account_ids
7. Fix docker-compose volume paths to `/home/ubuntu/.ssh/`
8. Create README.md (full workflow, env vars table, create/destroy, setup script)
9. Verify OpenClaw image tag (`docker pull ghcr.io/openclaw/openclaw:main`)
10. Verify year-shape has CLOUDFLARE_DEPLOY.md or add stub to bootstrap

**Per-deployment (user workflow):**

1. `cd infra/openclaw`, copy `terraform.tfvars.example` → `terraform.tfvars`, edit `allowed_ssh_cidr`
2. Copy `.env.example` → `.env`, fill in GEMINI_API_KEY, TELEGRAM_CHAT_ID, TELEGRAM_BOT_TOKEN_DAATAN, TELEGRAM_BOT_TOKEN_CALENDAR
3. Create two bots via @BotFather; add both tokens to .env
4. `./scripts/raise-openclaw.sh` (prompts for deploy key, then completes)
5. Run verification steps (see Verification section)
