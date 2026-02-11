# OpenClaw EC2 Deployment

Deploy The Clawborators on a t4g.medium EC2 instance for Daatan and Calendar projects. Mixed Gemini + local Qwen fallback, Telegram integration.

## Prerequisites

- Terraform >= 1.0
- AWS credentials configured
- SSH key `daatan-key` in EC2 (target region), locally at `~/.ssh/daatan-key.pem` (or set `OPENCLAW_KEY`)

## One-Script Up / One-Script Down

**Expected behavior:** Run the raise script → orchestrate the Claw by Telegram.

**Raise** (from daatan repo root):
```bash
cd infra/openclaw
cp terraform/terraform.tfvars.example terraform/terraform.tfvars
# Edit terraform/terraform.tfvars: allowed_ssh_cidr = "YOUR_IP/32" (replace with your IP, e.g. curl -s ifconfig.me)
cp .env.example .env
# Edit .env (GEMINI_API_KEY, TELEGRAM_CHAT_ID, TELEGRAM_BOT_TOKEN_DAATAN, TELEGRAM_BOT_TOKEN_CALENDAR) — OpenClaw only, not daatan app .env
./scripts/raise-openclaw.sh
```
Raise script scps `.env` to EC2. First run builds the custom image (adds docker-cli). When done, message your Daatan or Calendar Telegram bots.

**Destroy**:
```bash
cd infra/openclaw
./scripts/destroy-openclaw.sh
```

---

## Manual Steps (if not using the scripts)

### Create

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars: set allowed_ssh_cidr to YOUR_IP/32
terraform init
terraform plan
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

3. **Copy infra to EC2:** From your local machine:
   ```bash
   ssh -i ~/.ssh/daatan-key.pem ubuntu@<OPENCLAW_IP> "mkdir -p ~/projects"
   scp -r -i ~/.ssh/daatan-key.pem infra/openclaw ubuntu@<OPENCLAW_IP>:~/projects/
   ```

4. **Copy .env:** Create `infra/openclaw/.env` locally (copy from `.env.example`), fill in values, then `scp infra/openclaw/.env ubuntu@<IP>:~/projects/openclaw/`. This is OpenClaw env only — do not mix with daatan app `.env`.

5. **Run setup script:** On EC2:
   ```bash
   chmod +x ~/projects/openclaw/scripts/setup-on-ec2.sh
   ~/projects/openclaw/scripts/setup-on-ec2.sh
   ```

6. **Docker group:** On first login after provision, `usermod -aG docker` may not have applied. If `docker compose` fails with "permission denied", run `newgrp docker` (or log out and back in), or use `sg docker -c "docker compose up -d"`.

## On-Demand Start/Stop

To save cost when not using agents:

- **Stop:** `aws ec2 stop-instances --instance-ids <instance-id>`
- **Start:** `aws ec2 start-instances --instance-ids <instance-id>`
- Instance ID: `terraform -chdir=terraform output` or AWS Console

After start, SSH in and run `sg docker -c "docker compose up -d"` in `~/projects/openclaw` (containers do not auto-start on instance boot unless configured).

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google Gemini API key |
| `TELEGRAM_CHAT_ID` | Yes | Your chat ID (primary user). Message a bot, then `curl https://api.telegram.org/bot$TOKEN/getUpdates` to get it |
| `TELEGRAM_BOT_TOKEN_DAATAN` | Yes | @BotFather token for Daatan bot |
| `TELEGRAM_BOT_TOKEN_CALENDAR` | Yes | @BotFather token for Calendar bot |

**Second user:** They DM a bot, get a pairing code. Run `docker exec -it openclaw openclaw pairing list telegram` to see pending requests, then `openclaw pairing approve telegram <CODE>`. See DEPLOYMENT_PLAN.md for details.

## Files

- [Dockerfile](Dockerfile) — Extends OpenClaw image with docker-cli
- [.env.example](.env.example) — Template for OpenClaw .env (copy to .env; gitignored)
- [DEPLOYMENT_PLAN.md](DEPLOYMENT_PLAN.md) — Full implementation plan
- [scripts/raise-openclaw.sh](scripts/raise-openclaw.sh) — One-script provision
- [scripts/destroy-openclaw.sh](scripts/destroy-openclaw.sh) — One-script destroy
- [scripts/setup-on-ec2.sh](scripts/setup-on-ec2.sh) — Post-provision setup (run on EC2)
- [terraform/](terraform/) — Terraform config
- [config/](config/) — unified.json (active), daatan.json, calendar.json (legacy)
- [calendar-agent-bootstrap/](calendar-agent-bootstrap/) — SOUL.md and AGENTS.md for Calendar
