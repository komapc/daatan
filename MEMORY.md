# MEMORY.md - DAATAN Knowledge Base

## Architecture Decisions
- PostgreSQL 16 for strict data integrity (not NoSQL)
- Next.js 14 App Router (not Pages Router)
- Tailwind CSS with mobile-first approach
- NextAuth.js for authentication (Google OAuth)
- Prisma as ORM

## Environment
- **Repository:** https://github.com/komapc/daatan
- **Primary Branch:** main
- **Local DB Port:** 5432
- **Production:** AWS EC2 (Ubuntu), Docker
- **Staging:** Same EC2, different container

## Key Files
- Database schema: `prisma/schema.prisma`
- Auth config: `src/lib/auth.ts`
- API routes: `src/app/api/`
- Version: `src/lib/version.ts`
- Deployment: `docker-compose.prod.yml`, `.github/workflows/deploy.yml`

## Deployment Notes
- Push to main → auto-deploys to staging
- Push tag v* → auto-deploys to production
- Rollback: `./scripts/rollback.sh [production|staging]`
- Zero-downtime: `./scripts/blue-green-deploy.sh`

## Known Issues / Gotchas
- `export const dynamic = 'force-dynamic'` only works in Server Components
- Client pages with useSearchParams need Suspense boundary
- Add `transpilePackages: ['next-auth']` in next.config.js for Docker builds
- Git commands need `GIT_PAGER=cat` to avoid hanging

## Lessons Learned
(Update this as we learn things)
