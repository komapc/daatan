# DAATAN Technical Documentation

> Technical architecture, infrastructure, deployment, and operational guide.
> Last updated: January 2026

---

## Table of Contents

1. [Technology Stack](#technology-stack)
2. [Architecture Overview](#architecture-overview)
3. [Infrastructure](#infrastructure)
4. [CI/CD Pipeline](#cicd-pipeline)
5. [Deployment Strategies](#deployment-strategies)
6. [Database](#database)
7. [Authentication](#authentication)
8. [Security](#security)
9. [Monitoring & Operations](#monitoring--operations)
10. [Development Workflow](#development-workflow)

---

## Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Framework | Next.js (App Router) | 14.2.x |
| Language | TypeScript | 5.x |
| Runtime | Node.js | 20.x |
| Styling | Tailwind CSS | 3.4.x |
| Database | PostgreSQL | 16 |
| ORM | Prisma | 5.16.x |
| Authentication | NextAuth.js | 4.24.x |
| Testing | Vitest | 4.x |
| Containerization | Docker | Latest |
| Reverse Proxy | Nginx | Alpine |
| SSL | Let's Encrypt (Certbot) | Latest |
| Cloud | AWS (EC2, Route 53, S3) | - |
| IaC | Terraform | 1.x |
| CI/CD | GitHub Actions | - |
| AI Integration | Google Gemini API | - |

**LLM prompts** (forecast/prediction creation) are defined in `src/lib/llm/prompts/`: `expressPrediction.ts` (Express flow) and `extractPrediction.ts` (extract from text). See [STRUCTURE.md](./STRUCTURE.md) for the full `lib/llm` layout.

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Internet                                │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AWS Route 53 (DNS)                           │
│  daatan.com → 52.59.160.186                                     │
│  staging.daatan.com → 52.59.160.186                             │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AWS EC2 (t3.small)                           │
│                    eu-central-1 (Frankfurt)                     │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Docker Compose                         │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │              Nginx (daatan-nginx)                   │  │  │
│  │  │         Port 80 (→301) / 443 (SSL)                  │  │  │
│  │  └────────────────┬────────────────────────────────────┘  │  │
│  │                   │                                       │  │
│  │         ┌─────────┴─────────┐                             │  │
│  │         ▼                   ▼                             │  │
│  │  ┌─────────────┐     ┌─────────────────┐                  │  │
│  │  │ daatan-app  │     │ daatan-app-     │                  │  │
│  │  │ (Prod)      │     │ staging         │                  │  │
│  │  │ :3000       │     │ :3000           │                  │  │
│  │  └──────┬──────┘     └────────┬────────┘                  │  │
│  │         │                     │                           │  │
│  │         └──────────┬──────────┘                           │  │
│  │                    ▼                                      │  │
│  │         ┌──────────────────────┐                          │  │
│  │         │  daatan-postgres     │                          │  │
│  │         │  (PostgreSQL 16)     │                          │  │
│  │         │  :5432               │                          │  │
│  │         └──────────────────────┘                          │  │
│  │                                                           │  │
│  │         ┌──────────────────────┐                          │  │
│  │         │  daatan-certbot      │                          │  │
│  │         │  (SSL Renewal)       │                          │  │
│  │         └──────────────────────┘                          │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AWS S3 (Backups)                             │
│  daatan-db-backups-{account-id}                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Request Flow

1. User requests `https://daatan.com`
2. Route 53 resolves to EC2 Elastic IP (52.59.160.186)
3. Nginx terminates SSL and routes to appropriate container
4. Next.js app processes request
5. Prisma queries PostgreSQL if needed
6. Response flows back through the chain

---

## Infrastructure

### AWS Resources

| Resource | Type | Details |
|----------|------|---------|
| EC2 Instance | t3.small | Ubuntu 24.04, 2GB RAM |
| Elastic IP | Static | 52.59.160.186 |
| Route 53 | Hosted Zone | daatan.com |
| S3 Bucket | Backup Storage | 30-day retention |
| Security Group | Firewall | SSH (restricted), HTTP, HTTPS |
| IAM Role | EC2 Profile | S3 backup access |

### Terraform Resources

```hcl
# Key resources managed by Terraform
aws_instance.backend          # EC2 instance
aws_eip.backend               # Elastic IP
aws_route53_zone.main         # DNS zone
aws_route53_record.*          # DNS records
aws_s3_bucket.backups         # Backup bucket
aws_security_group.ec2        # Firewall rules
aws_iam_role.ec2_role         # IAM role
aws_vpc.main                  # VPC
aws_subnet.public_a           # Public subnet
```

### Security Group Rules

| Port | Protocol | Source | Purpose |
|------|----------|--------|---------|
| 22 | TCP | Restricted CIDR | SSH access |
| 80 | TCP | 0.0.0.0/0 | HTTP (redirects to HTTPS) |
| 443 | TCP | 0.0.0.0/0 | HTTPS |
| ICMP | - | 0.0.0.0/0 | Ping (debugging) |

### Estimated Monthly Costs

| Service | Cost |
|---------|------|
| EC2 t3.small | ~$17 |
| Route 53 | ~$0.50 |
| S3 (backups) | ~$0.10 |
| **Total** | **~$18/month** |

---

## CI/CD Pipeline

### GitHub Actions Workflows

#### 1. Deploy Workflow (`deploy.yml`)

**Triggers:**
- Push to `main` → Deploy to Staging
- Push tag `v*` → Deploy to Production
- Manual dispatch → Either environment

**Pipeline Stages:**
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Build &   │────▶│   Deploy    │────▶│   Verify    │
│    Test     │     │   (SSH)     │     │   (Health)  │
└─────────────┘     └─────────────┘     └─────────────┘
```

**Build Stage:**
- Checkout code
- Setup Node.js 20
- Install dependencies (`npm ci`)
- Build application
- Run unit tests
- Run linter

**Deploy Stage (Staging):**
- SSH to EC2
- Clean Docker environment
- Pull latest code
- Build Docker image (no cache)
- Start containers
- Verify health check
- Verify authentication

**Deploy Stage (Production):**
- Same as staging but:
  - Checks out specific tag
  - Deploys to production container
  - More conservative cleanup

#### 2. Version Bump Workflow (`version-bump.yml`)

**Trigger:** PR merged to `main`

**Logic:**
- `BREAKING:` or `major:` prefix → Major bump (X.0.0)
- `feat:` or `feature:` prefix → Minor bump (0.X.0)
- Other → Patch bump (0.0.X)

**Actions:**
1. Update `src/lib/version.ts`
2. Commit with `[skip ci]`
3. Create and push git tag

### Required Secrets

| Secret | Purpose |
|--------|---------|
| `EC2_HOST` | EC2 public IP |
| `EC2_SSH_KEY` | SSH private key |
| `POSTGRES_PASSWORD` | Database password |
| `NEXTAUTH_SECRET` | Auth encryption key |
| `GOOGLE_CLIENT_ID` | OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret |
| `GEMINI_API_KEY` | AI API key |

---

## Deployment Strategies

### 1. Standard Deployment (Automatic)

**Best for:** Regular feature deployments

```bash
# Staging (automatic on push)
git push origin main

# Production (automatic on tag)
git tag v0.1.17
git push origin v0.1.17
```

**Characteristics:**
- ~5-10 minute deployment time
- ~30 second downtime during container restart
- Automatic health verification

### 2. Blue-Green Deployment (Zero Downtime)

**Best for:** Critical updates requiring zero downtime

```bash
ssh -i ~/.ssh/daatan-key.pem ubuntu@52.59.160.186 \
  "cd ~/app && ./scripts/blue-green-deploy.sh production"
```

**How it works:**
1. Build new version in inactive container
2. Health check new container
3. Switch nginx traffic
4. Remove old container
5. Automatic rollback on failure

**Characteristics:**
- ~3-5 minute deployment time
- Zero downtime
- Instant rollback capability

### 3. Manual Deployment (Direct SSH)

**Best for:** Emergency fixes, CI/CD unavailable

```bash
ssh -i ~/.ssh/daatan-key.pem ubuntu@52.59.160.186
cd ~/app
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build
./scripts/verify-deploy.sh https://daatan.com
```

### 4. Rollback

**When:** Current deployment is broken

```bash
ssh -i ~/.ssh/daatan-key.pem ubuntu@52.59.160.186 \
  "cd ~/app && ./scripts/rollback.sh production"
```

**Time to rollback:** ~2-3 minutes

---

## Database

### Schema Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         User                                    │
│  - id, email, name, image                                       │
│  - rs (Reputation Score), cuAvailable, cuLocked                 │
│  - isAdmin, isModerator                                         │
└─────────────────────────────────────────────────────────────────┘
         │                    │                    │
         │ creates            │ commits            │ resolves
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   Prediction    │  │   Commitment    │  │  CuTransaction  │
│  - claimText    │  │  - cuCommitted  │  │  - type, amount │
│  - outcomeType  │  │  - rsSnapshot   │  │  - balanceAfter │
│  - status       │  │  - binaryChoice │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘
         │
         │ linked to
         ▼
┌─────────────────┐
│   NewsAnchor    │
│  - url, title   │
│  - source       │
│  - publishedAt  │
└─────────────────┘
```

### Key Models

| Model | Purpose | Key Fields |
|-------|---------|------------|
| User | User accounts | rs, cuAvailable, cuLocked |
| Prediction | Forecast statements | claimText, outcomeType, status |
| Commitment | CU stakes | cuCommitted, rsSnapshot |
| NewsAnchor | News context | url, title, source |
| CuTransaction | CU ledger | type, amount, balanceAfter |

### Database Operations

```bash
# Connect to database
docker exec -it daatan-postgres psql -U daatan -d daatan

# Run migrations
docker exec daatan-app npx prisma migrate deploy

# Check migration status
docker exec daatan-app npx prisma migrate status

# Backup database
docker exec daatan-postgres pg_dump -U daatan daatan | gzip > backup.sql.gz
```

### Automated Backups

- **Schedule:** Daily at 3 AM UTC
- **Retention:** 30 days in S3, 3 local copies
- **Location:** `s3://daatan-db-backups-{account-id}/daily/`

---

## Authentication

### NextAuth.js Configuration

```typescript
// src/lib/auth.ts
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: { strategy: "jwt" },
  // ...
};
```

### Auth Page Architecture

Auth pages use a Server/Client component split pattern for proper Next.js 14 compatibility:

```
src/app/auth/
├── signin/
│   ├── page.tsx           # Server Component (export const dynamic)
│   └── SignInClient.tsx   # Client Component (useSearchParams, hooks)
└── error/
    ├── page.tsx           # Server Component (export const dynamic)
    └── AuthErrorClient.tsx # Client Component (useSearchParams)
```

**Why this pattern?**
- `export const dynamic = 'force-dynamic'` only works in Server Components
- `useSearchParams()` requires `'use client'` directive
- Combining both in one file causes the dynamic export to be ignored
- Docker builds may skip pages that aren't properly marked as dynamic

### OAuth Flow

1. User clicks "Sign in with Google"
2. Redirect to Google OAuth consent
3. Google redirects back with auth code
4. NextAuth exchanges code for tokens
5. User created/updated in database
6. JWT session token issued

### Session Management

- **Strategy:** JWT (stateless)
- **Token Location:** HTTP-only cookie
- **Expiration:** Configurable (default: 30 days)

---

## Security

### SSL/TLS

- **Provider:** Let's Encrypt
- **Certificate:** Wildcard for daatan.com
- **Renewal:** Automatic via Certbot (every 12 hours check)
- **Expiry:** April 17, 2026

### Security Headers (Nginx)

```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

### Network Security

- SSH restricted to specific CIDR
- Database not exposed publicly (internal Docker network)
- All traffic forced to HTTPS
- API routes have cache disabled

### Secrets Management

- Environment variables for sensitive data
- GitHub Secrets for CI/CD
- `.env` file gitignored
- No secrets in Docker images

---

## Monitoring & Operations

### Health Check Endpoints

```bash
# Production
curl https://daatan.com/api/health
# Response: {"status":"ok","version":"0.1.19","commit":"abc1234","timestamp":"..."}

# Staging
curl https://staging.daatan.com/api/health
```

### Container Monitoring

```bash
# Container status
docker ps -a

# Resource usage
docker stats

# Container logs
docker logs daatan-app --tail 100 -f
docker logs daatan-nginx --tail 100 -f
docker logs daatan-postgres --tail 100 -f
```

### Database Health

```bash
# Connection check
docker exec daatan-postgres pg_isready -U daatan -d daatan

# Database size
docker exec daatan-postgres psql -U daatan -d daatan \
  -c "SELECT pg_size_pretty(pg_database_size('daatan'));"
```

### Log Rotation

- **Driver:** json-file
- **Max Size:** 10MB per file
- **Max Files:** 3 per container

---

## Development Workflow

### Local Setup

```bash
# Clone repository
git clone https://github.com/komapc/daatan.git
cd daatan

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your values

# Start development server
npm run dev
```

### Git Hooks (Husky)

**Pre-Commit:**
- Build verification
- Run all tests
- Lint check (warning only)

**Pre-Push:**
- Detect auth-related changes
- Prompt for manual auth testing

### Testing

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test
npm test -- path/to/test.ts
```

### Code Quality

```bash
# Lint
npm run lint

# Type check
npx tsc --noEmit

# Format (if configured)
npm run format
```

### Local Verification

```bash
# Comprehensive check before pushing
./scripts/verify-local.sh
```

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Health check fails | Check logs: `docker logs daatan-app --tail 50` |
| 502 Bad Gateway | Verify app container running: `docker ps` |
| Database connection error | Check postgres: `docker exec daatan-postgres pg_isready` |
| SSL certificate error | Renew: `docker exec daatan-certbot certbot renew` |
| High memory usage | Restart container: `docker compose restart app` |

### Debug Commands

```bash
# Check all container status
docker ps -a --filter name=daatan-

# Check nginx config
docker exec daatan-nginx nginx -t

# Check environment variables in container
docker exec daatan-app env | grep -E "NEXT|DATABASE|GOOGLE"

# Check disk space
df -h

# Check memory
free -m
```

---

## Related Documentation

- [DEPLOYMENT.md](./DEPLOYMENT.md) — Detailed deployment procedures
- [INFRASTRUCTURE.md](./INFRASTRUCTURE.md) — AWS infrastructure details
- [STRUCTURE.md](./STRUCTURE.md) — Project structure
- [PRODUCT.md](./PRODUCT.md) — Product documentation
- [TODO.md](./TODO.md) — Technical debt and roadmap
