# DAATAN Infrastructure

## 1. High-Level Architecture

The infrastructure is designed to be **immutable and automated**. We use Terraform to provision resources and Docker Compose for container orchestration.

| Layer | Service | Details |
| ----- | ------- | ------- |
| DNS | Namecheap → AWS Route 53 | Registrar delegates to Route 53 |
| Compute | EC2 `t3.small` | Dockerized Next.js + Nginx in `eu-central-1` (Frankfurt) |
| Database | PostgreSQL 16 | Docker container with persistent volume |
| SSL | Let's Encrypt | Auto-renewed via Certbot |

---

## 2. Live Deployment

**Production URL:** https://daatan.com

| Component | Value |
| --------- | ----- |
| EC2 Instance | `i-0e3ab3926d831bf0a` |
| Instance Type | `t3.small` (2GB RAM) |
| Public IP | `52.59.160.186` |
| Region | `eu-central-1` (Frankfurt) |
| SSL Certificate | Valid until April 17, 2026 |

---

## 3. Infrastructure Components

### A. Network & DNS

| Component | Provider/Service | Purpose |
| --------- | ---------------- | ------- |
| Domain Registrar | Namecheap | Owns `daatan.com` |
| DNS Management | Route 53 | Hosted zone `Z0878807J7QMMQ2P8AA2` |
| Nameservers | AWS | `ns-314.awsdns-39.com`, `ns-1000.awsdns-61.net`, `ns-1227.awsdns-25.org`, `ns-1988.awsdns-56.co.uk` |

### B. Compute (Docker Stack)

- **Instance:** Amazon EC2 `t3.small` (Ubuntu 24.04)
- **Runtime:** Docker + Docker Compose

**Docker Containers:**

| Container | Image | Port | Purpose |
| --------- | ----- | ---- | ------- |
| `daatan-nginx` | `nginx:alpine` | 80, 443 | Reverse proxy + SSL termination |
| `daatan-app` | `daatan-app:latest` | 3000 (internal) | Next.js application |
| `daatan-postgres` | `postgres:16-alpine` | 5432 (internal) | PostgreSQL database |
| `daatan-certbot` | `certbot/certbot` | - | SSL certificate renewal |

**Security Group:**

| Port | Access | Purpose |
| ---- | ------ | ------- |
| 22 | Restricted to `46.210.0.0/16` | SSH |
| 80 | Public | HTTP (redirects to HTTPS) |
| 443 | Public | HTTPS |

### C. Storage & Database

- **Database:** PostgreSQL 16 (Docker container)
- **Storage:** Docker volume `postgres_data`
- **Backup:** S3 bucket `daatan-db-backups-272007598366`

---

## 4. Deployment Process

### Quick Deploy (from local machine)

```bash
# 1. Sync files to EC2
rsync -avz --exclude 'node_modules' --exclude '.next' --exclude '.git' \
  -e "ssh -i ~/.ssh/daatan-key.pem" . ubuntu@52.59.160.186:~/app/

# 2. Build and restart
ssh -i ~/.ssh/daatan-key.pem ubuntu@52.59.160.186 \
  "cd ~/app && docker compose -f docker-compose.prod.yml up -d --build"
```

### Full Deploy Script

```bash
ssh -i ~/.ssh/daatan-key.pem ubuntu@52.59.160.186
cd ~/app
chmod +x deploy.sh
./deploy.sh
```

---

## 5. SSL Certificate Management

Certificates are automatically renewed by Certbot. To manually renew:

```bash
ssh -i ~/.ssh/daatan-key.pem ubuntu@52.59.160.186
docker run --rm \
  -v ~/app/certbot/www:/var/www/certbot \
  -v ~/app/certbot/conf:/etc/letsencrypt \
  certbot/certbot renew
docker compose -f ~/app/docker-compose.prod.yml restart nginx
```

---

## 6. Configuration Files

| File | Purpose |
| ---- | ------- |
| `docker-compose.prod.yml` | Production Docker stack |
| `nginx-ssl.conf` | Nginx config with HTTPS |
| `nginx-init.conf` | HTTP-only config for initial SSL setup |
| `deploy.sh` | Automated deployment script |
| `.env` | Environment variables (POSTGRES_PASSWORD) |

---

## 7. Terraform

Terraform manages the AWS infrastructure:

```bash
cd terraform
terraform init
terraform plan
terraform apply
```

**Key files:**
- `main.tf` - Provider configuration
- `ec2.tf` - EC2 instance
- `route53.tf` - DNS records
- `security_groups.tf` - Firewall rules
- `s3.tf` - Backup bucket

**Note:** Instance type changes are ignored in lifecycle to prevent accidental recreation.

---

## 8. Monitoring

### Health Check

```bash
curl https://daatan.com/api/health
# Returns: {"status":"ok","timestamp":"..."}
```

### Container Status

```bash
ssh -i ~/.ssh/daatan-key.pem ubuntu@52.59.160.186 "docker ps"
```

### Logs

```bash
ssh -i ~/.ssh/daatan-key.pem ubuntu@52.59.160.186 "docker logs daatan-app --tail 100"
ssh -i ~/.ssh/daatan-key.pem ubuntu@52.59.160.186 "docker logs daatan-nginx --tail 100"
```

---

## 9. Costs (Estimated Monthly)

| Service | Cost |
| ------- | ---- |
| EC2 t3.small | ~$17 |
| Route 53 | ~$0.50 |
| S3 (backups) | ~$0.10 |
| **Total** | **~$18/month** |
