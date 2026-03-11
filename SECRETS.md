# Secrets Management

**If sign-in works on staging but not production (or vice versa):** see [docs/TROUBLESHOOTING-AUTH.md](docs/TROUBLESHOOTING-AUTH.md) for step-by-step checks (server `.env`, Google Console redirect URIs, health checks).

## Current Approach

**Status:** Using `.env` files on server + **AWS Secrets Manager for Backup**

### What We Use

| Secret | Location | Purpose |
|--------|----------|---------|
| `POSTGRES_PASSWORD` | Server `.env` | Database authentication |
| `NEXTAUTH_SECRET` | Server `.env` | NextAuth.js session encryption |
| `GOOGLE_CLIENT_ID` | Server `.env` | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | Server `.env` | Google OAuth |
| `GEMINI_API_KEY` | Server `.env` | LLM API access |
| `SERPER_API_KEY` | Server `.env` | Serper.dev API for Express Forecast web search |
| `GA_MEASUREMENT_ID_PROD` | Server `.env` | Google Analytics 4 — production (daatan.com) |
| `GA_MEASUREMENT_ID_STAGING` | Server `.env` | Google Analytics 4 — staging (staging.daatan.com) |
| `TELEGRAM_BOT_TOKEN` | Server `.env` + GitHub Secret | @DaatanClawBot token from @BotFather |
| `TELEGRAM_CHAT_ID` | Server `.env` + GitHub Secret | "Daatan Updates" channel ID (`-1003759282672`) |
| `BOT_RUNNER_SECRET` | Server `.env` + GitHub Secret | Shared secret for `/api/bots/run` cron endpoint |
| `OPENROUTER_API_KEY` | Server `.env` + GitHub Secret | OpenRouter LLM API key (used by bots) |
| `RESEND_API_KEY` | Server `.env` | Email delivery via Resend |
| `VAPID_PUBLIC_KEY` | Server `.env` | Browser push notification public key |
| `VAPID_PRIVATE_KEY` | Server `.env` | Browser push notification private key |
| `CRON_SECRET` | Server `.env` + GitHub Secret | Shared secret for `/api/cron/cleanup` endpoint |

### Current Setup

**Location:** `~/app/.env` on EC2 server (use `terraform output ec2_public_ip` to get IP)

**Access:** SSH with key-based auth (`~/.ssh/daatan-key-new.pem`)

**Permissions:** 
- File: `600` (owner read/write only)
- Directory: `700` (owner access only)

### Pros & Cons

✅ **Pros:**
- Simple to set up
- No external dependencies
- Works well for small teams
- Easy to debug

❌ **Cons:**
- Secrets stored in plaintext on disk
- No audit trail of access
- Manual rotation process
- Risk if server is compromised
- No automatic expiration

---

## Best Practices (Current)

### 1. File Permissions

```bash
# Ensure .env is not readable by others
chmod 600 ~/app/.env

# Verify permissions
ls -la ~/app/.env
# Should show: -rw------- (600)
```

### 2. Never Commit Secrets

```bash
# .gitignore already includes:
.env
.env.local
.env.production
```

### 3. Rotate Secrets Regularly

**Recommended schedule:**
- `NEXTAUTH_SECRET`: Every 90 days
- `GOOGLE_CLIENT_SECRET`: When compromised or annually
- `POSTGRES_PASSWORD`: Every 180 days
- `GEMINI_API_KEY`: When compromised or annually

**Rotation process:**
1. Generate new secret
2. Update `.env` on server
3. Restart affected containers
4. Verify services work
5. Update backup/documentation

### 4. Backup Secrets Securely

**DO:**
- Store encrypted backup in password manager (1Password, Bitwarden)
- Keep offline backup in secure location
- Document secret purpose and rotation date

**DON'T:**
- Email secrets
- Store in Slack/Discord
- Commit to git
- Share via unencrypted channels

---

## Future Improvements

### Short-term (Next 3-6 months)

### 1. AWS Secrets Manager (Active Backup)
**Status:** Implemented (Sync Only)
- Secrets are stored in AWS Secrets Manager for backup and recovery.
- **Secret Names:** `daatan-env-staging`, `daatan-env-prod`.
- **Sync Process:** manually run `aws secretsmanager put-secret-value` after updating `.env`.

