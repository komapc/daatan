# Design Document: OpenClaw Team Configuration for DAATAN

## Overview

This design specifies the configuration files and settings needed to deploy "The Clawborators" - a 3-agent OpenClaw team for the DAATAN project. The architecture follows a hybrid configuration model with global personality settings and per-project operational context.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Global (~/.openclaw/workspace/)          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   SOUL.md    │  │ IDENTITY.md  │  │   USER.md    │      │
│  │ (personality)│  │ (team name)  │  │ (komap info) │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐                        │
│  │openclaw.json │  │   TOOLS.md   │                        │
│  │  (config)    │  │ (local notes)│                        │
│  └──────────────┘  └──────────────┘                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ overrides/supplements
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Per-Project (DAATAN repo root)                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  AGENTS.md   │  │  MEMORY.md   │  │ HEARTBEAT.md │      │
│  │(operations)  │  │ (knowledge)  │  │ (monitoring) │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐                                          │
│  │   TODO.md    │                                          │
│  │   (tasks)    │                                          │
│  └──────────────┘                                          │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Global Configuration Files

#### 1.1 IDENTITY.md (Update existing)
```markdown
# IDENTITY.md - Who We Are

- **Name:** The Clawborators
- **Creature:** AI engineering squad
- **Vibe:** Technical, efficient, proactive. We ship code.
- **Emoji:** 🦀
- **Avatar:** (optional - can add later)
```

#### 1.2 USER.md (Update existing)
```markdown
# USER.md - About komap

- **Name:** komap
- **Timezone:** Israel (UTC+2/+3)
- **Quiet Hours:** 00:00-08:00 Israel time
- **Notifications:** Telegram bot

## Preferences
- Concise communication
- No fluff, just results
- Prefers feature branches over direct commits
- Wants HITL for: production deploys, DB migrations, terraform

## Context
- Solo developer on DAATAN project
- Cost-conscious (maximize free tiers)
- New to OpenClaw - flag potential mistakes
```

#### 1.3 SOUL.md (Update existing - add DAATAN-specific safety rules)
Keep existing content, append:
```markdown
## DAATAN-Specific Rules

### Cost Control
- Use gemini-1.5-flash for routine tasks (heartbeats, simple checks)
- Use gemini-1.5-pro only for complex reasoning/coding
- If task exceeds 50k tokens estimate, ask komap first
- Fallback to Ollama when Gemini quota exhausted

### Safety
- NEVER output .env contents or AWS secrets
- NEVER push directly to main without approval
- NEVER run terraform apply without HITL
- NEVER run DB migrations on staging/prod without HITL
- If command fails twice, STOP and report - don't retry blindly

### Quiet Hours
- 00:00-08:00 Israel time: queue non-urgent notifications
- Urgent = production down, security breach, data loss risk
```

#### 1.4 openclaw.json (Replace existing)
```json
{
  "agents": {
    "defaults": {
      "model": { "primary": "google/gemini-1.5-pro" },
      "tools": {
        "allow": ["read", "write", "exec", "github"],
        "exec": { "ask": "on", "security": "full" }
      }
    },
    "developer": {
      "instructions": "Full-stack development for DAATAN. React/Tailwind frontend, Node.js/PostgreSQL backend. Follow feature branch workflow."
    },
    "qa": {
      "model": { "primary": "google/gemini-1.5-flash" },
      "instructions": "Run tests (npm test, build, lint). Monitor staging/prod health. Verify deployments before approval requests."
    },
    "devops": {
      "instructions": "Manage Docker builds, GitHub operations, deployments. Request HITL for prod deploys, DB migrations, terraform."
    }
  },
  "models": {
    "mode": "merge",
    "providers": {
      "google": { "apiKey": "${GEMINI_API_KEY}" },
      "ollama": { "baseUrl": "http://localhost:11434" }
    },
    "fallback": ["ollama/llama3.1", "ollama/codellama"]
  },
  "sandbox": {
    "mode": "non-main"
  },
  "gateway": {
    "bind": "127.0.0.1"
  },
  "notifications": {
    "telegram": {
      "enabled": true,
      "token": "${TELEGRAM_BOT_TOKEN}",
      "chatId": "${TELEGRAM_CHAT_ID}"
    }
  },
  "hitl": {
    "required": [
      "git push origin main",
      "git push --tags",
      "terraform apply",
      "prisma migrate deploy",
      "npm run db:migrate"
    ],
    "timeout": "24h"
  }
}
```

