# DAATAN Infrastructure

## 1. High-Level Architecture

The infrastructure is designed to be **immutable and automated**. We use Terraform to provision resources and GitHub Actions to deploy Docker containers.

| Layer | Service | Details |
| ----- | ------- | ------- |
| DNS | Namecheap → AWS Route 53 | Registrar delegates to Route 53 |
| Frontend | AWS Amplify | Auto-scaling, managed SSL, CI/CD integrated |
| Backend | EC2 `t3.micro` | Dockerized Node.js in `il-central-1` |
| Database | RDS PostgreSQL `db.t3.micro` | Managed persistence |

---

## 2. Infrastructure Components

### A. Network & DNS

| Component | Provider/Service | Purpose |
| --------- | ---------------- | ------- |
| Domain Registrar | Namecheap | Owns `daatan.com` |
| DNS Management | Route 53 | Handles A records and CNAME |
| VPC | AWS VPC | Private network in Tel Aviv (`il-central-1`) |

### B. Compute (The Docker Engine)

- **Instance:** Amazon EC2 `t3.micro` (Ubuntu 24.04)
- **Runtime:** Docker + Docker Compose

**Security Group:**

| Port | Access | Purpose |
| ---- | ------ | ------- |
| 22 | Restricted to your IP | SSH |
| 80/443 | Public | Web traffic |
| 3000 | Internal | Backend Node.js API (Docker mapped) |

### C. Storage & Database

- **Database:** Amazon RDS PostgreSQL
- **Storage:** 20GB GP3 SSD
- **Backup:** 7 days automated backups (Free Tier)

---

## 3. CI/CD Pipeline (The "Manual" Stack)

Since you're migrating to a manual setup with Cursor/IDE, the workflow is:

1. **Code Change** — Edit Node.js code in Cursor, push to GitHub

2. **Build Phase** (GitHub Actions)
   - Builds the Docker image
   - Pushes to GitHub Container Registry (GHCR) or DockerHub

3. **Deploy Phase** (GitHub Actions)
   - Logs into EC2 via SSH
   - Runs `docker compose pull && docker compose up -d`

---

## 4. Namecheap → AWS Bridge

To use `daatan.com` with this setup:

1. **Route 53** — Create a "Hosted Zone" for `daatan.com`
2. **Name Servers** — Copy the 4 NS records from AWS into Namecheap's "Custom DNS" section
3. **Propagation** — Wait ~1-2 hours for DNS to propagate globally

---

## 5. Terraform Prerequisites

Before running the Terraform files, ensure you have:

- [ ] **AWS CLI** installed and configured with an IAM user that has `AdministratorAccess`
- [ ] **Terraform CLI** installed locally
- [ ] **SSH Key Pair** created in AWS Console (named `daatan-key`) for EC2 access
