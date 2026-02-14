# DAATAN Deployment Guide

> Complete guide for deploying, managing, and troubleshooting DAATAN infrastructure.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Local Verification](#local-verification)
3. [Deployment Strategies](#deployment-strategies)
4. [Rollback Procedures](#rollback-procedures)
5. [Monitoring & Health Checks](#monitoring--health-checks)
6. [Troubleshooting](#troubleshooting)
7. [Infrastructure](#infrastructure)

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
# {"status":"ok","timestamp":"2026-01-25T14:04:18.46..."}
```

---

## Local Verification

Before pushing code to staging, verify your changes locally to catch issues early.

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

Run comprehensive verification before pushing:

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

**When to use:**
- Before creating a pull request
- After making significant changes
- When pre-commit hooks are bypassed
- To verify everything works locally

### Local Testing Checklist

Before pushing to staging:
- [ ] Code builds successfully (`npm run build`)
- [ ] All tests pass (`npm test`)
- [ ] No linting errors (`npm run lint`)
- [ ] Changes tested in local dev environment (`npm run dev`)
- [ ] Authentication tested if auth code changed
- [ ] Database migrations tested if schema changed

---

## Deployment Strategies

### 1. Standard Deployment (Automatic via CI/CD)

**Trigger:** Push to `main` branch → Staging deployment
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

### 2. Blue-Green Deployment (Zero Downtime)

**Use when:** You need zero-downtime deployment with instant rollback capability

```bash
# Deploy to staging with zero downtime
ssh daatan-staging "cd ~/app && ./scripts/blue-green-deploy.sh staging"

# Deploy to production with zero downtime
ssh daatan-release "cd ~/app && ./scripts/blue-green-deploy.sh production"
```

**How it works:**
1. Builds new version in inactive container (green)
2. Runs health checks on new container
3. Switches nginx traffic to new container
4. Removes old container (blue)
5. Automatic rollback if health checks fail

**Advantages:**
- Zero downtime
- Instant rollback if issues detected
- Old container kept until new one is healthy

### 3. Manual Deployment (Direct SSH)

**Use when:** You need direct control or CI/CD is unavailable

```bash
# SSH into EC2
ssh -i ~/.ssh/daatan-key.pem ubuntu@52.59.160.186

# Navigate to app directory
cd ~/app

# Pull latest code
git pull origin main

# Deploy
docker compose -f docker-compose.prod.yml up -d --build

# Verify
./scripts/verify-deploy.sh https://daatan.com
```

---

## Rollback Procedures

### Quick Rollback (Recommended)

**Use when:** Current deployment is broken and you need to revert immediately

```bash
# Rollback staging to previous commit
ssh -i ~/.ssh/daatan-key.pem ubuntu@52.59.160.186 \
  "cd ~/app && ./scripts/rollback.sh staging"

# Rollback production to previous commit
ssh -i ~/.ssh/daatan-key.pem ubuntu@52.59.160.186 \
  "cd ~/app && ./scripts/rollback.sh production"
```

**What happens:**
1. Reverts to previous git commit
2. Rebuilds containers
3. Verifies deployment with health checks
4. Automatic abort if verification fails

**Time to rollback:** ~2-3 minutes

### Manual Rollback

**Use when:** You need more control or rollback script fails

```bash
ssh -i ~/.ssh/daatan-key.pem ubuntu@52.59.160.186

cd ~/app

# Check git history
git log --oneline -5

# Checkout previous commit
git checkout <commit-hash>

# Rebuild and restart
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d --build

# Verify
./scripts/verify-deploy.sh https://daatan.com
```

### Database Rollback

**Use when:** Database migrations failed

```bash
ssh -i ~/.ssh/daatan-key.pem ubuntu@52.59.160.186

cd ~/app

# Check Prisma migration status
docker exec daatan-app npx prisma migrate status

# Rollback last migration
docker exec daatan-app npx prisma migrate resolve --rolled-back <migration-name>

# Reapply migrations
docker exec daatan-app npx prisma migrate deploy
```

---

## Monitoring & Health Checks

### Health Check Endpoints

```bash
# Production health
curl https://daatan.com/api/health

# Staging health
curl https://staging.daatan.com/api/health

# Response format:
{
  "status": "ok",
  "version": "1.1.1",
  "timestamp": "2026-01-25T14:04:18.46..."
}
```

### Container Status

```bash
ssh -i ~/.ssh/daatan-key.pem ubuntu@52.59.160.186

# Check all containers
docker ps -a

# Check specific container logs
docker logs daatan-app --tail 100
docker logs daatan-app-staging --tail 100
docker logs daatan-nginx --tail 100
docker logs daatan-postgres --tail 100

# Follow logs in real-time
docker logs -f daatan-app
```

### Database Health

```bash
ssh -i ~/.ssh/daatan-key.pem ubuntu@52.59.160.186

# Check database connection
docker exec daatan-postgres pg_isready -U daatan -d daatan

# Check database size
docker exec daatan-postgres psql -U daatan -d daatan -c "SELECT pg_size_pretty(pg_database_size('daatan'));"

# List tables
docker exec daatan-postgres psql -U daatan -d daatan -c "\dt"
```

### Nginx Status

```bash
ssh -i ~/.ssh/daatan-key.pem ubuntu@52.59.160.186

# Check nginx config
docker exec daatan-nginx nginx -t

# Reload nginx (without restart)
docker exec daatan-nginx nginx -s reload

# Check nginx logs
docker logs daatan-nginx --tail 100
```

---

## Troubleshooting

### Service is Down

**Symptoms:** `curl https://daatan.com/api/health` returns error

**Steps:**
1. Check container status: `docker ps -a`
2. Check logs: `docker logs daatan-app --tail 50`
3. Check nginx: `docker logs daatan-nginx --tail 50`
4. Restart containers: `docker compose -f docker-compose.prod.yml restart`
5. If still down, use rollback: `./scripts/rollback.sh production`

### High CPU/Memory Usage

**Symptoms:** Server is slow or unresponsive

**Steps:**
1. Check resource usage: `docker stats`
2. Check for memory leaks: `docker logs daatan-app | grep -i "memory\|heap"`
3. Restart container: `docker compose -f docker-compose.prod.yml restart app`
4. Check for stuck processes: `docker top daatan-app`

### Database Connection Errors

**Symptoms:** Logs show "connection refused" or "ECONNREFUSED"

**Steps:**
1. Check postgres status: `docker ps | grep postgres`
2. Check postgres logs: `docker logs daatan-postgres --tail 50`
3. Verify connection: `docker exec daatan-postgres pg_isready -U daatan`
4. Restart postgres: `docker compose -f docker-compose.prod.yml restart postgres`
5. Check disk space: `df -h`

### Nginx Configuration Errors

**Symptoms:** Nginx won't start or returns 502 errors

**Steps:**
1. Check nginx config: `docker exec daatan-nginx nginx -t`
2. Check nginx logs: `docker logs daatan-nginx --tail 50`
3. Verify upstream containers are running: `docker ps | grep app`
4. Reload nginx: `docker exec daatan-nginx nginx -s reload`

### SSL Certificate Issues

**Symptoms:** HTTPS returns certificate errors

**Steps:**
1. Check certificate expiry: `docker exec daatan-certbot certbot certificates`
2. Check certificate files: `ls -la ~/app/certbot/conf/live/daatan.com/`
3. Manual renewal: `docker exec daatan-certbot certbot renew --force-renewal`
4. Restart nginx: `docker compose -f docker-compose.prod.yml restart nginx`

---

## Infrastructure

### Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Internet                         │
└────────────────────┬────────────────────────────────┘
                     │ HTTPS (443)
                     ▼
        ┌────────────────────────┐
        │   Nginx (Reverse Proxy)│
        │   - SSL Termination    │
        │   - Load Balancing     │
        └────────┬───────────────┘
                 │
        ┌────────┴────────┐
        ▼                 ▼
    ┌────────┐        ┌──────────┐
    │ App    │        │ App      │
    │ Prod   │        │ Staging  │
    │ :3000  │        │ :3000    │
    └────┬───┘        └──────┬───┘
         │                   │
         └───────┬───────────┘
                 ▼
         ┌──────────────────┐
         │  PostgreSQL 16   │
         │  daatan database │
         └──────────────────┘
```

### Services

| Service | Container | Port | Purpose |
|---------|-----------|------|---------|
| Nginx | daatan-nginx | 80, 443 | Reverse proxy, SSL termination |
| App (Prod) | daatan-app | 3000 | Production Next.js app |
| App (Staging) | daatan-app-staging | 3000 | Staging Next.js app |
| PostgreSQL | daatan-postgres | 5432 | Database |
| Certbot | daatan-certbot | - | SSL certificate renewal |

### Volumes

| Volume | Mount Point | Purpose |
|--------|-------------|---------|
| postgres_data | /var/lib/postgresql/data | Database persistence |
| ./certbot/conf | /etc/letsencrypt | SSL certificates |
| ./certbot/www | /var/www/certbot | ACME challenge files |

### Environment Variables

Required in `.env` on server (`~/app/.env`):

```bash
POSTGRES_PASSWORD=<secure-password>
NEXTAUTH_SECRET=<secure-secret>
NEXTAUTH_URL=https://daatan.com
GOOGLE_CLIENT_ID=<google-oauth-id>
GOOGLE_CLIENT_SECRET=<google-oauth-secret>
GEMINI_API_KEY=<gemini-api-key>
```

**Security Notes:**
- Secrets stored in `.env` file on server (acceptable for MVP)
- File permissions: `600` (owner read/write only)
- Never commit `.env` to git
- See [SECRETS.md](./SECRETS.md) for best practices and future improvements
- Plan to migrate to AWS Secrets Manager for production scale

---

## Useful Commands

### View Logs

```bash
# Production app logs
ssh -i ~/.ssh/daatan-key.pem ubuntu@52.59.160.186 \
  "docker logs daatan-app --tail 100 -f"

# Staging app logs
ssh -i ~/.ssh/daatan-key.pem ubuntu@52.59.160.186 \
  "docker logs daatan-app-staging --tail 100 -f"

# Nginx logs
ssh -i ~/.ssh/daatan-key.pem ubuntu@52.59.160.186 \
  "docker logs daatan-nginx --tail 100 -f"
```

### Database Operations

```bash
# Connect to database
ssh -i ~/.ssh/daatan-key.pem ubuntu@52.59.160.186 \
  "docker exec -it daatan-postgres psql -U daatan -d daatan"

# Run migrations
ssh -i ~/.ssh/daatan-key.pem ubuntu@52.59.160.186 \
  "docker exec daatan-app npx prisma migrate deploy"

# Backup database
ssh -i ~/.ssh/daatan-key.pem ubuntu@52.59.160.186 \
  "docker exec daatan-postgres pg_dump -U daatan daatan | gzip > ~/backups/daatan_$(date +%Y%m%d_%H%M%S).sql.gz"
```

### Container Management

```bash
# Restart all services
ssh -i ~/.ssh/daatan-key.pem ubuntu@52.59.160.186 \
  "cd ~/app && docker compose -f docker-compose.prod.yml restart"

# Stop all services
ssh -i ~/.ssh/daatan-key.pem ubuntu@52.59.160.186 \
  "cd ~/app && docker compose -f docker-compose.prod.yml down"

# Start all services
ssh -i ~/.ssh/daatan-key.pem ubuntu@52.59.160.186 \
  "cd ~/app && docker compose -f docker-compose.prod.yml up -d"

# Rebuild and restart
ssh -i ~/.ssh/daatan-key.pem ubuntu@52.59.160.186 \
  "cd ~/app && docker compose -f docker-compose.prod.yml up -d --build"
```

---

## Support

For issues or questions:
1. Check logs: `docker logs <container-name>`
2. Review this guide's troubleshooting section
3. Check GitHub Actions for deployment errors
4. Review INFRASTRUCTURE.md for detailed setup

Last updated: January 25, 2026
