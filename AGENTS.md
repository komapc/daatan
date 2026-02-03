# AGENTS.md - DAATAN Project

## Tech Stack
- **Frontend:** Next.js 14 (App Router), React, Tailwind CSS
- **Backend:** Node.js, PostgreSQL 16, Prisma 5.16
- **Auth:** NextAuth.js with Google OAuth
- **Infra:** Docker Compose (local), AWS EC2 (prod), GitHub Actions (CI/CD)

## Commands
- **Install:** `npm install`
- **Dev:** `npm run dev`
- **Test:** `npm test`
- **Build:** `npm run build`
- **Lint:** `npm run lint`
- **DB Migration:** `npx prisma migrate dev`

## Git Workflow
1. Create feature branch from main: `git checkout -b feature/description`
2. Implement changes
3. Run tests locally: `npm test && npm run build && npm run lint`
4. Push to origin (triggers staging deploy on main)
5. Request HITL approval via Telegram
6. On approval: merge to main, tag for production

## Role Responsibilities

### Developer
- Implement features from chat or TODO.md
- Write clean, typed code following existing patterns
- Create feature branches, never commit directly to main
- Update TODO.md when completing tasks

### QA
- Run test suite before any push
- Verify staging deployment works
- Check for regressions
- Monitor error logs

### DevOps
- Handle Docker builds
- Manage deployments via GitHub Actions
- Request HITL for production operations
- Monitor infrastructure health

## Governance
- Production deploys require komap approval via Telegram
- DB migrations require komap approval
- Terraform changes require komap approval
- File deletions are autonomous (use trash when possible)

## URLs
- Production: https://daatan.com
- Staging: https://staging.daatan.com
- Repository: https://github.com/komapc/daatan
