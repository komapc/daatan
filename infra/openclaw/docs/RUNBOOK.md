# OpenClaw Operational Runbook

**Last Updated:** 2026-02-18  
**Deployment:** EC2 t4g.medium (eu-central-1)  
**Instance:** OpenClaw gateway with Daatan + Calendar agents

---

## Quick Reference

| Task | Command |
|------|---------|
| **Deploy all** | `./scripts/provision/deploy-all.sh` |
| **Create infra only** | `./scripts/provision/create.sh` |
| **Destroy infra** | `./scripts/provision/destroy.sh` |
| **Health check** | `./scripts/utils/health-check.sh [IP]` |
| **Backup .env** | `./scripts/utils/backup-env.sh --local --s3` |
| **Restore .env** | `./scripts/utils/restore-env.sh --latest` |
| **Validate env** | `./scripts/setup/validate-env.sh` |

---

## Deployment Workflows

### Full Deployment (Recommended)

```bash
# One command: create + copy + setup + verify
./scripts/provision/deploy-all.sh --auto-approve
```

**What it does:**
1. Creates EC2 infrastructure via Terraform
2. Waits for SSH to be available
3. Copies all code to instance
4. Runs setup script on instance
5. Verifies containers are running

**Time:** ~10-15 minutes

---

### Manual Step-by-Step

```bash
# 1. Create infrastructure
./scripts/provision/create.sh

# 2. Copy code to instance
./scripts/provision/copy-infra.sh

# 3. Run setup on instance
./scripts/provision/run-setup.sh

# 4. Verify
./scripts/utils/health-check.sh
```

---

### Destroy Infrastructure

```bash
# Backup .env first (recommended)
./scripts/utils/backup-env.sh --local --s3

# Destroy with confirmation
./scripts/provision/destroy.sh

# Or auto-approve (dangerous!)
./scripts/provision/destroy.sh --auto-approve
```

**Warning:** This terminates the instance and releases the EIP. All data on the instance is lost.

---

## On-Instance Operations

### SSH Access

```bash
# Get instance IP
cat infra/openclaw/.instance-info | grep PUBLIC_IP

# SSH into instance
ssh -i ~/.ssh/daatan-key.pem ubuntu@<IP>
```

### Container Management

```bash
# View status
docker compose ps

# View logs
docker compose logs -f

# Restart container
docker compose restart

# Rebuild and restart
docker compose down
docker compose up -d --build
```

### OpenClaw Commands

```bash
# Enter TUI
docker exec -it openclaw openclaw tui

# Run doctor
docker exec -it openclaw openclaw doctor

# Check pairing requests
docker exec -it openclaw openclaw pairing list telegram

# Approve pairing
docker exec -it openclaw openclaw pairing approve telegram <CODE>

# Check model status
docker exec -it openclaw openclaw models status
```

### Ollama Management

```bash
# List models
ollama list

# Check loaded models
ollama ps

# Pull new model
ollama pull qwen2.5:3b

# Unload model
ollama stop qwen2.5:3b
```

---

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker compose logs openclaw

# Common issues:
# 1. Invalid .env - run validate-env.sh
# 2. Config JSON error - check unified.json syntax
# 3. Docker socket permissions - verify group_add

# Fix permissions
sudo usermod -aG docker ubuntu
newgrp docker
docker compose up -d
```

### Agents Not Responding

```bash
# 1. Check container is running
docker compose ps

# 2. Check logs for errors
docker compose logs --tail=100

# 3. Verify Telegram bots are configured
docker exec -it openclaw openclaw config get channels.telegram

# 4. Check pairing status
docker exec -it openclaw openclaw pairing list telegram

# 5. Test with simple message
docker exec -it openclaw openclaw send --to <chat_id> "test"
```

### Ollama Connection Failed

```bash
# 1. Check Ollama is running on host
systemctl status ollama

# 2. Verify host.docker.internal resolves
docker exec -it openclaw ping host.docker.internal

# 3. Check config baseUrl ends with /v1
docker exec -it openclaw openclaw config get models.providers.ollama

# 4. Test Ollama directly from container
docker exec -it openclaw curl http://host.docker.internal:11434/api/tags
```

### High Memory Usage

```bash
# Check memory on instance
free -h

# Check what Ollama has loaded
ollama ps

# Unload unused models
ollama stop <model-name>

# If still high, restart container
docker compose restart
```

### Disk Space Low

```bash
# Check disk usage
df -h

# Clean Docker
docker system prune -af

# Remove old Ollama models
ollama rm <old-model>

# Clean apt cache
sudo apt-get clean
```

---

## Backup & Restore

### Manual Backup

```bash
# Backup .env locally
./scripts/utils/backup-env.sh --local

# Backup .env to S3
./scripts/utils/backup-env.sh --s3 --bucket my-bucket