**Usage:**
```bash
# Backup current .env to AWS
aws secretsmanager put-secret-value \
  --secret-id daatan-env-staging \
  --secret-string "file://.env"

# Restore .env from AWS
aws secretsmanager get-secret-value \
  --secret-id daatan-env-staging \
  --query SecretString \
  --output text > .env
```

### 2. VAPID Keys (Browser Push Notifications)

VAPID keys authenticate our server when sending Web Push notifications. Two keys are required:

| Key | Where set | Notes |
|-----|-----------|-------|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Server `.env` **+ GitHub Actions secret** | Baked into the JS bundle at build time — must be a GitHub secret so CI can pass it to `next build` |
| `VAPID_PRIVATE_KEY` | Server `.env` only | Runtime only, never exposed to the client |

**Generating new keys:**
```bash
npx web-push generate-vapid-keys
# Outputs:
# Public Key:  Bxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# Private Key: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**After generating:**
1. Update `NEXT_PUBLIC_VAPID_PUBLIC_KEY` in the GitHub Actions secret (Settings → Secrets → `NEXT_PUBLIC_VAPID_PUBLIC_KEY`)
2. Update both keys in `~/app/.env` on the server
3. Restart the app container: `docker restart daatan-app` / `daatan-app-staging`
4. Sync to AWS Secrets Manager

**Key rotation (if push subscriptions break):**
- All existing push subscriptions become invalid after key rotation — users must re-subscribe
- The client re-subscribes automatically on next page load (service worker checks the public key)
- Rotate only when the private key is compromised; otherwise leave keys unchanged

---

## VAPID Key Rotation Runbook

### When to Rotate VAPID Keys

**Planned rotation:** Annually (as preventative security measure)
**Emergency rotation:** If private key is compromised

### Grace Period Strategy (Zero Subscription Loss)

VAPID keys are public-private keypairs. Unlike session tokens, rotating them requires clients to re-subscribe — but we can minimize disruption:

1. **Stage 1: Deploy new keys (no impact yet)**
   - Generate new keypair
   - Update `.env` with both old and new private keys (as `VAPID_PRIVATE_KEY_OLD`)
   - Update GitHub secret and deploy without restarting app
   - No client impact yet — app still uses old key to accept subscriptions

2. **Stage 2: Accept both old and new subscriptions (72-hour grace period)**
   - Modify service worker to accept subscriptions for BOTH public keys
   - Update frontend to prompt users to re-enable notifications if they have old subscription
   - Log which subscriptions use which key for monitoring
   - Duration: 72 hours (gives users time to update)

3. **Stage 3: Send push with new key only (after grace period)**
   - After 72 hours, delete `VAPID_PRIVATE_KEY_OLD` from `.env`
   - Restart app to use only new key
   - Delete old subscriptions from database (optional cleanup)
   - Monitor for subscription failures

### Step-by-Step Runbook

**Prerequisites:**
- Notify team via Slack that VAPID rotation is happening
- Schedule rotation during low-traffic period (e.g., Friday evening UTC)

**Stage 1: Generate and Deploy New Keys (Day 0)**

```bash
# Generate new keypair
npx web-push generate-vapid-keys

# Copy the Public and Private keys from output
# Public Key:  <NEW_PUBLIC>
# Private Key: <NEW_PRIVATE>
```

Update server `.env`:
```bash
# SSH to server
ssh -i ~/.ssh/daatan-key-new.pem ubuntu@<PROD_IP>

# Edit .env on server
sudo nano ~/app/.env