### 2. Per-Project Configuration Files (DAATAN repo root)

#### 2.1 AGENTS.md
```markdown
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
```

#### 2.2 MEMORY.md
```markdown
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
```

#### 2.3 HEARTBEAT.md
```markdown
# HEARTBEAT.md - Proactive Checks

## Every 4 Hours
- [ ] QA: Check https://staging.daatan.com/api/health is reachable
- [ ] QA: Check https://daatan.com/api/health is reachable
- [ ] DevOps: Check local disk space (warn if <10GB free)

## Daily (09:00 Israel time)
- [ ] Developer: Summarize yesterday's commits (3 sentences max)
- [ ] Developer: List any pending PRs or stale branches
- [ ] DevOps: Run `npm audit` and report critical vulnerabilities

## Weekly (Sunday 10:00)
- [ ] DevOps: Check SSL certificate expiry for daatan.com
- [ ] QA: Review error logs from past week

## Rules
- During quiet hours (00:00-08:00): queue notifications, don't send
- Only ping Telegram for: failures, security issues, items needing action
- Use HEARTBEAT_OK response if nothing needs attention
- Track check timestamps in memory/heartbeat-state.json
```

#### 2.4 TODO.md (Template)
```markdown
# TODO.md - Task Queue

## In Progress
<!-- Items currently being worked on -->

## Up Next
<!-- Prioritized backlog -->

## Completed
<!-- Move items here when done, with date -->

---
*Agents: Work through "Up Next" items in order. Move to "In Progress" when starting. Move to "Completed" with date when done. Notify komap via Telegram when ready for review.*
```

### 3. Ollama Setup (for fallback)

Installation instructions to include in documentation:

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull recommended models
ollama pull llama3.1
ollama pull codellama

# Verify running
ollama list
```

## Data Models

No database changes required. Configuration is file-based.

## Error Handling

| Scenario | Handling |
|----------|----------|
| Gemini API quota exhausted | Fallback to Ollama models |
| Ollama not running | Log warning, skip task, notify user |
| Command fails twice | Stop, generate diagnostic report, notify user |
| HITL timeout (24h) | Cancel operation, notify user |
| Staging unreachable | Alert via Telegram (unless quiet hours) |
| Production unreachable | URGENT alert via Telegram (bypass quiet hours) |

## Testing Strategy

1. **Configuration Validation**
   - Verify openclaw.json is valid JSON
   - Verify all referenced env vars exist
   - Test Telegram bot connectivity

2. **Workflow Testing**
   - Create test feature branch
   - Verify HITL triggers for protected operations
   - Verify quiet hours suppression works

3. **Heartbeat Testing**
   - Manually trigger heartbeat
   - Verify health checks execute
   - Verify notifications route correctly

## Security Considerations

1. **Secrets Management**
   - All secrets in .env (not in config files)
   - Config files safe to commit to git
   - Agents instructed to never output secrets

2. **Sandbox Mode**
   - Non-main sessions run in sandbox
   - Prevents accidental system damage
   - Main session has full access (use carefully)

3. **Network Binding**
   - Gateway bound to 127.0.0.1 only
   - Not accessible from network
   - Safe for local development

## Migration Notes

When moving to EC2/Docker later:
1. Copy ~/.openclaw/workspace/ to new machine
2. Clone DAATAN repo (includes per-project configs)
3. Set up .env with API keys
4. Consider switching sandbox.mode to "docker" for full isolation