# Backup entire instance (AMI)
aws ec2 create-image --instance-id <ID> --name "openclaw-backup-$(date +%Y%m%d)"
```

### Restore from Backup

```bash
# Restore .env from latest local backup
./scripts/utils/restore-env.sh --local --latest

# Restore .env from S3
./scripts/utils/restore-env.sh --s3 --latest --bucket my-bucket

# Restore from AMI
# 1. Launch new instance from AMI
# 2. Update .instance-info with new IP
# 3. Run health check
```

---

## Cost Management

### Stop Instance (Save Costs)

```bash
# Stop instance (keeps EIP and volume)
aws ec2 stop-instances --instance-ids <ID>

# Start instance (billing resumes)
aws ec2 start-instances --instance-ids <ID>

# After start, restart containers
ssh -i ~/.ssh/daatan-key.pem ubuntu@<IP> "cd ~/projects/openclaw && sg docker -c 'docker compose up -d'"
```

**Costs:**
- Running: ~$0.0336/hour (~$24/month)
- Stopped: ~$0.01/day (EIP + volume only)

### Monitor Token Usage

```bash
# Check usage in TUI
docker exec -it openclaw openclaw tui
# Type: /usage full

# Check Gemini API usage
# https://aistudio.google.com/app/apikey
```

### Optimize Model Routing

Current routing (cheapest to most expensive):
1. `ollama/qwen2.5:3b` - Free (local)
2. `dashscope/qwen-plus` - ~$0.004/1K tokens
3. `google/gemini-1.5-pro` - ~$0.007/1K tokens
4. `anthropic/claude-opus-4-6` - ~$0.015/1K tokens

To increase local fallback usage, adjust routing in `unified.json`.

---

## Security

### Rotate Deploy Key

```bash
# On instance, generate new key
ssh-keygen -t ed25519 -N "" -f ~/.ssh/id_github -C "openclaw-$(date +%Y%m%d)"

# Add to GitHub (both repos)
cat ~/.ssh/id_github.pub

# Update GitHub: Settings → Deploy keys → Add key
```

### Rotate API Keys

```bash
# 1. Generate new key in provider console
# 2. Update .env on instance
ssh ubuntu@<IP> "cd ~/projects/openclaw && nano .env"

# 3. Restart container
ssh ubuntu@<IP> "cd ~/projects/openclaw && docker compose restart"

# 4. Backup new .env
./scripts/utils/backup-env.sh --s3
```

### Check Sandbox Status

```bash
# Verify sandbox is enabled
docker exec -it openclaw openclaw config get agents.defaults.sandbox

# Should show: mode: "non-main"
```

---

## Monitoring

### CloudWatch Alarms (Recommended)

Create these alarms in AWS Console:

| Metric | Threshold | Action |
|--------|-----------|--------|
| CPU Utilization | > 80% for 5 min | Email |
| Memory Utilization | > 90% for 5 min | Email |
| Disk Utilization | > 85% | Email |
| Status Check Failed | Any | Email + SMS |

### Health Check Endpoint

```bash
# Run automated health check
./scripts/utils/health-check.sh <IP> --exit-on-error

# Add to cron for regular checks
crontab -e
# 0 */6 * * * /home/ubuntu/projects/openclaw/scripts/utils/health-check.sh >> /var/log/openclaw-health.log 2>&1
```

---

## Upgrade Procedures

### OpenClaw Version Upgrade

```bash
# Check current version
docker exec -it openclaw openclaw --version

# Update to latest
docker exec -it openclaw openclaw update --channel stable

# Or switch to beta
docker exec -it openclaw openclaw update --channel beta

# Restart container
docker compose restart

# Verify
docker exec -it openclaw openclaw --version
```

### Model Updates

```bash
# Pull new Ollama model
ssh ubuntu@<IP> "ollama pull qwen2.5:7b"

# Update config if needed
# Restart to apply
docker compose restart
```

---

## Emergency Procedures

### Instance Unreachable

1. Check AWS Console → EC2 → Instance status
2. If stopped: start instance
3. If terminated: restore from AMI or redeploy

### Data Loss Recovery

1. Restore .env from backup: `./scripts/utils/restore-env.sh --latest`
2. Re-run setup: `./scripts/provision/run-setup.sh`
3. Verify: `./scripts/utils/health-check.sh`

### Security Incident

1. Stop instance immediately: `aws ec2 stop-instances --instance-ids <ID>`
2. Rotate all API keys
3. Generate new deploy key
4. Review CloudTrail logs
5. Redeploy with fresh instance

---

## Contact & Support

| Resource | Link |
|----------|------|
| OpenClaw Docs | https://docs.openclaw.ai/ |
| GitHub | https://github.com/openclaw/openclaw |
| Discord | https://discord.gg/clawd |
| Internal DEPLOYMENT_PLAN.md | `infra/openclaw/DEPLOYMENT_PLAN.md` |

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-02-18 | Initial runbook created | Auto-generated |