# Modify (keep old key for grace period):
VAPID_PRIVATE_KEY=<NEW_PRIVATE>
VAPID_PRIVATE_KEY_OLD=<OLD_PRIVATE>
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<NEW_PUBLIC>
```

Update GitHub Secrets:
- Go to repo Settings → Secrets and variables → Actions
- Edit `NEXT_PUBLIC_VAPID_PUBLIC_KEY` with `<NEW_PUBLIC>`
- Commit a no-op change to trigger CI/CD (e.g., update ROTATION_DATE in `.env.example`)
- Verify build succeeds but **do not restart containers yet**

**Stage 2: Accept Both Keys (72-hour grace period)**

Update `src/app/layout.tsx` (or wherever service worker registers):
```tsx
// Register service worker to accept both old and new public keys
const register = async () => {
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.register('/sw.js')
    // Check which public key was used for existing subscriptions
    const subscription = await registration.pushManager.getSubscription()
    if (subscription && !subscription.endpoint.includes('<NEW_PUBLIC>')) {
      // Prompt user to re-enable notifications
      console.warn('Old VAPID key detected — re-subscribing')
      await subscription.unsubscribe()
      await registration.pushManager.subscribe({...}) // re-subscribe with new key
    }
  }
}
```

Restart app container to activate grace period:
```bash
ssh -i ~/.ssh/daatan-key-new.pem ubuntu@<PROD_IP>
docker restart daatan-app  # or daatan-app-staging
```

Verify notifications still work:
- Test push notification from admin panel
- Check server logs for subscription errors
- Monitor Sentry for WebPush failures

Document grace period end date:
- Add to Slack reminder: "VAPID grace period ends on [DATE]"
- Update calendar with Phase 3 date

**Stage 3: Cleanup (After 72 hours)**

Remove old key and restart:
```bash
ssh -i ~/.ssh/daatan-key-new.pem ubuntu@<PROD_IP>

# Remove old key from .env
sudo nano ~/app/.env
# Delete line: VAPID_PRIVATE_KEY_OLD=...

# Restart app
docker restart daatan-app  # or daatan-app-staging

# Verify no WebPush failures in logs
docker logs daatan-app | grep -i "webpush\|subscription"
```

Clean up database (optional):
```sql
-- Delete expired subscriptions (older than grace period)
DELETE FROM "push_subscriptions"
WHERE "createdAt" < NOW() - INTERVAL '72 hours'
  AND "endpoint" NOT LIKE '%new_key_endpoint%';
```

Backup new keys:
```bash
# Add to password manager with rotation date
VAPID_PUBLIC_KEY: <NEW_PUBLIC>
VAPID_PRIVATE_KEY: <NEW_PRIVATE>
Rotated: [DATE]
```

Notify team:
- Post in Slack: "✅ VAPID key rotation complete — no user action required"
- Update SECRETS.md last rotation date

### Monitoring During Grace Period

Check for failed subscriptions:
```bash
docker logs daatan-app | grep -E "PushSubscriptionChangeEvent|failed.*subscription" | tail -20
```

Monitor push notification success rate:
- Check app metrics dashboard for push delivery success %
- Alert if success rate drops below 95%

### Rollback Procedure (if issues occur)

If push notifications fail during grace period:

```bash
ssh -i ~/.ssh/daatan-key-new.pem ubuntu@<PROD_IP>

# Revert to old key
sudo nano ~/app/.env
# Restore old key, remove new key and _OLD suffix

docker restart daatan-app

