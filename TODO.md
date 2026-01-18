# DAATAN - Development TODO

## 📋 Project Rules

### Git & PRs
- **Never merge to main without explicit user approval.** Always create a PR and ask for permission before merging.
- **Update documentation on every PR.** Ensure README, TODO.md, and relevant docs reflect the changes.

### Code Quality
- **Suggest unit tests for every feature**, even when not explicitly requested. Insist on tests for large features or when too many features accumulate without test coverage.
- **Write modular code.** Keep components, functions, and modules small and single-purpose.
- **Prefer mainstream, battle-tested solutions** over custom implementations, unless cost-prohibitive.

### Process
- **Validate every request against project vision.** Before implementing, check if it aligns with DAATAN_CORE.md and existing documentation.
- **Follow semantic versioning.** See VERSIONING.md for version bump rules.

---

## ✅ Completed

### Infrastructure
- [x] AWS EC2 instance (t3.small, eu-central-1)
- [x] Docker deployment (nginx, Next.js, PostgreSQL)
- [x] SSL certificate (Let's Encrypt, valid until April 2026)
- [x] Domain configured (daatan.com → Route 53 → EC2)
- [x] Terraform infrastructure as code
- [x] CI/CD pipeline (GitHub Actions → EC2)
- [x] Main branch protection

### Backend
- [x] Database schema (Prisma) - users, forecasts, options, votes
- [x] API routes for forecasts CRUD
- [x] API routes for voting
- [x] API route for resolution (admin only)
- [x] Brier score calculation logic
- [x] Zod validation schemas

### Authentication
- [x] NextAuth.js setup
- [x] Google OAuth provider configured
- [x] JWT session strategy
- [x] Environment variables on EC2

### Frontend
- [x] Responsive sidebar with mobile hamburger menu
- [x] Basic page structure (Feed, Notifications, Create, Leaderboard, Profile, Settings)
- [x] ForecastForm component (binary/multiple choice)
- [x] Sidebar navigation with Next.js Link components (SPA)
- [x] Clickable logo navigates to home
- [x] Active state highlighting for current route

### New Prediction System
- [x] Extended Prisma schema (NewsAnchor, Prediction, Commitment, CuTransaction)
- [x] Zod validation schemas for new prediction system
- [x] API routes: news-anchors, predictions CRUD
- [x] API routes: publish, commit, resolve predictions
- [x] PredictionWizard multi-step form UI
- [x] Nginx config: www.daatan.com → daatan.com redirect

---

## 🔄 In Progress

### Infrastructure (High Priority)
- [ ] **Build staging environment** (separate EC2 or branch-based preview)

### Database
- [ ] Run Prisma migrations on EC2 to create tables
  ```bash
  ssh -i ~/.ssh/daatan-key.pem ubuntu@52.59.160.186
  docker exec -it daatan-app npx prisma db push
  ```

### Authentication
- [x] Add Prisma adapter to NextAuth for user persistence ✅
- [ ] Create `/auth/signin` page with Google button
- [ ] Create `/auth/error` page for auth errors
- [ ] Add sign-in/sign-out buttons to UI

---

## ⏳ Pending

### Priority 1: Core Functionality

#### User Authentication UI
- [ ] Sign-in page with Google OAuth button
- [ ] User menu in sidebar (avatar, name, sign out)
- [ ] Protected routes (redirect to sign-in if not authenticated)
- [ ] Admin role management

#### Forecast Creation
- [ ] Connect ForecastForm to API
- [ ] Form validation feedback
- [ ] Success/error notifications
- [ ] Draft saving functionality

#### Forecast Feed
- [ ] Fetch and display forecasts from API
- [ ] Forecast card component
- [ ] Filter by status (active, resolved, my forecasts)
- [ ] Pagination / infinite scroll
- [ ] Search functionality

#### Voting UI
- [ ] Vote button on forecast cards
- [ ] Confidence slider for binary forecasts
- [ ] Option selector for multiple choice
- [ ] Show vote distribution (after voting)
- [ ] Edit/remove vote functionality

### Priority 2: Resolution & Scoring

#### Admin Resolution Panel
- [ ] Admin-only resolution page
- [ ] List of pending forecasts
- [ ] Resolution form (select correct option, add note)
- [ ] Confirmation dialog

#### Leaderboard
- [ ] Fetch users sorted by Brier score
- [ ] User ranking cards
- [ ] Filter by time period (all-time, monthly, weekly)
- [ ] Current user highlight

#### User Profile
- [ ] Display user stats (forecasts created, votes, Brier score)
- [ ] Prediction history
- [ ] Edit username/bio
- [ ] Public/private toggle

### Priority 3: Enhanced Features

#### Notifications
- [ ] New votes on your forecasts
- [ ] Forecast resolution notifications
- [ ] Challenge invitations
- [ ] Database table for notifications

#### Source Articles
- [ ] URL preview/unfurling
- [ ] Multiple source display
- [ ] Link validation

#### Social Features
- [ ] Share forecast links
- [ ] Challenge friends (invite to vote)
- [ ] Comments on forecasts
- [ ] Follow users

### Priority 4: Polish & Optimization

#### UI/UX
- [ ] Loading skeletons
- [ ] Error boundaries
- [ ] Toast notifications
- [ ] Animations (Framer Motion)
- [ ] Dark mode

#### Performance
- [ ] API response caching
- [ ] Image optimization
- [ ] Database indexes review
- [ ] Query optimization

#### SEO & Analytics
- [ ] Meta tags for forecasts
- [ ] Open Graph images
- [ ] Google Analytics
- [ ] Error tracking (Sentry)

---

## 🔧 Technical Debt

- [x] Add Prisma adapter back to NextAuth (removed for build compatibility) ✅
- [ ] Add proper error handling to all API routes
- [ ] Add rate limiting to API
- [ ] Add API tests
- [ ] Add E2E tests (Playwright)
- [x] Set up staging environment → moved to In Progress
- [ ] Database backups automation
- [ ] Log aggregation

---

## 📝 Documentation

- [ ] API documentation (OpenAPI/Swagger)
- [ ] Contributing guide
- [ ] Local development setup guide
- [ ] Deployment runbook

---

## 🚀 Quick Commands

### Deploy to Production
```bash
cd /home/mark/projects/daatan
rsync -avz --exclude 'node_modules' --exclude '.next' --exclude '.git' --exclude 'certbot' \
  -e "ssh -i ~/.ssh/daatan-key.pem" . ubuntu@52.59.160.186:~/app/
ssh -i ~/.ssh/daatan-key.pem ubuntu@52.59.160.186 \
  "cd ~/app && docker compose -f docker-compose.prod.yml up -d --build"
```

### View Logs
```bash
ssh -i ~/.ssh/daatan-key.pem ubuntu@52.59.160.186 "docker logs daatan-app --tail 100"
```

### Run Database Migrations
```bash
ssh -i ~/.ssh/daatan-key.pem ubuntu@52.59.160.186 \
  "docker exec -it daatan-app npx prisma db push"
```

### Check Health
```bash
curl https://daatan.com/api/health
```

---

## 📅 Suggested Sprint Plan

### Sprint 1 (Week 1-2): Authentication & Basic Feed
- Run database migrations
- Add Prisma adapter to NextAuth
- Create sign-in page
- Display forecast feed
- Basic forecast card component

### Sprint 2 (Week 3-4): Forecast Creation & Voting
- Connect forecast form to API
- Voting UI
- Vote distribution display
- User menu in sidebar

### Sprint 3 (Week 5-6): Resolution & Leaderboard
- Admin resolution panel
- Leaderboard page
- User profile page
- Notifications (basic)

### Sprint 4 (Week 7-8): Polish & Launch
- UI polish and animations
- Error handling
- Performance optimization
- Documentation
- Beta launch 🚀

