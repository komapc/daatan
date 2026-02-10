# Antigravity Project Rules

## 🚨 CRITICAL GIT WORKFLOW RULES

### NEVER Push to Main or Staging
- **NEVER** push directly to `main` branch
- **NEVER** push directly to `staging` branch
- **ALWAYS** create a feature/fix branch
- **ALWAYS** create a PR for review
- **NEVER** use `gh pr merge` - user will merge PRs manually
- After creating PR, **STOP** and wait for user review

### Branch Naming
- Use conventional branch names: `feat/`, `fix/`, `chore/`, `docs/`
- Keep branch names descriptive and kebab-case

### PR Creation Process
1. Create feature branch from current branch (usually `feat/*` or `main`)
2. Make changes and commit
3. Run pre-push checks (handled by git hooks)
4. Push branch to origin
5. Create PR via GitHub CLI or web interface
6. **STOP and wait** - do NOT merge

## PR Quality Requirements

### Before Creating Any PR
ALWAYS run these checks locally before pushing:
1. **Run tests**: `npm test`
2. **Run build**: `npm run build`
3. **Run linter**: `npm run lint`

### Zero Tolerance for Errors
- PRs must have 0 test failures
- PRs must have 0 build errors
- Fix any issues before creating the PR

## Decision Making

### Be Decisive
- For routine tasks (file edits, refactoring, bug fixes): just do it
- Only ask for confirmation on:
  - Destructive operations (deleting files, dropping tables)
  - Major architectural changes
  - Changes to production infrastructure
  - Ambiguous requirements

### When Uncertain
- Make reasonable assumptions and state them
- Prefer action over asking clarifying questions
- If truly ambiguous, ask ONE focused question

## Communication Style
- Be concise and direct
- Skip obvious explanations
- No need to summarize what you just did unless asked
- Don't repeat yourself

## Code Changes
- Make changes directly, don't ask "should I proceed?"
- Fix obvious issues without asking
- Add tests only when explicitly requested
- Keep refactoring minimal unless asked for cleanup

## Coding Standards

### React/Next.js
- Use functional components with hooks
- Prefer Server Components where possible
- Use App Router patterns (not Pages Router)
- Client components must have "use client" directive
- For pages with useSearchParams, split into Server/Client components
- Always wrap useSearchParams in Suspense boundary

### Database
- Always use Prisma for database operations
- Use transactions for multi-step operations
- Add indexes for frequently queried fields

### API Routes
- Use Zod for request validation (schemas in `src/lib/validations/`)
- Return consistent error responses
- Include proper HTTP status codes

### Testing
- Use Vitest for unit tests
- Tests go in `__tests__/` or adjacent to source files
- Mock external services

### Git Commits
- Use conventional commits: `feat:`, `fix:`, `chore:`, etc.
- Keep PRs focused and small

## Interactive Commands
- **NEVER** run commands that require user input
- SSH: Always use SSH keys configured in `~/.ssh/config`
- For server access, use the `daatan` SSH alias
- Git commands: Use `GIT_PAGER=cat` and `--no-pager` to prevent hangs

## Deployment Tasks
- When fixing staging/production issues, task is NOT complete until code is pushed
- After local tests pass, immediately commit and push to trigger deployment
- Don't stop at "tests pass" - follow through to deployment
- Check Docker build logs if pages are missing from production

## Next.js App Router Gotchas
- `export const dynamic = 'force-dynamic'` only works in Server Components
- If a page has `'use client'`, the dynamic export is IGNORED
- For client pages needing dynamic rendering, split into Server/Client components
- `useSearchParams()` requires Suspense boundary in Next.js 14+
- Add `transpilePackages: ['next-auth']` in next.config.js for Docker builds
