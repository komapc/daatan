# Secrets Management

## Current Approach

**Status:** Using `.env` files on server + **AWS Secrets Manager for Backup**

### What We Use

| Secret | Location | Purpose |
| Secret | Location | Purpose |
|--------|----------|---------|
| `POSTGRES_PASSWORD` | Server `.env` | Database authentication |
| `NEXTAUTH_SECRET` | Server `.env` | NextAuth.js session encryption |
| `GOOGLE_CLIENT_ID` | Server `.env` | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | Server `.env` | Google OAuth |
| `GEMINI_API_KEY` | Server `.env` | LLM API access |
| `SERPER_API_KEY` | Server `.env` | Serper.dev API for Express Forecast web search |

### Current Setup

**Location:** `~/app/.env` on EC2 server (52.59.160.186)

**Access:** SSH with key-based auth (`~/.ssh/daatan-key.pem`)

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

### 2. Google Client Secret Rotation
**When:** If `invalid_client` errors appear in logs or Google Cloud Console integrity is compromised.
1.  **Generate New Secret:** Go to Google Cloud Console > Credentials > OAuth 2.0 Client IDs > Reset Secret.
2.  **Update Config:**
    *   Update `.env` on **Staging** (`i-0286f62b47117b85c`) and **Production** (`i-02105582701f77d29`).
    *   Update local `.env`.
    *   Sync to AWS Secrets Manager (see above).
3.  **Restart Containers:** `docker restart daatan-app` (Prod) / `daatan-app-staging` (Staging).

---

## Migration Plan

### Phase 1: Audit (Week 1)
- [ ] Document all secrets currently in use
- [ ] Identify which secrets are shared vs unique
- [ ] Determine rotation schedule for each secret
- [ ] Set up password manager for team

### Phase 2: AWS Secrets Manager (Week 2-3)
- [ ] Create AWS Secrets Manager secrets
- [ ] Update application to read from Secrets Manager
- [ ] Test in staging environment
- [ ] Deploy to production
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

Last updated: February 5, 2026
