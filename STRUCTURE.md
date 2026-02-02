# DAATAN Project Structure

> Comprehensive overview of the codebase organization and architecture.
> Last updated: January 2026

---

## Directory Overview

```
daatan/
├── .github/                    # GitHub configuration
│   └── workflows/              # CI/CD pipelines
│       ├── deploy.yml          # Main deployment workflow
│       └── version-bump.yml    # Automatic version bumping
├── .husky/                     # Git hooks
│   ├── pre-commit              # Build + test verification
│   └── pre-push                # Auth change detection
├── .kiro/                      # Kiro IDE configuration
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

---

## Source Code Structure (`src/`)

```
src/
├── app/                        # Next.js App Router
│   ├── api/                    # API routes
│   │   ├── auth/               # NextAuth.js endpoints
│   │   ├── forecasts/          # Legacy forecast CRUD
│   │   ├── health/             # Health check endpoint
│   │   ├── news-anchors/       # News anchor management
│   │   ├── predictions/        # New prediction system
│   │   └── version/            # Version endpoint
│   ├── auth/                   # Auth pages
│   │   ├── signin/             # Sign in page
│   │   │   ├── page.tsx        # Server Component wrapper
│   │   │   └── SignInClient.tsx # Client Component with UI
│   │   └── error/              # Auth error page
│   │       ├── page.tsx        # Server Component wrapper
│   │       └── AuthErrorClient.tsx # Client Component with UI
│   ├── create/                 # Prediction creation
│   ├── leaderboard/            # User rankings
│   ├── notifications/          # User notifications
│   ├── predictions/            # Prediction views
│   ├── profile/                # User profile
│   ├── settings/               # User settings
│   ├── globals.css             # Global styles
│   ├── layout.tsx              # Root layout
│   ├── loading.tsx             # Loading state
│   ├── not-found.tsx           # 404 page
│   └── page.tsx                # Homepage
├── components/                 # React components
│   ├── predictions/            # Prediction-related components
│   ├── ClientOnly.tsx          # Client-side rendering wrapper
│   ├── ForecastForm.tsx        # Legacy forecast form
│   ├── SessionWrapper.tsx      # Auth session provider
│   ├── Sidebar.tsx             # Navigation sidebar
│   └── StagingBanner.tsx       # Staging environment indicator
├── lib/                        # Shared utilities
│   ├── llm/                    # LLM integration (Gemini)
│   ├── utils/                  # Utility functions
│   ├── validations/            # Zod schemas
│   ├── auth.ts                 # NextAuth configuration
│   ├── prisma.ts               # Prisma client singleton
│   └── version.ts              # Version constant
├── test/                       # Test utilities
│   └── setup.ts                # Vitest setup
└── types/                      # TypeScript definitions
    └── next-auth.d.ts          # NextAuth type extensions
```

---

## Scripts Directory (`scripts/`)

| Script | Purpose | Usage |
|--------|---------|-------|
| `blue-green-deploy.sh` | Zero-downtime deployment | `./scripts/blue-green-deploy.sh [production\|staging]` |
| `rollback.sh` | Quick rollback to previous commit | `./scripts/rollback.sh [production\|staging]` |
| `verify-deploy.sh` | Verify deployment health + version | `./scripts/verify-deploy.sh <url>` |
| `verify-local.sh` | Comprehensive local verification | `./scripts/verify-local.sh` |
| `verify-nginx-config.sh` | Validate nginx configuration | `./scripts/verify-nginx-config.sh` |
| `release.sh` | Interactive version tagging | `./scripts/release.sh` |
| `status.sh` | Full health/version check | `./scripts/status.sh` |
| `check.sh` | Quick up/down check | `./scripts/check.sh` |
| `test-deployment-scripts.sh` | Validate deployment scripts | `./scripts/test-deployment-scripts.sh` |

---

## Terraform Structure (`terraform/`)

```
terraform/
├── main.tf                     # Provider configuration
├── ec2.tf                      # EC2 instance + user data
├── vpc.tf                      # VPC, subnets, routing
├── security_groups.tf          # Firewall rules
├── route53.tf                  # DNS records
├── s3.tf                       # Backup bucket + IAM
├── iam_ssm.tf                  # SSM access (optional)
├── variables.tf                # Input variables
├── outputs.tf                  # Output values
├── terraform.tfvars            # Variable values (gitignored)
└── terraform.tfvars.example    # Example variables
```

---

## Configuration Files

### Root Level

| File | Purpose |
|------|---------|
| `package.json` | Node.js dependencies and scripts |
| `tsconfig.json` | TypeScript configuration |
| `next.config.js` | Next.js configuration |
| `tailwind.config.js` | Tailwind CSS configuration |
| `postcss.config.js` | PostCSS configuration |
| `vitest.config.ts` | Vitest test configuration |
| `Dockerfile` | Multi-stage Docker build |
| `docker-compose.yml` | Local development stack |
| `docker-compose.prod.yml` | Production Docker stack |
| `nginx-ssl.conf` | Production nginx with SSL |
| `nginx-init.conf` | Initial nginx for SSL setup |
| `nginx.conf` | Local development nginx |
| `deploy.sh` | Initial deployment script |
| `.env.example` | Environment variable template |
| `.dockerignore` | Docker build exclusions |
| `.gitignore` | Git exclusions |

### Documentation

| File | Purpose |
|------|---------|
| `README.md` | Project overview and quick start |
| `DAATAN_CORE.md` | Source of Truth - vision and principles |
| `GLOSSARY.md` | Terminology definitions |
| `FORECASTS_FLOW.md` | Prediction system implementation flow |
| `TODO.md` | Development tasks and guidelines |
| `DEPLOYMENT.md` | Complete deployment guide |
| `DEPLOYMENT_CHECKLIST.md` | Deployment verification checklist |
| `DEPLOYMENT_SUMMARY.md` | Infrastructure status summary |
| `INFRASTRUCTURE.md` | AWS infrastructure details |
| `VERSIONING.md` | Semantic versioning rules |
| `PRODUCT_NAMING.md` | Product naming conventions |
| `STRUCTURE.md` | This file - project structure |
| `PRODUCT.md` | Product documentation |
| `TECH.md` | Technical documentation |

---

## Database Schema Overview

### Core Models (New Prediction System)

```
User ─────────────────┬─────────────────────────────────────┐
  │                   │                                     │
  │ creates           │ commits to                          │ resolves
  ▼                   ▼                                     ▼
