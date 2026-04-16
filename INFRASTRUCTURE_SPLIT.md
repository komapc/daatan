# Infrastructure Split: Production & Staging Separation

## Overview
As of March 2026, the Daatan infrastructure runs on two independent EC2 instances,
with production and staging workloads on separate, isolated hardware.

## Architecture

### Production Environment
- **Instance:** `i-04ea44d4243d35624` (t3.small: 2GB RAM)
- **IP Address:** `3.126.238.216` (Elastic IP)
- **Tag:** `Environment=prod`, `Name=daatan-backend`
- **IAM Role:** `daatan-ec2-role-prod`
- **Domains:**
  - `daatan.com` (primary)
  - `www.daatan.com` (CNAME to daatan.com)
  - `api.daatan.com` (production)
- **Services:**
  - `daatan-app` — Production Next.js application
  - `daatan-postgres` — Production PostgreSQL database
  - `daatan-nginx` — Nginx reverse proxy (HTTPS)
  - `daatan-certbot` — Let's Encrypt certificate renewal
- **Database:** `daatan` (PostgreSQL)
- **Backups:** `daatan-db-backups-272007598366` (S3 bucket)

### Staging Environment
- **Instance:** `i-0406d237ca5d92cdf` (t3.small: 2GB RAM)
- **IP Address:** `63.180.208.34` (Elastic IP)
- **Tag:** `Environment=staging`, `Name=daatan-backend`
- **IAM Role:** `daatan-ec2-role-staging`
- **Domains:**
  - `staging.daatan.com`
- **Services:**
  - `daatan-app-staging` — Staging Next.js application
  - `daatan-postgres-staging` — Staging PostgreSQL database
  - `daatan-nginx` — Nginx reverse proxy (HTTPS)
  - `daatan-certbot` — Let's Encrypt certificate renewal
- **Database:** `daatan_staging` (PostgreSQL)
- **Backups:** `daatan-db-backups-staging-272007598366` (S3 bucket)

## Network Configuration
- **VPC:** Single VPC shared between both instances
- **Subnets:** Both instances in public subnet `public_a`
- **Security Groups:** `daatan-ec2-sg` allows:
  - Port 80 (HTTP) from 0.0.0.0/0
  - Port 443 (HTTPS) from 0.0.0.0/0
  - Port 22 closed — all access via AWS SSM only

## DNS Configuration (Route 53)
```
daatan.com          (A)     → 3.126.238.216   (production)
www.daatan.com      (CNAME) → daatan.com
api.daatan.com      (A)     → 3.126.238.216   (production)
staging.daatan.com  (A)     → 63.180.208.34   (staging)
```

## SSL/TLS Certificates
- **Production:** Let's Encrypt via `certbot/dns-route53` Docker image
  - Covers: `daatan.com`, `www.daatan.com`
  - Location: `/home/ubuntu/app/certbot/conf/live/daatan.com/`
  - Renewal: automated via certbot container

- **Staging:** Let's Encrypt via `certbot/dns-route53` Docker image
  - Covers: `staging.daatan.com`
  - Location: `/home/ubuntu/app/certbot/conf/live/staging.daatan.com/`
  - Renewal: automated via certbot container

## Access Methods
All access is via **AWS SSM only** — port 22 is closed on both instances.

```bash
# Production instance
aws ssm start-session --target i-04ea44d4243d35624

# Staging instance
aws ssm start-session --target i-0406d237ca5d92cdf
```

Or use the `/ssm` slash command in Claude Code.

## Deployment Process
- Production changes: Git tag `v*` → CI/CD → `i-04ea44d4243d35624` (filter: `Environment=prod`)
- Staging changes: Push to `main` → CI/CD → `i-0406d237ca5d92cdf` (filter: `Environment=staging`)
- Both use GitHub Actions workflow (`.github/workflows/deploy.yml`)
- Both use blue-green deployment via `scripts/blue-green-deploy.sh`

## Backup Strategy
- **Production:** Daily backups at 03:00 and 15:00 UTC, 30-day retention
- **Staging:** Daily backups at 03:00 and 15:00 UTC, 14-day retention
- Both stored in separate S3 buckets with versioning enabled

## Monitoring & Health Checks
- Production health endpoint: `https://daatan.com/api/health`
- Staging health endpoint: `https://staging.daatan.com/api/health`

## Terraform Configuration
The infrastructure is defined in `terraform/`:
- `ec2.tf` — EC2 instances (`production` and `staging` resources)
- `route53.tf` — DNS records with separate production/staging domains
- `s3.tf` — Backup buckets (separate prod/staging with different retention)
- `outputs.tf` — Outputs for each instance (IPs, instance IDs)

## Rollback Plan
If needed, production can be temporarily redirected to the staging instance by
flipping the Route 53 A record. Full rollback: restore postgres from S3 backup,
update Route 53 record to point `daatan.com` back to the alternate instance.

## Historical Data Backups
Database backups created during the split process (March 2026):
- Production: `daatan_prod_20260314_210809.sql.gz` (50 KB)
- Staging: `daatan_staging_backup_final.sql.gz` (157 KB)
Both stored in S3 with manual upload prefix for easy recovery.

---
**Last Updated:** April 16, 2026
**Terraform Module:** ec2.tf, route53.tf, s3.tf
**Infrastructure Status:** ✅ Operational
