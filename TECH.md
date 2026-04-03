# DAATAN Technical Documentation

> Technical architecture, infrastructure, project structure, and development guide.
> Last updated: March 2026

---

## Table of Contents

1. [Technology Stack](#technology-stack)
2. [Architecture Overview](#architecture-overview)
3. [Project Structure](#project-structure)
4. [Infrastructure](#infrastructure)
5. [CI/CD Pipeline](#cicd-pipeline)
6. [Database](#database)
7. [Authentication](#authentication)
8. [Security](#security)
9. [Monitoring & Operations](#monitoring--operations)
10. [Development Workflow](#development-workflow)

---

## Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Framework | Next.js (App Router) | 15.5.x |
| Language | TypeScript | 5.x |
| Runtime | Node.js | 20.x |
| Styling | Tailwind CSS | 3.4.x |
| Database | PostgreSQL | 16 |
| ORM | Prisma | 5.22.x |
| Authentication | NextAuth.js | 4.24.x |
| Testing | Vitest | 4.x |
| Containerization | Docker | Latest |
| Reverse Proxy | Nginx | Alpine |
| SSL | Let's Encrypt (Certbot) | Latest |
| Cloud | AWS (EC2, Route 53, S3) | - |
| IaC | Terraform | 1.x |
| CI/CD | GitHub Actions | - |
| AI Integration | Google Gemini API (primary), Ollama (fallback), OpenRouter (bots) | - |
| Prompt Management | AWS Bedrock Prompt Management | - |
| Email | Resend | - |
| Push Notifications | web-push (VAPID) | - |
| Notifications | Telegram | - |
| i18n | next-intl | 4.x |
| Image Processing | Sharp | - |

**LLM prompts** (forecast/prediction creation) are managed via AWS Bedrock Prompt Management. See [docs/LLM_ARCHITECTURE.md](./docs/LLM_ARCHITECTURE.md).

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
│  daatan.com → EC2 Elastic IP                                    │
│  staging.daatan.com → EC2 Elastic IP                            │
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
│  │  ┌────────────────────┐  ┌──────────────────────────┐    │  │
│  │  │  daatan-postgres   │  │  daatan-postgres-staging │    │  │
│  │  │  DB: daatan        │  │  DB: daatan_staging      │    │  │
│  │  │  :5432 (internal)  │  │  :5432 (internal)        │    │  │
│  │  └────────────────────┘  └──────────────────────────┘    │  │
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
2. Route 53 resolves to EC2 Elastic IP
3. Nginx terminates SSL and routes to appropriate container
4. Next.js app processes request
5. Prisma queries PostgreSQL if needed
6. Response flows back through the chain

### Docker Containers

| Container | Image | Port | Purpose |
|-----------|-------|------|---------|
| `daatan-nginx` | `nginx:alpine` | 80, 443 | Reverse proxy, SSL termination |
| `daatan-app` | `daatan-app:latest` | 3000 (internal) | Production Next.js app |
| `daatan-app-staging` | `daatan-app:staging-*` | 3000 (internal) | Staging Next.js app |
| `daatan-postgres` | `postgres:16-alpine` | 5432 (internal) | Production PostgreSQL (DB: `daatan`) |
| `daatan-postgres-staging` | `postgres:16-alpine` | 5432 (internal) | Staging PostgreSQL (DB: `daatan_staging`) |
| `daatan-certbot` | `certbot/certbot` | - | SSL certificate renewal |

### Volumes

| Volume | Mount Point | Purpose |
|--------|-------------|---------|
| `app_postgres_data` | /var/lib/postgresql/data | Production DB persistence (named volume, Docker-prefixed) |
| `app_postgres_staging_data` | /var/lib/postgresql/data | Staging DB persistence |
| `./certbot/conf` | /etc/letsencrypt | SSL certificates |
| `./certbot/www` | /var/www/certbot | ACME challenge files |

> **Note:** Docker prefixes named volumes with the compose project name (`app_`) because compose runs from `/home/ubuntu/app/`. Data survives container restarts but NOT `docker compose down -v`.

---

## Project Structure

### Directory Overview

```
daatan/
├── .github/                    # GitHub configuration
│   └── workflows/              # CI/CD pipelines
│       └── deploy.yml          # Main deployment workflow
├── .husky/                     # Git hooks
│   ├── pre-commit              # Build + test verification
│   └── pre-push                # Auth change detection
├── certbot/                    # SSL certificate storage
│   ├── conf/                   # Let's Encrypt certificates
│   └── www/                    # ACME challenge files
├── prisma/                     # Database schema
│   └── schema.prisma           # Prisma ORM schema
├── public/                     # Static assets
├── scripts/                    # Operational scripts
├── src/                        # Application source code
├── terraform/                  # Infrastructure as Code
└── __tests__/                  # Test files
```

### Source Code (`src/`)

```
src/
├── app/                        # Next.js App Router
│   ├── api/                    # API routes
│   │   ├── admin/              # Admin-only endpoints (role: ADMIN)
│   │   │   └── bots/           # Bot CRUD + run trigger
│   │   │       └── [id]/       # Per-bot: PATCH, DELETE, run, logs
│   │   ├── auth/               # NextAuth.js endpoints
│   │   ├── bots/               # Public bot runner endpoint (cron)
│   │   │   └── run/            # POST — triggered by GitHub Actions
│   │   ├── comments/           # Comment CRUD + reactions
│   │   ├── commitments/        # User commitment listing
│   │   ├── forecasts/          # Forecast CRUD (new system)
│   │   ├── health/             # Health check endpoint
│   │   ├── legacy-forecasts/   # Legacy forecast system (deprecated)
│   │   ├── news-anchors/       # News anchor management
│   │   ├── notifications/      # Notification endpoints
│   │   ├── profile/            # User profile update
│   │   │   └── avatar/         # Avatar upload → S3
│   │   ├── push/               # Browser push subscription management
│   │   ├── ai/                 # AI-powered endpoints
│   │   ├── cron/               # Cron job endpoints (cleanup, etc.)
│   │   ├── tags/               # Tag management
│   │   ├── leaderboard/        # Leaderboard endpoint
│   │   ├── top-reputation/     # Top reputation endpoint (legacy)
│   │   └── version/            # Version endpoint
│   ├── admin/                  # Admin UI pages (role: ADMIN)
│   │   └── bots/               # Bot management dashboard (BotsTable.tsx)
│   ├── auth/                   # Auth pages
│   │   ├── signin/             # Sign in page
│   │   │   ├── page.tsx        # Server Component wrapper
│   │   │   └── SignInClient.tsx # Client Component with UI
│   │   └── error/              # Auth error page
│   │       ├── page.tsx        # Server Component wrapper
│   │       └── AuthErrorClient.tsx # Client Component with UI
│   ├── create/                 # Forecast creation
│   ├── leaderboard/            # User rankings
│   ├── notifications/          # User notifications
│   ├── forecasts/              # Forecast views
│   ├── profile/                # User profile
│   ├── settings/               # User settings
│   ├── globals.css             # Global styles
│   ├── layout.tsx              # Root layout
│   └── page.tsx                # Homepage
├── components/                 # React components
│   ├── comments/               # Comment thread components
│   ├── forecasts/              # Forecast-related components
│   │   └── Speedometer.tsx     # SVG probability gauge (∩-shape, green/red arcs, 3 marks: market/user/AI)
│   ├── profile/                # Profile edit form
│   ├── MainContent.tsx         # Client wrapper for <main>; removes sidebar offset on /auth/* routes
│   ├── Sidebar.tsx             # Navigation sidebar (hidden on /auth/* routes)
│   └── SessionWrapper.tsx      # Auth session provider
├── lib/                        # Shared utilities
│   ├── llm/                    # LLM integration
│   │   ├── providers/          # Provider implementations
│   │   │   ├── gemini.ts       # Google Gemini
│   │   │   ├── ollama.ts       # Ollama (self-hosted fallback)
│   │   │   └── openrouter.ts   # OpenRouter (bots)
│   │   ├── bedrock-prompts.ts  # AWS Bedrock Prompt Management (5-min cache)
│   │   ├── service.ts          # ResilientLLMService (primary + fallback)
│   │   ├── types.ts            # LLMProvider, LLMRequest, LLMResponse
│   │   └── index.ts            # Exports llmService, createBotLLMService
│   ├── services/               # Business logic services
│   ├── utils/                  # Utility functions
│   ├── validations/            # Zod schemas
│   ├── auth.ts                 # NextAuth configuration
│   ├── prisma.ts               # Prisma client singleton
│   └── logger.ts               # Pino structured logging
└── types/                      # TypeScript definitions
    └── next-auth.d.ts          # NextAuth type extensions
```

### Scripts Directory

| Script | Purpose | Usage |
|--------|---------|-------|
| `blue-green-deploy.sh` | Zero-downtime deployment | `./scripts/blue-green-deploy.sh [production\|staging]` |
| `rollback.sh` | Quick rollback to previous commit | `./scripts/rollback.sh [production\|staging]` |
| `verify-health.sh` | HTTP health check (CI-safe) | `./scripts/verify-health.sh <url>` |
| `verify-logs.sh` | Docker log inspection (server-only) | `./scripts/verify-logs.sh <staging\|production>` |
| `verify-deploy.sh` | Wrapper: health check + log inspection | `./scripts/verify-deploy.sh <url> [environment]` |
| `verify-local.sh` | Comprehensive local verification | `./scripts/verify-local.sh` |
| `verify-nginx-config.sh` | Validate nginx configuration | `./scripts/verify-nginx-config.sh` |
| `release.sh` | Interactive version tagging | `./scripts/release.sh` |
| `status.sh` | Full health/version check | `./scripts/status.sh` |
| `check.sh` | Quick up/down check | `./scripts/check.sh` |

### Terraform Structure

```
terraform/
├── main.tf                     # Provider configuration
├── ec2.tf                      # EC2 instance + user data
├── vpc.tf                      # VPC, subnets, routing
├── security_groups.tf          # Firewall rules
├── route53.tf                  # DNS records
├── s3.tf                       # Backup bucket + IAM
├── state.tf                    # S3 backend + DynamoDB state locking config
├── iam_ssm.tf                  # SSM access
├── variables.tf                # Input variables
├── outputs.tf                  # Output values
├── backend-staging.hcl         # Staging backend config (partial configuration)
├── backend-prod.hcl            # Production backend config (partial configuration)
├── terraform.tfvars            # Variable values (gitignored)
└── terraform.tfvars.example    # Example variables
```

### Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | Node.js dependencies and scripts |
| `tsconfig.json` | TypeScript configuration |
| `next.config.js` | Next.js configuration |
| `tailwind.config.js` | Tailwind CSS configuration |
| `vitest.config.ts` | Vitest test configuration |
| `Dockerfile` | Multi-stage Docker build |
| `docker-compose.yml` | Local development stack |
| `docker-compose.prod.yml` | Production Docker stack |
| `infra/nginx/nginx-ssl.conf` | Production nginx with SSL |
| `infra/nginx/nginx-staging-ssl.conf` | Staging nginx with SSL |
| `infra/nginx/nginx.conf` | Local development nginx |
| `infra/nginx/nginx-init.conf` | First-run nginx (HTTP-only, for cert issuance) |
| `.env.example` | Environment variable template |

### Documentation

| File | Purpose |
|------|---------|
| `README.md` | Project overview and quick start |
| `DAATAN_CORE.md` | Source of Truth — vision and principles |
| `GLOSSARY.md` | Terminology definitions |
| `FORECASTS_FLOW.md` | Forecast system implementation flow |
| `TODO.md` | Development tasks and guidelines |
| `TECH.md` | Technical architecture (this file) |
| `DEPLOYMENT.md` | Deployment procedures and operations |
| `SECRETS.md` | Secrets management guide |
| `VERSIONING.md` | Semantic versioning rules |
| `PRODUCT.md` | Product documentation |
| `MEMORY.md` | Session memory and context |
| `TESTING.md` | Testing strategy and guidelines |

### Testing Structure

```
__tests__/                      # Integration tests
src/
├── app/__tests__/              # API route tests
├── components/__tests__/       # Component tests
└── test/setup.ts               # Vitest configuration
```

---

## Infrastructure

### AWS Resources

| Resource | Type | Details |
|----------|------|---------|
| EC2 Instance | t3.small | Ubuntu 24.04, 2GB RAM |
| Elastic IP | Static | Assigned to EC2 |
| Route 53 | Hosted Zone | daatan.com |
| S3 Bucket | Production DB backups | `daatan-db-backups-272007598366` |
| S3 Bucket | Staging DB backups | `daatan-db-backups-staging-272007598366` |
| S3 Bucket | Avatar/upload storage | `daatan-uploads-prod-272007598366`, `daatan-uploads-staging-272007598366` |
| Security Group | Firewall | HTTP, HTTPS (port 22 blocked — use SSM for server access) |
| IAM Role | EC2 Profile | `daatan-ec2-role-staging` — SSM + S3 backup access (both buckets) |

### Live Deployment

**Production URL:** https://daatan.com
**Staging URL:** https://staging.daatan.com

| Component | Value |
|-----------|-------|
| Region | `eu-central-1` (Frankfurt) |
| SSL Certificate | Valid until April 17, 2026 |

### Network & DNS

| Component | Provider/Service | Purpose |
|-----------|------------------|---------|
| Domain Registrar | Namecheap | Owns `daatan.com` |
| DNS Management | Route 53 | Hosted zone |
| Nameservers | AWS | 4 NS records delegated from Namecheap |

### Security Group Rules

| Port | Protocol | Source | Purpose |
|------|----------|--------|---------|
| 22 | TCP | Blocked | SSH — not used; access is via AWS SSM only |
| 80 | TCP | 0.0.0.0/0 | HTTP (redirects to HTTPS) |
| 443 | TCP | 0.0.0.0/0 | HTTPS |
| ICMP | - | 0.0.0.0/0 | Ping (debugging) |
### Terraform Resources

```hcl
# Key resources managed by Terraform
aws_instance.backend          # EC2 instance
aws_eip.backend               # Elastic IP
aws_route53_zone.main         # DNS zone
aws_route53_record.*          # DNS records
aws_s3_bucket.backups         # Backup bucket
```

### Terraform Workflow (State Separation)

Terraform state is stored in S3 (`daatan-terraform-state`) and uses DynamoDB for state locking.
**Crucial:** Staging and Production environments are completely isolated using "Partial Configuration". You MUST pass the correct backend configuration file when initializing Terraform.

```bash
cd terraform

# For Staging:
terraform init -backend-config=backend-staging.hcl
terraform plan -var="environment=staging"
terraform apply -var="environment=staging"

# For Production:
terraform init -backend-config=backend-prod.hcl
terraform plan -var="environment=prod"
terraform apply -var="environment=prod"
```

aws_security_group.ec2        # Firewall rules
aws_iam_role.ec2_role         # IAM role
aws_vpc.main                  # VPC
aws_subnet.public_a           # Public subnet
```

**Note:** Instance type changes are ignored in lifecycle to prevent accidental recreation.

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

#### Bot Runner Workflow (cron)

A scheduled workflow runs every 5 minutes and calls `POST /api/bots/run` with the `x-bot-runner-secret` header. This triggers `runDueBots()` which checks all active bots and runs any that are due.

**Required secret:** `BOT_RUNNER_SECRET` — must match the value of the `BOT_RUNNER_SECRET` environment variable in the running app.

See [docs/bots.md](./docs/bots.md) for full bot system documentation.

#### Deploy Workflow (`deploy.yml`)

**Triggers:**
- Push to `main` → Deploy to Staging
- Push tag `v*` → Deploy to Production
- Manual dispatch → Either environment

**Pipeline Stages:**
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Build &   │────▶│   Deploy    │────▶│   Verify    │
│    Test     │     │   (SSM)     │     │   (Health)  │
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
- Send command via AWS SSM (SSH port 22 is blocked)
- Download deploy scripts from GitHub at the current commit SHA
- Pull Docker image from ECR (`staging-latest`)
- Run blue-green deployment (`scripts/blue-green-deploy.sh staging`)
- Verify health check externally

**Deploy Stage (Production):**
- Same as staging but triggered by version tag (`v*`)
- Pulls image tagged with the specific version
- More conservative cleanup

### Required Secrets

| Secret | Purpose |
|--------|---------|
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | IAM credentials for SSM + ECR access |
| `POSTGRES_PASSWORD` | Database password |
| `NEXTAUTH_SECRET` | Auth encryption key |
| `GOOGLE_CLIENT_ID` | OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret |
| `GEMINI_API_KEY` | AI API key |
| `BOT_RUNNER_SECRET` | Shared secret for `POST /api/bots/run` (cron endpoint) |
| `OPENROUTER_API_KEY` | OpenRouter LLM API key (used by bots) |
| `RESEND_API_KEY` | Email delivery via Resend |
| `VAPID_PUBLIC_KEY` | Browser push notification public key |
| `VAPID_PRIVATE_KEY` | Browser push notification private key |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token for notifications |
| `TELEGRAM_CHAT_ID` | Telegram channel ID for notifications |
| `CRON_SECRET` | Shared secret for `/api/cron/cleanup` |
| `STAGING_URL` | Staging URL (used by bot runner workflow) |

---

## Database

### Schema Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         User                                    │
│  - id, email, name, image, isBot                                │
│  - rs (Reputation Score), cuAvailable, cuLocked                 │
└─────────────────────────────────────────────────────────────────┘
         │                    │                    │           │
         │ creates            │ commits            │ resolves  │ 1:1
         ▼                    ▼                    ▼           ▼
┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐  ┌──────────────────┐
│   Prediction    │  │   Commitment    │  │ CuTransaction│  │   BotConfig      │
│  - claimText    │  │  - cuCommitted  │  │ - type,amount│  │  - personaPrompt │
│  - outcomeType  │  │  - rsSnapshot   │  │ - balanceAfter│  │  - intervalMins  │
│  - status       │  │  - binaryChoice │  │              │  │  - autoApprove   │
└─────────────────┘  └─────────────────┘  └──────────────┘  └────────┬─────────┘
         │                                                            │ 1:many
         │ linked to                                                  ▼
         ▼                                                  ┌──────────────────┐
┌─────────────────┐                                         │   BotRunLog      │
│   NewsAnchor    │                                         │  - action (enum) │
│  - url, title   │                                         │  - isDryRun      │
│  - source       │                                         │  - generatedText │
│  - publishedAt  │                                         │  - error         │
└─────────────────┘                                         └──────────────────┘
```

### Key Models

| Model | Purpose | Key Fields |
|-------|---------|------------|
| User | User accounts | rs, cuAvailable, cuLocked, isBot, avatarUrl, slug, username |
| Prediction | Forecast statements | claimText, outcomeType, status, source |
| PredictionOption | Options for multiple choice | text, predictionId |
| Commitment | CU stakes | cuCommitted, rsSnapshot |
| CommitmentWithdrawal | Early exit record | commitmentId, cuRefunded, penaltyBurned |
| NewsAnchor | News context | url, title, source |
| CuTransaction | CU ledger | type, amount, balanceAfter |
| Comment | Prediction comments | content, userId, predictionId |
| CommentReaction | Emoji reactions on comments | type, userId, commentId |
| Notification | User notifications | type, message, read, userId |
| NotificationPreference | Per-channel notification settings | userId, channel, enabled |
| PushSubscription | Browser push subscription | userId, endpoint, keys |
| ContextSnapshot | LLM context cache | key, content, expiresAt |
| Tag | Prediction categories | name, slug |
| BotConfig | Autonomous bot configuration | personaPrompt, intervalMinutes, autoApprove, tagFilter, voteBias |
| BotRunLog | Audit log of bot actions | action (CREATED_FORECAST, VOTED, SKIPPED, ERROR), isDryRun, generatedText |

### Legacy Models (Deprecated)

| Model | Purpose |
|-------|---------|
| `Forecast` | Old prediction system |
| `ForecastOption` | Old prediction options |
| `Vote` | Old voting system |

### Database Operations

> **All server commands go via AWS SSM** — SSH port 22 is blocked. See `/ssm` skill or DEPLOYMENT.md.

```bash
# Connect to production DB (via SSM)
aws ssm send-command --instance-ids <ID> --document-name AWS-RunShellScript \
  --parameters '{"commands":["docker exec -i daatan-postgres psql -U daatan -d daatan -c \"\\dt\""]}'

# Run migrations (always use staging app container — prod image may be outdated)
# via SSM on the server:
docker exec -e DATABASE_URL=postgresql://daatan:<PASS>@postgres:5432/daatan \
  daatan-app-staging npx prisma migrate deploy

# Check migration status (24 migrations total as of v1.7.70)
docker exec daatan-app-staging npx prisma migrate status

# Manual backup (script handles this automatically)
bash /home/ubuntu/backup-db.sh
```

### Prod/Staging DB Separation

Both databases run on the **same EC2 instance** in separate containers:

| | Production | Staging |
|---|---|---|
| Container | `daatan-postgres` | `daatan-postgres-staging` |
| Database name | `daatan` | `daatan_staging` |
| Volume | `app_postgres_data` | `app_postgres_staging_data` |
| App container | `daatan-app` | `daatan-app-staging` |
| URL | daatan.com | staging.daatan.com |

The staging and production databases are **fully independent**. They share no data unless explicitly copied.

### Automated Backups

- **Script:** `/home/ubuntu/backup-db.sh`
- **Cron:** `/etc/cron.d/daatan-backup` — daily at **03:00 UTC**
- **Backs up both DBs:**
  - Prod (`daatan-postgres` → `daatan`) → `s3://daatan-db-backups-272007598366/daily/`
  - Staging (`daatan-postgres-staging` → `daatan_staging`) → `s3://daatan-db-backups-staging-272007598366/daily/`
- **S3 filename format:** `daatan_YYYYMMDD_HHMMSS.sql.gz` / `daatan_staging_YYYYMMDD_HHMMSS.sql.gz`
- **Local retention:** last 7 files in `/home/ubuntu/backups/`
- **Size guard:** files under 1 KB are rejected (catches empty-DB dumps)
- **Failure alerting:** sends Telegram message to "Daatan Updates" channel on any failure
- **Watchdog:** `/home/ubuntu/backup-watchdog.sh` — cron at **07:00 UTC** (`/etc/cron.d/daatan-backup-watchdog`), alerts if no backup uploaded to S3 today

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

Auth pages are rendered without the sidebar: `Sidebar` returns `null` on `/auth/*` routes, and `MainContent` removes the `lg:ml-64 mt-16` offset so auth pages fill the full viewport.

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

To manually renew:
```bash
docker run --rm \
  -v ~/app/certbot/www:/var/www/certbot \
  -v ~/app/certbot/conf:/etc/letsencrypt \
  certbot/certbot renew
docker compose -f ~/app/docker-compose.prod.yml restart nginx
```

### Security Headers (Nginx)

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Frame-Options` | `SAMEORIGIN` | Prevents clickjacking |
| `X-Content-Type-Options` | `nosniff` | Blocks MIME-type sniffing |
| `X-XSS-Protection` | `1; mode=block` | Legacy XSS filter |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Enforces HTTPS |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Controls referrer leakage |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Disables unused browser APIs |
| `Content-Security-Policy` | See below | Controls allowed resource origins |

### Content-Security-Policy

| Directive | Value | Why |
|-----------|-------|-----|
| `default-src` | `'self'` | Baseline — same-origin only |
| `script-src` | `'self' https://www.googletagmanager.com 'unsafe-inline'` | App bundles + GA + inline GA init |
| `style-src` | `'self' https://fonts.googleapis.com 'unsafe-inline'` | Tailwind + Google Fonts + Next.js inline |
| `font-src` | `'self' https://fonts.gstatic.com` | Google Fonts woff2 files |
| `img-src` | `'self' https://lh3.googleusercontent.com data:` | App images + Google OAuth avatars |
| `connect-src` | `'self' https://www.google-analytics.com https://*.google-analytics.com` | GA event beacons |
| `frame-ancestors` | `'none'` | Blocks embedding |
| `object-src` | `'none'` | Blocks Flash/Java plugins |
| `base-uri` | `'self'` | Prevents `<base>` tag hijacking |
| `form-action` | `'self'` | Forms submit to same origin only |
| `worker-src` | `'self'` | PWA service workers |

**Rollout strategy:**
- Staging/production use `Content-Security-Policy-Report-Only` — violations are logged but not blocked
- Local dev uses enforcing `Content-Security-Policy` for early detection
- **To enforce in production:** change `Content-Security-Policy-Report-Only` to `Content-Security-Policy` in `infra/nginx/nginx-ssl.conf` and `infra/nginx/nginx-staging-ssl.conf`

**Adding a new external resource:**
1. Identify the directive (e.g., `script-src` for JS, `img-src` for images)
2. Add the origin to the CSP in all 3 nginx configs
3. Update test expectations in `__tests__/config/nginx-security-headers.test.ts`
4. Deploy and verify no violations in browser console

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
- See [SECRETS.md](./SECRETS.md) for details

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
git clone https://github.com/komapc/daatan.git
cd daatan
npm install
cp .env.example .env
# Edit .env with your values
npm run dev
```

### Environment Variables

Required in `.env`:

```bash
DATABASE_URL=postgresql://user:password@host:5432/database
NEXTAUTH_SECRET=<secure-random-string>
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=<google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<google-oauth-client-secret>
POSTGRES_PASSWORD=<secure-password>
GEMINI_API_KEY=<gemini-api-key>
BOT_RUNNER_SECRET=<shared-secret-for-cron-endpoint>
AWS_REGION=eu-central-1
AWS_PROFILE=daatan
```

### Git Hooks (Husky)

**Pre-Commit:**
- Build verification
- Run all tests
- Lint check (warning only)

**Pre-Push:**
- Detect auth-related changes
- Prompt for manual auth testing

### Git Workflow

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready code, auto-deploys to staging |
| `feat/*`, `fix/*`, `chore/*` | Feature/fix development branches |

| Trigger | Target |
|---------|--------|
| Push to `main` | Staging (staging.daatan.com) |
| Push tag `v*` | Production (daatan.com) |
| Manual workflow | Either environment |

### Testing

```bash
npm test                        # Run all tests
npm test -- --coverage          # Run with coverage
npm test -- path/to/test.ts     # Run specific test
npm run lint                    # Lint
npx tsc --noEmit                # Type check
```

### Local Verification

```bash
./scripts/verify-local.sh       # Comprehensive pre-push check
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Health check fails | Check logs: `docker logs daatan-app --tail 50` |
| 502 Bad Gateway | Verify app container running: `docker ps` |
| Database connection error | Check postgres: `docker exec daatan-postgres pg_isready` |
| SSL certificate error | Renew: `docker exec daatan-certbot certbot renew` |
| High memory usage | Restart container: `docker compose restart app` |

### Debug Commands

```bash
docker ps -a --filter name=daatan-          # All containers
docker exec daatan-nginx nginx -t           # Check nginx config
docker exec daatan-app env | grep -E "NEXT|DATABASE|GOOGLE"  # Check env vars
df -h                                       # Disk space
free -m                                     # Memory
```

---

## Related Documentation

- [DEPLOYMENT.md](./DEPLOYMENT.md) — Deployment procedures and operations
- [PRODUCT.md](./PRODUCT.md) — Product documentation
- [TODO.md](./TODO.md) — Technical debt and roadmap
- [SECRETS.md](./SECRETS.md) — Secrets management guide