# Notify team
```

### Timeline Reference

| Phase | Duration | Action | Impact |
|-------|----------|--------|--------|
| **Stage 1** | 1 hour | Generate keys, deploy to GitHub/server | None — app still uses old key |
| **Stage 2** | 72 hours | Accept both keys, grace period | Users see re-enable prompt, transparent to most |
| **Stage 3** | 1 hour | Delete old key, cleanup | No impact — grace period complete |

### FAQ

**Q: Why do we need a grace period?**
A: VAPID subscriptions are client-side objects that store the public key used to subscribe. Rotating the key invalidates all existing subscriptions. Without a grace period, users would lose notifications until they manually re-enable. With grace period, the service worker detects stale subscriptions and re-subscribes automatically in the background.

**Q: Will users see a re-enable prompt?**
A: Only if their browser permission state is "default" (not explicitly granted). Most users grant permission once and forget, so they won't see anything. If they see a re-enable prompt, a single click fixes it.

**Q: Can we rotate without disrupting subscriptions?**
A: No — VAPID keys are cryptographically linked to subscription payloads. Once rotated, all old subscriptions are cryptographically invalid. The grace period just minimizes perceived disruption.

**Q: What if we forget to update GitHub Secret?**
A: The next CI build will fail at `next build` step (NEXT_PUBLIC_VAPID_PUBLIC_KEY will be undefined). App won't build. Update the secret and re-trigger CI.

**Q: How often should we rotate?**
A: Annually as preventative measure. Emergency rotation only if private key is leaked.

### 3. Google Client Secret Rotation
**When:** If `invalid_client` errors appear in logs or Google Cloud Console integrity is compromised.
1.  **Generate New Secret:** Go to Google Cloud Console > Credentials > OAuth 2.0 Client IDs > Reset Secret.
2.  **Update Config:**
    *   Update `.env` on both Staging and Production EC2 instances.
    *   Update local `.env`.
    *   Sync to AWS Secrets Manager (see above).
3.  **Restart Containers:** `docker restart daatan-app` (Prod) / `daatan-app-staging` (Staging).

---

## Migration Plan

### Phase 1: Audit ~~(Week 1)~~ — Done
- [x] Document all secrets currently in use (see table above)
- [x] Identify which secrets are shared vs unique
- [x] Determine rotation schedule for each secret
- [ ] Set up password manager for team

### Phase 2: AWS Secrets Manager ~~(Week 2-3)~~ — Partial
- [x] Create AWS Secrets Manager secrets (`daatan-env-prod`, `daatan-env-staging`)
- [x] IAM policies scoped to specific secret ARNs
- [x] EC2 user data retrieves secrets on bootstrap
- [ ] Update application to read from Secrets Manager at runtime (currently reads `.env`)
- [ ] Automate sync (currently manual `aws secretsmanager put-secret-value`)
- [ ] Remove secrets from `.env` (keep as fallback)

### Phase 3: Automation (Week 4)
- [ ] Set up automatic rotation for database passwords
- [ ] Create rotation Lambda functions
- [ ] Document new process
- [ ] Train team on new workflow

### Phase 4: Cleanup (Week 5)
- [ ] Remove `.env` files from servers
- [ ] Update deployment scripts
- [ ] Update documentation
- [ ] Conduct security review

---

## Emergency Procedures

### If Secrets Are Compromised

**Immediate actions (within 1 hour):**
1. Rotate all affected secrets
2. Review access logs for unauthorized access
3. Check for data exfiltration
4. Notify team

**Follow-up actions (within 24 hours):**
1. Conduct security audit
2. Update all documentation
3. Review and improve security practices
4. Consider migrating to Secrets Manager

### If Server Is Compromised

**Immediate actions:**
1. Isolate server (security group rules)
2. Rotate ALL secrets
3. Take snapshot for forensics
4. Deploy new clean server
5. Restore from known-good backup

---

## Secrets Checklist

### Adding New Secret

- [ ] Add to `.env.example` with placeholder value
- [ ] Document in this file (SECRETS.md)
- [ ] Add to server `.env` file
- [ ] Restart affected containers
- [ ] Test in staging first
- [ ] Store backup in password manager
- [ ] Update deployment documentation

### Rotating Secret

- [ ] Generate new secret value
- [ ] Update in password manager
- [ ] Update server `.env` file
- [ ] Restart affected containers
- [ ] Verify services work
- [ ] Document rotation date
- [ ] Remove old secret after 24h grace period

---

## FAQ

**Q: Why not use GitHub Secrets?**
A: GitHub Secrets are for CI/CD workflows, not runtime secrets. They're exposed to GitHub Actions runners and shouldn't be used for production secrets.

**Q: Can I use environment variables in Docker Compose?**
A: Yes, we currently do this. Docker Compose reads from `.env` file. This is acceptable for MVP but should migrate to Secrets Manager.

**Q: How do I add a new secret?**
A: 
1. Add to `.env.example` (without real value)
2. SSH to server: `ssh daatan`
3. Edit `.env`: `nano ~/app/.env`
4. Add: `NEW_SECRET="value"`
5. Restart: `docker compose -f docker-compose.prod.yml restart app-staging`

**Q: What if I accidentally commit a secret?**
A: 
1. Immediately rotate the secret
2. Remove from git history: `git filter-branch` or BFG Repo-Cleaner
3. Force push to remote
4. Notify team
5. Review commit access

---

## Resources

- [AWS Secrets Manager Pricing](https://aws.amazon.com/secrets-manager/pricing/)
- [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [12-Factor App: Config](https://12factor.net/config)
- [HashiCorp Vault](https://www.vaultproject.io/)

---

Last updated: March 5, 2026