Prediction ◄──────── Commitment ──────► PredictionOption
  │
  │ linked to
  ▼
NewsAnchor
```

### Key Entities

| Model | Purpose |
|-------|---------|
| `User` | User accounts with RS (Reputation Score) and CU (Confidence Units) |
| `NewsAnchor` | Immutable snapshot of news articles |
| `Prediction` | Testable forecast statements |
| `PredictionOption` | Options for multiple choice predictions |
| `Commitment` | User's CU stake on a prediction |
| `CuTransaction` | CU ledger for audit trail |

### Legacy Models (Deprecated)

| Model | Purpose |
|-------|---------|
| `Forecast` | Old prediction system |
| `ForecastOption` | Old prediction options |
| `Vote` | Old voting system |

---

## Environment Variables

### Required for Production

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# Authentication
NEXTAUTH_SECRET=<secure-random-string>
NEXTAUTH_URL=https://daatan.com
GOOGLE_CLIENT_ID=<google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<google-oauth-client-secret>

# Database (Docker)
POSTGRES_PASSWORD=<secure-password>

# AI Integration
GEMINI_API_KEY=<gemini-api-key>
```

### Optional

```bash
# Environment indicator
NEXT_PUBLIC_ENV=production|staging

# Deployment tracking
DEPLOY_ID=<timestamp>
```

---

## Git Workflow

### Branches

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready code, auto-deploys to staging |
| `feature/*` | Feature development branches |

### Deployment Triggers

| Trigger | Target |
|---------|--------|
| Push to `main` | Staging (staging.daatan.com) |
| Push tag `v*` | Production (daatan.com) |
| Manual workflow | Either environment |

### Version Bumping

Automatic on PR merge to `main`:
- `feat:` prefix → Minor bump (0.X.0)
- `BREAKING:` prefix → Major bump (X.0.0)
- Other → Patch bump (0.0.X)

---

## Testing Structure

```
__tests__/                      # Integration tests
src/
├── app/__tests__/              # API route tests
├── components/__tests__/       # Component tests
└── test/setup.ts               # Vitest configuration
```

### Test Commands

```bash
npm test                        # Run all tests (vitest --run)
npm run lint                    # Run ESLint
```

---

## Docker Architecture

### Production Stack (`docker-compose.prod.yml`)

```
┌─────────────────────────────────────────────────────┐
│                    Internet                         │
└────────────────────┬────────────────────────────────┘
                     │ HTTPS (443)
                     ▼
        ┌────────────────────────┐
        │   daatan-nginx         │
        │   (Reverse Proxy)      │
        └────────┬───────────────┘
                 │
        ┌────────┴────────┐
        ▼                 ▼
    ┌────────┐        ┌──────────┐
    │daatan- │        │daatan-   │
    │app     │        │app-      │
    │:3000   │        │staging   │
    └────┬───┘        └──────┬───┘
         │                   │
         └───────┬───────────┘
                 ▼
         ┌──────────────────┐
         │  daatan-postgres │
         │  (PostgreSQL 16) │
         └──────────────────┘
```

### Containers

| Container | Image | Purpose |
|-----------|-------|---------|
| `daatan-nginx` | `nginx:alpine` | Reverse proxy, SSL termination |
| `daatan-app` | `daatan-app:latest` | Production Next.js app |
| `daatan-app-staging` | `daatan-app:staging-*` | Staging Next.js app |
| `daatan-postgres` | `postgres:16-alpine` | PostgreSQL database |
| `daatan-certbot` | `certbot/certbot` | SSL certificate renewal |

---

## Related Documentation

- [PRODUCT.md](./PRODUCT.md) — Product vision and features
- [TECH.md](./TECH.md) — Technical architecture and decisions
- [DEPLOYMENT.md](./DEPLOYMENT.md) — Deployment procedures
- [DAATAN_CORE.md](./DAATAN_CORE.md) — Source of Truth
