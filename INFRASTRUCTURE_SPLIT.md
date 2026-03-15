# Infrastructure Split: Production & Staging Separation

## Overview
As of March 15, 2026, the Daatan infrastructure has been split into two independent EC2 instances, with production and staging workloads now running on separate, isolated hardware.

## Architecture Before Split
- **Single Instance (t3.small):**
  - Production application (`daatan-app`)
  - Staging application (`daatan-app-staging`)
  - Production database (`daatan-postgres`)
  - Staging database (`daatan-postgres-staging`)
  - Nginx reverse proxy (all domains)
  - Resource thrashing: container memory limits and CPU contention

## Architecture After Split

### Production Environment
- **Instance:** `i-0286f62b47117b85c` (t3.small: 2GB RAM)
- **IP Address:** `63.182.198.80` (Elastic IP)
- **Domains:**
  - `daatan.com` (primary)
  - `www.daatan.com` (CNAME to daatan.com)
  - `api.daatan.com` (root domain redirect)
  - `mission.daatan.com` (OpenClaw chat interface)
- **Services:**
  - `daatan-app` - Production Next.js application (port 3000)
  - `daatan-postgres` - Production PostgreSQL database
  - `daatan-nginx` - Nginx reverse proxy (HTTPS)
- **Database:** `daatan` (PostgreSQL, production data)
- **Backups:** `daatan-db-backups-{account-id}` (S3 bucket)

### Staging Environment
- **Instance:** `i-04ea44d4243d35624` (t3.small: 2GB RAM)
- **IP Address:** `3.126.238.216` (Elastic IP)
- **Domains:**
  - `staging.daatan.com`
- **Services:**
  - `daatan-app-staging` - Staging Next.js application (port 3000)
  - `daatan-postgres-staging` - Staging PostgreSQL database
  - `daatan-nginx` - Nginx reverse proxy (HTTPS)
  - `daatan-certbot` - Let's Encrypt certificate management
- **Database:** `daatan_staging` (PostgreSQL, staging data)
- **Backups:** `daatan-db-backups-staging-{account-id}` (S3 bucket)

## Network Configuration
- **VPC:** Single VPC shared between both instances
- **Subnets:** Both instances in public subnet `public_a`
- **Security Groups:** Shared `daatan-ec2-sg` allows:
  - Port 80 (HTTP) from 0.0.0.0/0
  - Port 443 (HTTPS) from 0.0.0.0/0
  - Port 22 (SSH) via AWS SSM only
  - ICMP for diagnostics

## DNS Configuration (Route 53)
```
daatan.com          (A) → 63.182.198.80   (production)
www.daatan.com      (CNAME) → daatan.com
api.daatan.com      (A) → 63.182.198.80   (production)
mission.daatan.com  (A) → 63.182.198.80   (production)
staging.daatan.com  (A) → 3.126.238.216   (staging)
```

## SSL/TLS Certificates
- **Production:** Self-signed certificates (daatan.com)
  - Location: `/home/ubuntu/app/certbot/conf/live/daatan.com/`
  - Files: `fullchain.pem`, `privkey.pem`
  - Status: Temporary self-signed (should upgrade to Let's Encrypt)

- **Staging:** Self-signed certificates (staging.daatan.com)
  - Location: `/home/ubuntu/app/certbot/conf/live/staging.daatan.com/`
  - Files: `fullchain.pem`, `privkey.pem`
  - Status: Temporary self-signed (should upgrade to Let's Encrypt)

## Benefits
1. **Resource Isolation:** Each instance has dedicated 2GB RAM and CPU
2. **Independent Deployment:** Staging updates don't affect production
3. **Reduced Resource Thrashing:** No memory/CPU contention between prod and staging
4. **Separate Databases:** Production and staging data is completely isolated
5. **Backup Independence:** Each environment has its own backup bucket with separate retention policies

## Deployment Process
- Production changes: Deployed to `daatan.com` via CI/CD → production instance
- Staging changes: Deployed to `staging.daatan.com` via CI/CD → staging instance
- Both use GitHub Actions workflow (`.github/workflows/deploy.yml`)
- Both run migrations independently via docker-compose

## Backup Strategy
- **Production:** Daily backups at 03:00 UTC, 30-day retention
- **Staging:** Daily backups at 03:00 UTC, 14-day retention
- Both stored in separate S3 buckets with versioning enabled
- Manual backups created during infrastructure changes

## Monitoring & Health Checks
- Production health endpoint: `/api/health` on port 3000
- Staging health endpoint: `/api/health` on port 3000
- Nginx health check: `GET /health` on port 80/443
- Database health: PostgreSQL pg_isready check

## Access Methods
All SSH access is via AWS SSM (no direct SSH keys):
```bash
# Production instance
aws ssm start-session --target i-0286f62b47117b85c

# Staging instance
aws ssm start-session --target i-04ea44d4243d35624
```

## Terraform Configuration
The infrastructure is defined in `terraform/`:
- `ec2.tf` - EC2 instances (`production` and `staging` resources)
- `route53.tf` - DNS records with separate production/staging domains
- `s3.tf` - Backup buckets (separate prod/staging with different retention)
- `outputs.tf` - Outputs for each instance (IPs, instance IDs, SSH commands)

## Post-Split Tasks
- [ ] **Staging HTTPS:** Set up proper Let's Encrypt certificates for staging.daatan.com
- [ ] **Production HTTPS:** Set up proper Let's Encrypt certificates for daatan.com
- [ ] **Health Monitoring:** Implement 5-minute watchdog for both instances
- [ ] **Backup Automation:** Configure cron-based twice-daily backups (backup/restore redundancy)
- [ ] **CI/CD Updates:** Ensure deploy.yml targets correct instance based on environment

## Rollback Plan
If needed, both instances can be re-combined to a single t3.large instance by:
1. Creating a new single instance with `docker-compose.prod.yml`
2. Restoring both databases from S3 backups
3. Updating DNS records to point all domains to the single instance
4. Terminating the split instances

## Historical Data Backups
Database backups created during the split process:
- Production: `daatan_prod_20260314_210809.sql.gz` (50 KB)
- Staging: `daatan_staging_backup_final.sql.gz` (157 KB)
Both stored in S3 with manual upload prefix for easy recovery.

---
**Last Updated:** March 15, 2026 00:58 UTC
**Terraform Module:** ec2.tf, route53.tf, s3.tf
**Infrastructure Status:** ✅ Complete and operational
