# DAATAN Deployment Guide

> Complete guide for deploying, managing, and troubleshooting DAATAN.
> Last updated: February 2026

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Pre-Deployment Checklist](#pre-deployment-checklist)
3. [Local Verification](#local-verification)
4. [Deployment Strategies](#deployment-strategies)
5. [Post-Deployment Verification](#post-deployment-verification)
6. [Rollback Procedures](#rollback-procedures)
7. [Monitoring & Health Checks](#monitoring--health-checks)
8. [Troubleshooting](#troubleshooting)
9. [Deployment Scenarios](#deployment-scenarios)
10. [Useful Commands](#useful-commands)

---

## Quick Start

### Prerequisites

- SSH access to EC2 instance (configured as `daatan-release` or `daatan-staging` in `~/.ssh/config`)
- SSH key: `~/.ssh/daatan-key.pem`
- Docker and Docker Compose installed on EC2
- GitHub CLI (`gh`) for local operations
- Access to secrets (see [SECRETS.md](./SECRETS.md))

### Verify Service Status

```bash
# Check production
curl https://daatan.com/api/health

# Check staging
curl https://staging.daatan.com/api/health

# Expected response:
# {"status":"ok","version":"1.x.x","timestamp":"..."}
```

---

## Pre-Deployment Checklist

### Code Review
- [ ] All changes reviewed and approved
- [ ] Tests passing locally (`npm test`)
- [ ] Build successful locally (`npm run build`)
- [ ] No console errors or warnings
- [ ] Linting passes (`npm run lint`)

### Documentation
- [ ] Commit messages are clear and descriptive
- [ ] README updated if needed
- [ ] API documentation updated if applicable

### Database
- [ ] No breaking schema changes
- [ ] Migrations tested locally
- [ ] Rollback plan documented
- [ ] Backup created (if production)

### Environment
- [ ] All environment variables set
- [ ] Secrets not committed to repo
- [ ] `.env` file not in git
- [ ] Configuration files reviewed

---

## Local Verification

Before pushing code, verify your changes locally to catch issues early.

### Automatic Verification (Git Hooks)

**Pre-Commit Hook:** Runs automatically on every commit
- Builds the application
- Runs all tests
- Runs linter (warning only)

**Pre-Push Hook:** Runs automatically before pushing
- Detects authentication-related changes
- Prompts for manual auth testing if needed

**To bypass hooks (use sparingly):**
```bash
git commit --no-verify
git push --no-verify
```

### Manual Verification Script

```bash
./scripts/verify-local.sh
```

**What it checks:**
- Node.js version (18+)
- Dependencies installed
- Git status
- Environment setup
- Build success
- All tests pass
- Linting issues

### Local Testing Checklist

Before pushing to staging:
- [ ] Code builds successfully (`npm run build`)
- [ ] All tests pass (`npm test`)
- [ ] No linting errors (`npm run lint`)
- [ ] Changes tested in local dev (`npm run dev`)
- [ ] Authentication tested if auth code changed
- [ ] Database migrations tested if schema changed

---

## Deployment Strategies

### 1. Standard Deployment (Automatic via CI/CD)

**Trigger:** Push to `main` → Staging deployment
**Trigger:** Push tag `v*` → Production deployment

```bash
# Verify locally first
./scripts/verify-local.sh

# Deploy to staging (automatic on push to main)
git push origin main

# Deploy to production (create version tag)
git tag v1.1.1
git push origin v1.1.1
```

**What happens:**
- GitHub Actions runs tests and builds
- Deploys to staging if on `main`
- Deploys to production if tag matches `v*`
- Verifies deployment with health checks

**Characteristics:**
- ~5-10 minute deployment time
- ~30 second downtime during container restart
- Automatic health verification

**Checklist:**
- [ ] Code pushed to correct branch
- [ ] GitHub Actions workflow triggered
- [ ] Build step completed successfully
- [ ] Tests passed in CI/CD
- [ ] Deployment step started

### 2. Blue-Green Deployment (Zero Downtime)

**Use when:** You need zero-downtime deployment with instant rollback

```bash
# Deploy to staging
ssh daatan-staging "cd ~/app && ./scripts/blue-green-deploy.sh staging"

# Deploy to production
ssh daatan-release "cd ~/app && ./scripts/blue-green-deploy.sh production"
```

**How it works:**
1. Builds new version in inactive container (green)
2. Runs health checks on new container
3. Switches nginx traffic to new container
4. Removes old container (blue)
5. Automatic rollback if health checks fail

**Characteristics:**
- ~3-5 minute deployment time
- Zero downtime
- Instant rollback capability

**Checklist:**
- [ ] SSH access verified
- [ ] Script is executable
- [ ] Environment variables set on server
- [ ] Deployment started
- [ ] Health checks passing

### 3. Manual Deployment (Direct SSH)

**Use when:** You need direct control or CI/CD is unavailable

```bash
ssh -i ~/.ssh/daatan-key.pem ubuntu@<EC2_IP>
cd ~/app
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build
./scripts/verify-deploy.sh https://daatan.com
```

**Checklist:**
- [ ] SSH access working
- [ ] Git pull successful
- [ ] Docker build completed
- [ ] Containers started
- [ ] Health check passed

---

## Post-Deployment Verification

### Immediate Checks (First 5 minutes)
- [ ] Health endpoint responds: `curl https://daatan.com/api/health`
- [ ] Staging health: `curl https://staging.daatan.com/api/health`
- [ ] No error logs: `docker logs daatan-app --tail 50`
- [ ] Nginx running: `docker ps | grep nginx`
- [ ] Database connected: `docker exec daatan-postgres pg_isready`

### Functional Checks (First 15 minutes)
- [ ] Homepage loads
- [ ] API endpoints respond
- [ ] Authentication works
- [ ] Database queries work
- [ ] No 502 errors in nginx logs

### Performance Checks (First 30 minutes)
- [ ] Page load times normal
- [ ] No memory leaks: `docker stats`
- [ ] CPU usage normal
- [ ] Response times acceptable

### Ongoing Monitoring
- [ ] Error rate normal
- [ ] Uptime maintained
- [ ] No unusual logs

---

## Rollback Procedures

### Quick Rollback (Recommended)

**Use when:** Current deployment is broken and you need to revert immediately

```bash
# Rollback staging
ssh -i ~/.ssh/daatan-key.pem ubuntu@<EC2_IP> \
  "cd ~/app && ./scripts/rollback.sh staging"

# Rollback production
ssh -i ~/.ssh/daatan-key.pem ubuntu@<EC2_IP> \
  "cd ~/app && ./scripts/rollback.sh production"
```

**What happens:**
1. Reverts to previous git commit
2. Rebuilds containers
3. Verifies deployment with health checks
4. Automatic abort if verification fails

**Time to rollback:** ~2-3 minutes

**Rollback Checklist:**
- [ ] Rollback script executed
- [ ] Health checks passed
- [ ] Services back online
- [ ] Previous version confirmed
- [ ] Team notified

### Manual Rollback

**Use when:** Rollback script fails or you need more control

```bash
ssh -i ~/.ssh/daatan-key.pem ubuntu@<EC2_IP>
cd ~/app
git log --oneline -5                    # Check git history
git checkout <commit-hash>              # Checkout previous commit
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d --build
./scripts/verify-deploy.sh https://daatan.com
```

### Database Rollback

**Use when:** Database migrations failed

```bash
docker exec daatan-app npx prisma migrate status
docker exec daatan-app npx prisma migrate resolve --rolled-back <migration-name>
docker exec daatan-app npx prisma migrate deploy
```

### Post-Rollback Actions
- [ ] Investigate root cause
- [ ] Document issue
- [ ] Fix in code
- [ ] Test thoroughly
- [ ] Plan re-deployment

---

## Monitoring & Health Checks

### Health Check Endpoints

```bash
curl https://daatan.com/api/health
curl https://staging.daatan.com/api/health
# Response: {"status":"ok","version":"...","timestamp":"..."}
```

### Container Status

```bash
docker ps -a                            # All containers
docker logs daatan-app --tail 100       # App logs
docker logs daatan-app-staging --tail 100
docker logs daatan-nginx --tail 100
docker logs daatan-postgres --tail 100
docker logs -f daatan-app               # Follow logs
```

### Database Health

```bash
docker exec daatan-postgres pg_isready -U daatan -d daatan
docker exec daatan-postgres psql -U daatan -d daatan \
  -c "SELECT pg_size_pretty(pg_database_size('daatan'));"
docker exec daatan-postgres psql -U daatan -d daatan -c "\dt"
```

### Nginx

```bash
docker exec daatan-nginx nginx -t       # Check config
docker exec daatan-nginx nginx -s reload # Reload without restart
docker logs daatan-nginx --tail 100
```

---

## Troubleshooting

### Service is Down

**Symptoms:** `curl https://daatan.com/api/health` returns error

1. Check container status: `docker ps -a`
2. Check logs: `docker logs daatan-app --tail 50`
3. Check nginx: `docker logs daatan-nginx --tail 50`
4. Restart containers: `docker compose -f docker-compose.prod.yml restart`
5. If still down, rollback: `./scripts/rollback.sh production`

### High CPU/Memory Usage

1. Check resource usage: `docker stats`
2. Check for memory leaks: `docker logs daatan-app | grep -i "memory\|heap"`
3. Restart container: `docker compose -f docker-compose.prod.yml restart app`
4. Check for stuck processes: `docker top daatan-app`

### Database Connection Errors

**Symptoms:** Logs show "connection refused" or "ECONNREFUSED"

1. Check postgres status: `docker ps | grep postgres`
2. Check postgres logs: `docker logs daatan-postgres --tail 50`
3. Verify connection: `docker exec daatan-postgres pg_isready -U daatan`
4. Restart postgres: `docker compose -f docker-compose.prod.yml restart postgres`
5. Check disk space: `df -h`

### Nginx 502 Errors

1. Check nginx config: `docker exec daatan-nginx nginx -t`
2. Check nginx logs: `docker logs daatan-nginx --tail 50`
3. Verify upstream containers: `docker ps | grep app`
4. Reload nginx: `docker exec daatan-nginx nginx -s reload`

### SSL Certificate Issues

1. Check certificate expiry: `docker exec daatan-certbot certbot certificates`
2. Check certificate files: `ls -la ~/app/certbot/conf/live/daatan.com/`
3. Manual renewal: `docker exec daatan-certbot certbot renew --force-renewal`
4. Restart nginx: `docker compose -f docker-compose.prod.yml restart nginx`

---

## Deployment Scenarios

### Regular Feature Deployment
1. Code reviewed and approved
2. Tests passing
3. Push to main (staging auto-deploys)
4. Verify staging health
5. Create version tag for production
6. Verify production health
7. Monitor for 30 minutes

### Hotfix Deployment
1. Create hotfix branch
2. Fix issue and add tests
3. Code reviewed
4. Merge to main → staging deploys
5. Verify staging
6. Create hotfix tag (e.g. `v1.1.1-hotfix`)
7. Monitor closely

### Database Migration
1. Migration tested locally
2. Backup created
3. Rollback plan documented
4. Deploy code with migration
5. Monitor database performance
6. Verify data integrity

### Emergency Rollback
1. Identify issue
2. Execute rollback script
3. Verify services online
4. Notify stakeholders
5. Investigate root cause
6. Plan fix and re-deploy

---

## Useful Commands

### View Logs

```bash
# Production app logs
ssh -i ~/.ssh/daatan-key.pem ubuntu@<EC2_IP> \
  "docker logs daatan-app --tail 100 -f"

# Staging app logs
ssh -i ~/.ssh/daatan-key.pem ubuntu@<EC2_IP> \
  "docker logs daatan-app-staging --tail 100 -f"

# Nginx logs
ssh -i ~/.ssh/daatan-key.pem ubuntu@<EC2_IP> \
  "docker logs daatan-nginx --tail 100 -f"
```

### Database Operations

```bash
# Connect to database
ssh -i ~/.ssh/daatan-key.pem ubuntu@<EC2_IP> \
  "docker exec -it daatan-postgres psql -U daatan -d daatan"

# Run migrations
ssh -i ~/.ssh/daatan-key.pem ubuntu@<EC2_IP> \
  "docker exec daatan-app npx prisma migrate deploy"

# Backup database
ssh -i ~/.ssh/daatan-key.pem ubuntu@<EC2_IP> \
  "docker exec daatan-postgres pg_dump -U daatan daatan | gzip > ~/backups/daatan_\$(date +%Y%m%d_%H%M%S).sql.gz"
```

### Container Management

```bash
# Restart all services
ssh -i ~/.ssh/daatan-key.pem ubuntu@<EC2_IP> \
  "cd ~/app && docker compose -f docker-compose.prod.yml restart"

# Stop all services
ssh -i ~/.ssh/daatan-key.pem ubuntu@<EC2_IP> \
  "cd ~/app && docker compose -f docker-compose.prod.yml down"

# Start all services
ssh -i ~/.ssh/daatan-key.pem ubuntu@<EC2_IP> \
  "cd ~/app && docker compose -f docker-compose.prod.yml up -d"

# Rebuild and restart
ssh -i ~/.ssh/daatan-key.pem ubuntu@<EC2_IP> \
  "cd ~/app && docker compose -f docker-compose.prod.yml up -d --build"
```

---

## Related Documentation

- [TECH.md](./TECH.md) — Technical architecture and infrastructure
- [SECRETS.md](./SECRETS.md) — Secrets management
- [VERSIONING.md](./VERSIONING.md) — Semantic versioning rules
