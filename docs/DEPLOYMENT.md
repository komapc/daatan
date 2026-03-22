# Deployment Guide

## Overview

Daatan uses a blue-green deployment strategy on a single AWS EC2 instance that hosts
both the **production** and **staging** containers side-by-side. Docker images are
stored in Amazon ECR. All server access goes through AWS SSM (no open SSH port).

```
GitHub → CI/CD (GitHub Actions) → ECR → EC2 via SSM → Blue-green swap → Health check
```

---

## Environments

| Environment | URL                        | Trigger              | Image tag       |
|-------------|----------------------------|----------------------|-----------------|
| Staging     | https://staging.daatan.com | Push to `main`       | `staging-latest`|
| Production  | https://daatan.com         | Git tag `v*`         | `1.7.X`         |

Both environments run on the same EC2 instance (`Environment=staging` tag,
`i-0286f62b47117b85c`). The production EC2 instance is unused.

---

## Standard Release Flow

### 1. Develop on a feature branch

```bash
git checkout -b feat/my-feature
# ... make changes ...
git commit -m "feat: add something"
git push -u origin feat/my-feature
```

No version bump is required on feature branches.

### 2. Open and merge a PR

Create a PR targeting `main`. When merged:
- CI builds the Docker image and pushes it to ECR as `staging-latest`
- The staging environment is updated automatically
- Monitor: https://staging.daatan.com/api/health

### 3. Release to production

When staging looks good, bump the version and push a tag:

```bash
git checkout main && git pull

# Bump patch version (updates package.json + creates a git commit + tag)
npm version patch

# Push the commit and the tag together
git push --follow-tags
```

This triggers **two** CI runs:
1. The main branch push → rebuilds and redeploys staging
2. The tag push → builds the versioned image (`1.7.X`), verifies staging, deploys to production

> **Version in `src/lib/version.ts`**: After running `npm version patch`, also update
> the `// v1.X.Y` comment in `src/lib/version.ts` to match. This keeps the file
> human-readable (the comment is not used at runtime — the actual version comes from
> `NEXT_PUBLIC_APP_VERSION` baked in at Docker build time).

---

## Version Management

- **Single source of truth**: `package.json` → `version` field
- **Human hint**: `src/lib/version.ts` contains a `// v1.X.Y` comment that must match
- **Runtime value**: `NEXT_PUBLIC_APP_VERSION` build arg (set by CI from `package.json`)
- **Pre-commit hook**: `scripts/check-version-bump.sh` — verifies the two files agree
  whenever both are staged; does **not** require a bump on feature branches

### Bump commands

```bash
npm version patch   # 1.7.5 → 1.7.6  (bug fixes, small changes)
npm version minor   # 1.7.6 → 1.8.0  (new features)
npm version major   # 1.8.0 → 2.0.0  (breaking changes)
```

`npm version` automatically commits and tags. Follow with `git push --follow-tags`.

---

## CI/CD Pipeline (`deploy.yml`)

### Jobs

```
build ──┬──► deploy-staging   (on push to main)
        └──► deploy-production (on tag push v*)
```

### `build` job

1. Install dependencies, type-check, lint
2. Run unit tests
3. Build Next.js app (with dummy DB URL)
4. Security audit
5. Check env var parity between `blue-green-deploy.sh` and `docker-compose.prod.yml`
6. Build Docker image and push to ECR (skipped on PRs)

### `deploy-staging` job

1. Configure AWS credentials (OIDC)
2. Check EC2 SSM health
3. SSM command to server: download deploy scripts, pull `staging-latest` from ECR, run `blue-green-deploy.sh staging`
4. Poll command status (via `.github/actions/ssm-deploy`)
5. Verify `https://staging.daatan.com/api/health` reports correct version
6. Send Telegram notification

### `deploy-production` job

1. Configure AWS credentials
2. Resolve version from tag name
3. Verify staging version ≥ production target (safety gate)
4. Check EC2 SSM health
5. SSM command: pull versioned image from ECR, run `blue-green-deploy.sh production`
6. Poll + verify (via `.github/actions/ssm-deploy`)
7. Send Telegram notification

### Composite action: `.github/actions/ssm-deploy`

Eliminates the duplicate SSM polling loop and health check used by both deploy jobs.
Inputs: `command-id`, `health-url`, `app-version`.

---

## Infrastructure

### EC2 Instance

- **Instance**: `i-0286f62b47117b85c` (tag `Name=daatan-backend`, `Environment=staging`)
- **Access**: AWS SSM only — port 22 is closed
- **Role**: `daatan-ec2-role-staging` (allows ECR pull + SSM)

### ECR Registry

- Registry: `272007598366.dkr.ecr.eu-central-1.amazonaws.com`
- Repository: `daatan-app`
- Tags: `staging-latest`, `main`, `1.7.X`, `sha-<commit>`

### Blue-green deployment

`scripts/blue-green-deploy.sh` manages two Docker containers:
- One currently serving traffic
- One being updated

After the new container passes health checks, nginx is reconfigured to point to it.
The old container is kept briefly as a rollback target.

---

## Manual / Emergency Operations

### Manual staging deploy (workflow dispatch)

Go to **Actions → CI/CD Pipeline → Run workflow**, select `staging`.

### Manual production deploy (workflow dispatch)

Go to **Actions → CI/CD Pipeline → Run workflow**, select `production`, enter the
version tag (e.g. `v1.7.42`).

### Rollback production

Tag the previous known-good commit and push:

```bash
git tag v1.7.X <commit-sha>
git push origin v1.7.X
```

### View live logs

Use the `/logs` slash command in Claude Code, or the `/prod-status` command for a
full health check. See `.claude/commands/` for details.

---

## Required Secrets

| Secret                      | Used by                              |
|-----------------------------|--------------------------------------|
| `AWS_ROLE_ARN`              | OIDC auth for all AWS operations     |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Baked into Docker image at build  |
| `TELEGRAM_BOT_TOKEN`        | Deploy success/failure notifications |
| `TELEGRAM_CHAT_ID`          | Deploy notifications target          |
| `BOT_RUNNER_SECRET`         | Bot cron trigger (`bots.yml`)        |
| `STAGING_URL`               | Bot cron target URL                  |
| `OPENROUTER_API_KEY`        | Bot LLM calls (staging only)         |
