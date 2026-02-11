# OpenClaw EC2 Deployment

Deploy The Clawborators on a t4g.medium EC2 instance for Daatan and Calendar projects. Mixed Gemini + local Qwen fallback, Telegram integration.

## Prerequisites

- Terraform >= 1.0
- AWS credentials configured
- SSH key `daatan-key` in EC2 (target region)

## Create

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars: set allowed_ssh_cidr to YOUR_IP/32
terraform init
terraform plan
terraform apply
```

## Destroy

```bash
cd terraform
terraform destroy
```

Releases EIP and terminates instance. Volume data is lost.

## Post-Provision

1. **SSH in:** `ssh -i ~/.ssh/daatan-key.pem ubuntu@<OPENCLAW_IP>`

2. **Get deploy key:** `cat ~/.ssh/id_github.pub` — add to GitHub as Deploy Key for `komapc/daatan` and `komapc/year-shape` (with write access if agents will push)

3. **Copy infra to EC2:** From your local machine:
   ```bash
   scp -r -i ~/.ssh/daatan-key.pem infra/openclaw ubuntu@<OPENCLAW_IP>:~/
   ```

4. **Create .env:** On EC2, `mkdir -p ~/openclaw` then create `~/openclaw/.env`:
   ```
   GEMINI_API_KEY=your-gemini-api-key
   TELEGRAM_BOT_TOKEN=your-telegram-bot-token
   TELEGRAM_CHAT_ID=your-telegram-chat-id
   ```
   Get chat ID: `curl https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getUpdates` (send a message to your bot first)

5. **Run setup script:** On EC2:
   ```bash
   chmod +x ~/openclaw/scripts/setup-on-ec2.sh
   ~/openclaw/scripts/setup-on-ec2.sh
   ```

6. **Start agents:** `cd ~/openclaw && docker compose up -d`

## On-Demand Start/Stop

To save cost when not using agents:

- **Stop:** `aws ec2 stop-instances --instance-ids <instance-id>`
- **Start:** `aws ec2 start-instances --instance-ids <instance-id>`
- Instance ID: `terraform output` or AWS Console

After start, SSH in and run `docker compose up -d` in `~/openclaw` (containers do not auto-start on instance boot unless configured).

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google Gemini API key |
| `TELEGRAM_BOT_TOKEN` | Yes | From @BotFather |
| `TELEGRAM_CHAT_ID` | Yes | Your chat ID for DMs/commands |

## Files

- [DEPLOYMENT_PLAN.md](DEPLOYMENT_PLAN.md) — Full implementation plan
- [terraform/](terraform/) — Terraform config
- [config/](config/) — OpenClaw daatan.json, calendar.json
- [calendar-agent-bootstrap/](calendar-agent-bootstrap/) — SOUL.md and AGENTS.md for Calendar
- [scripts/setup-on-ec2.sh](scripts/setup-on-ec2.sh) — Post-provision setup
