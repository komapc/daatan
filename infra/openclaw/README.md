# OpenClaw EC2 Deployment

Deploy The Clawborators on a t4g.medium EC2 instance for Daatan and Calendar projects. Mixed Gemini + local Qwen fallback, Telegram integration.

**Full documentation:** See [DEPLOYMENT_PLAN.md](DEPLOYMENT_PLAN.md) for complete implementation details, troubleshooting, and security considerations.

## Quick Start

**One-script provision:**

```bash
cd infra/openclaw

# 1. Configure Terraform
cp terraform/terraform.tfvars.example terraform/terraform.tfvars
# Edit: allowed_ssh_cidr = "YOUR_IP/32" (run: curl -s ifconfig.me)

# 2. Configure secrets
cp .env.example .env
# Edit: GEMINI_API_KEY, TELEGRAM_CHAT_ID, TELEGRAM_BOT_TOKEN_DAATAN, TELEGRAM_BOT_TOKEN_CALENDAR

# 3. Deploy
./scripts/raise-openclaw.sh
```

**One-script destroy:**

```bash
cd infra/openclaw
./scripts/destroy-openclaw.sh
```

**Expected behavior:** Run the raise script → orchestrate The Claw by Telegram. Message @DaatanBot or @CalendarBot after deployment completes.

---

## Prerequisites

| Requirement | How to Verify |
|-------------|---------------|
| Terraform >= 1.0 | `terraform version` |
| AWS credentials | `aws sts get-caller-identity` |
| SSH key in EC2 | `aws ec2 describe-key-pairs --key-names daatan-key` |
| Local SSH key | `ls -la ~/.ssh/daatan-key.pem` (chmod 400) |
| Telegram bots | Created via @BotFather |
| Gemini API key | [Google AI Studio](https://aistudio.google.com/app/apikey) |

---

## Cost Optimization

**On-demand start/stop** (~$0.0336/hour, ~$24/month continuous):

```bash
# Stop (keeps EIP and volume, stops compute billing)
aws ec2 stop-instances --instance-ids <instance-id>

# Start (compute billing resumes)
aws ec2 start-instances --instance-ids <instance-id>

# After start: restart containers
ssh -i ~/.ssh/daatan-key.pem ubuntu@<IP> "cd ~/projects/openclaw && sg docker -c 'docker compose up -d'"
```

**Warning:** Stopping preserves data; terminating destroys instance and loses uncommitted data.

---

## Manual Steps (if not using scripts)

### Create

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
# Edit: allowed_ssh_cidr = "YOUR_IP/32"
terraform init
terraform apply
```

### Destroy

```bash
cd terraform
terraform destroy
```

Releases EIP and terminates instance. Volume data is lost.

**State:** Terraform state is local (`terraform/terraform.tfstate`). Back it up; if lost, you cannot destroy or manage the stack.

### Post-Provision

1. **SSH in:** `ssh -i ~/.ssh/daatan-key.pem ubuntu@<OPENCLAW_IP>`
   - Get IP: `terraform -chdir=terraform output -raw openclaw_public_ip`

2. **Get deploy key:** `cat ~/.ssh/id_github.pub` — add to GitHub as Deploy Key for `komapc/daatan` and `komapc/year-shape` (with write access if agents will push)

3. **Copy infra to EC2:**
   ```bash
   ssh -i ~/.ssh/daatan-key.pem ubuntu@<OPENCLAW_IP> "mkdir -p ~/projects"
   scp -r -i ~/.ssh/daatan-key.pem infra/openclaw ubuntu@<OPENCLAW_IP>:~/projects/
   ```

4. **Copy .env:** Create `infra/openclaw/.env` locally, fill in values, then:
   ```bash
   scp -i ~/.ssh/daatan-key.pem infra/openclaw/.env ubuntu@<IP>:~/projects/openclaw/
   ```

5. **Run setup script:**
   ```bash
   ssh -i ~/.ssh/daatan-key.pem ubuntu@<OPENCLAW_IP>
   chmod +x ~/projects/openclaw/scripts/setup-on-ec2.sh
   ~/projects/openclaw/scripts/setup-on-ec2.sh
   ```

6. **Docker group:** If `docker compose` fails with "permission denied":
   ```bash
   sg docker -c "docker compose up -d"
   # Or log out and back in
   ```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google Gemini API key |
| `TELEGRAM_CHAT_ID` | Yes | Your chat ID (primary user). Message a bot, then `curl https://api.telegram.org/bot$TOKEN/getUpdates` to get it |
| `TELEGRAM_BOT_TOKEN_DAATAN` | Yes | @BotFather token for Daatan bot |
| `TELEGRAM_BOT_TOKEN_CALENDAR` | Yes | @BotFather token for Calendar bot |

**Second user:** They DM a bot, get a pairing code. Run:
```bash
docker exec -it openclaw openclaw pairing list telegram
docker exec -it openclaw openclaw pairing approve telegram <CODE>
```

See [DEPLOYMENT_PLAN.md](DEPLOYMENT_PLAN.md) for details.

---

## Verification

After deployment:

```bash
# 1. Container running
docker compose ps

# 2. Ollama model loaded
ollama list

# 3. Telegram bots responsive
# Message @DaatanBot and @CalendarBot with /start

# 4. Agents can read workspace
# Message Daatan bot: "List files in your workspace"
```

See [DEPLOYMENT_PLAN.md](DEPLOYMENT_PLAN.md) for full verification checklist.

---

## Troubleshooting

| Symptom | Quick Fix |
|---------|-----------|
| Container exits | Check `.env` exists with all required vars; `docker compose logs` |
| Git clone fails | Add deploy key to GitHub: `cat ~/.ssh/id_github.pub` |
| Ollama connection refused | `systemctl status ollama`; containers use `host.docker.internal:11434` |
| Docker permission denied | `sg docker -c "command"` or log out/in |
| Agents don't respond | Check pairing: `docker exec -it openclaw openclaw pairing list telegram` |

**Full troubleshooting:** See [DEPLOYMENT_PLAN.md](DEPLOYMENT_PLAN.md#troubleshooting).

---

## Files

| File | Description |
|------|-------------|
| [Dockerfile](Dockerfile) | Extends OpenClaw image with docker-cli |
| [.env.example](.env.example) | Template for OpenClaw .env (gitignored) |
| [DEPLOYMENT_PLAN.md](DEPLOYMENT_PLAN.md) | **Full implementation guide** |
| [scripts/raise-openclaw.sh](scripts/raise-openclaw.sh) | One-script provision |
| [scripts/destroy-openclaw.sh](scripts/destroy-openclaw.sh) | One-script destroy |
| [scripts/setup-on-ec2.sh](scripts/setup-on-ec2.sh) | Post-provision setup (run on EC2) |
| [terraform/](terraform/) | Terraform config |
| [config/](config/) | unified.json (active), daatan.json, calendar.json (legacy) |
| [calendar-agent-bootstrap/](calendar-agent-bootstrap/) | SOUL.md and AGENTS.md for Calendar |
