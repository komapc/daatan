# AWS Secrets Manager Setup for OpenClaw

**Security:** API keys are now stored in AWS Secrets Manager, not in `.env` files.

---

## Quick Setup

### 1. Initialize Secrets

```bash
cd infra/openclaw

# Initialize with OpenRouter key (already provided)
./scripts/utils/secrets.sh init
```

### 2. Add Remaining Secrets

```bash
# Gemini API Key
./scripts/utils/secrets.sh set openclaw/gemini-api-key "AIza..."

# Telegram Bot Tokens (from @BotFather)
./scripts/utils/secrets.sh set openclaw/telegram-bot-token-daatan "123456:ABC..."
./scripts/utils/secrets.sh set openclaw/telegram-bot-token-calendar "789012:DEF..."

# Optional: Anthropic API Key
./scripts/utils/secrets.sh set openclaw/anthropic-api-key "sk-ant-..."
```

### 3. Verify Secrets

```bash
# List all secrets
./scripts/utils/secrets.sh list

# Get a specific secret
./scripts/utils/secrets.sh get openclaw/openrouter-api-key
```

### 4. Generate .env (Optional - for local testing)

```bash
./scripts/utils/secrets.sh sync from-aws
```

---

## How It Works

### Local Machine

```
┌─────────────────────────────────────────────────────────┐
│  Your Laptop                                            │
│                                                         │
│  1. Run: secrets.sh set openclaw/gemini-api-key "..."  │
│  2. Secret stored in AWS Secrets Manager                │
│  3. .env file NOT needed (gitignored anyway)            │
└─────────────────────────────────────────────────────────┘
                          │
                          │ AWS API
                          ▼
┌─────────────────────────────────────────────────────────┐
│  AWS Secrets Manager                                    │
│                                                         │
│  - openclaw/gemini-api-key                             │
│  - openclaw/openrouter-api-key                         │
│  - openclaw/telegram-bot-token-daatan                  │
│  - openclaw/telegram-bot-token-calendar                │
└─────────────────────────────────────────────────────────┘
```

### EC2 Instance

```
┌─────────────────────────────────────────────────────────┐
│  EC2 Instance (on boot)                                 │
│                                                         │
│  1. user-data.sh runs via cloud-init                    │
│  2. IAM role grants Secrets Manager access              │
│  3. Fetches all secrets automatically                   │
│  4. Creates .env file with secret values                │
│  5. Containers start with populated .env                │
└─────────────────────────────────────────────────────────┘
```

---

## Terraform IAM Role

The EC2 instance gets an IAM role with this policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ],
      "Resource": "arn:aws:secretsmanager:eu-central-1:272007598366:secret:openclaw/*"
    }
  ]
}
```

**Security:**
- ✅ Secrets never stored in Terraform state
- ✅ No secrets in user-data script
- ✅ IAM role attached to instance, not user
- ✅ Least privilege (only openclaw/* secrets)

---

## Secret Names

| Secret | Purpose | Required |
|--------|---------|----------|
| `openclaw/gemini-api-key` | Google Gemini API | Yes |
| `openclaw/openrouter-api-key` | OpenRouter (Qwen fallback) | Yes |
| `openclaw/telegram-bot-token-daatan` | @DaatanBot | Yes |
| `openclaw/telegram-bot-token-calendar` | @CalendarBot | Yes |
| `openclaw/anthropic-api-key` | Anthropic Claude (optional) | No |

---

## Commands Reference

### Initialize

```bash
./scripts/utils/secrets.sh init
```

Stores the OpenRouter key you provided.

### Set Secret

```bash
./scripts/utils/secrets.sh set <secret-name> <value>
```

Example:
```bash
./scripts/utils/secrets.sh set openclaw/gemini-api-key "AIzaSyD..."
```

### Get Secret

```bash
./scripts/utils/secrets.sh get <secret-name>
```

Example:
```bash
./scripts/utils/secrets.sh get openclaw/openrouter-api-key
```

### List Secrets

```bash
./scripts/utils/secrets.sh list
```

### Delete Secret

```bash
# Schedule deletion (7-day recovery)
./scripts/utils/secrets.sh delete openclaw/gemini-api-key

# Force delete (no recovery)
./scripts/utils/secrets.sh delete openclaw/gemini-api-key --force
```

### Sync .env

```bash
# From AWS to local .env
./scripts/utils/secrets.sh sync from-aws

# From local .env to AWS
./scripts/utils/secrets.sh sync to-aws
```

### Fetch on EC2

```bash
# Run on EC2 instance
./scripts/utils/secrets.sh fetch-ec2
```

---

## AWS Console Access

You can also manage secrets via AWS Console:

1. Visit: https://eu-central-1.console.aws.amazon.com/secretsmanager/
2. Filter by name: `openclaw`
3. Click secret → Retrieve secret value

---

## Security Best Practices

### ✅ Do

- Store all API keys in Secrets Manager
- Use IAM roles for EC2 access
- Rotate keys periodically
- Monitor access via CloudTrail

### ❌ Don't

- Commit `.env` to git (already gitignored)
- Share keys via chat/email
- Use same key across environments
- Store keys in Terraform variables

---

## Rotation

### Rotate a Secret

```bash
# 1. Generate new key in provider console
# 2. Update in Secrets Manager
./scripts/utils/secrets.sh set openclaw/gemini-api-key "new-key"

# 3. Restart containers on EC2
ssh ubuntu@<IP> "cd ~/projects/openclaw && docker compose restart"
```

### Automated Rotation (Future)

For automatic rotation, consider:
- AWS Secrets Manager rotation Lambda
- Custom rotation script in `scripts/utils/rotate-secrets.sh`

---

## Cost

| Item | Cost |
|------|------|
| Secrets stored | $0.40/month per secret |
| API calls (GetSecretValue) | First 10K free, then $0.05/100 calls |
| **Estimated monthly** | ~$2-3 (5 secrets + calls) |

---

## Troubleshooting

### "AccessDenied" on EC2

```bash
# Check IAM role is attached
aws ec2 describe-instances --instance-ids <ID> | grep IamInstanceProfile

# Check policy
aws iam get-role-policy --role-name openclaw-secrets-role --policy-name openclaw-secrets-policy
```

### "Secret not found"

```bash
# List secrets
./scripts/utils/secrets.sh list

# Check region
export AWS_REGION=eu-central-1
```

### user-data.sh Failed

```bash
# Check logs on EC2
ssh ubuntu@<IP> "cat /var/log/user-data.log"

# Check cloud-init
ssh ubuntu@<IP> "cat /var/log/cloud-init-output.log"
```

---

## Migration from .env

If you have existing `.env` files:

```bash
# 1. Backup current .env
cp infra/openclaw/.env infra/openclaw/.env.backup

# 2. Sync to Secrets Manager
./scripts/utils/secrets.sh sync to-aws

# 3. Verify
./scripts/utils/secrets.sh list

# 4. Delete local .env (secrets now in AWS)
rm infra/openclaw/.env
```

---

## Links

| Resource | URL |
|----------|-----|
| AWS Secrets Manager | https://aws.amazon.com/secrets-manager/ |
| Pricing | https://aws.amazon.com/secrets-manager/pricing/ |
| IAM Role Docs | https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles.html |
