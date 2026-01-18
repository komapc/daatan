# DAATAN - Development TODO

> Reference: [DAATAN_CORE.md](./DAATAN_CORE.md) | [GLOSSARY.md](./GLOSSARY.md) | [FORECASTS_FLOW.md](./FORECASTS_FLOW.md)

## 📋 Project Rules

### Source of Truth
Every feature, phrasing, or new idea must align with [DAATAN_CORE.md](./DAATAN_CORE.md).

### AI Collaboration Guidelines
When working with AI assistants:
- **Ask first:** "Does this align with the Source of Truth document?"
- **No hidden assumptions:** Always state assumptions explicitly
- **Accountability over engagement:** If there's tension between the two, accountability wins
- **Ask when uncertain:** Don't proceed if something is unclear
- **Flag conflicts:** If something contradicts DAATAN_CORE.md, raise it immediately

### Git & PRs
- **Never merge to main without explicit user approval.** Always create a PR and ask for permission.
- **Update documentation on every PR.** Ensure README, TODO.md, and relevant docs reflect changes.

### Code Quality
- **Suggest unit tests for every feature**, even when not requested.
- **Write modular code.** Small, single-purpose components and functions.
- **Prefer mainstream solutions** over custom implementations.

### Feature Fit Framework
Every feature must pass all checks:
1. Does it support long-term accuracy measurement?
2. Does it preserve or build track record?
3. Does it avoid financial incentives?
4. Does it serve measurement over engagement?
5. Is authority earned, not bought?

**If any check fails → out of scope.**

### Out of Scope (Never Implement)
- ❌ Real-money trading or cash-out
- ❌ Buying/selling reputation
- ❌ Momentary leaderboards without cumulative meaning
- ❌ Conspiracy/provocative content for engagement
- ❌ Bots or algorithmic trading features
- ❌ Any feature that prioritizes charisma over results

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

### Priority 1: Core Functionality (MVP Phase 1)

#### User Authentication UI
- [ ] Sign-in page with Google OAuth button
- [ ] User menu in sidebar (avatar, name, sign out)
- [ ] Protected routes (redirect to sign-in if not authenticated)
- [ ] Admin role management
- [ ] Pseudonymous account support with feature limits

#### Prediction Creation (One-Click Flow)
- [ ] LLM-assisted phrasing for predictions
- [ ] Default resolution date auto-suggestion
- [ ] Confidence slider (50%–100%)
- [ ] Connect ForecastForm to API
- [ ] Form validation feedback
- [ ] Success/error notifications
- [ ] Draft saving functionality

#### Internal Coin Economy
- [ ] Coin balance display in UI
- [ ] Starter balance for new users
- [ ] Engagement rewards (streaks, accuracy bonuses)
- [ ] Transaction history

#### Prediction Feed
- [ ] Fetch and display forecasts from API
- [ ] Prediction card component
- [ ] Filter by status (active, resolved, my predictions)
- [ ] **Resolved Bets section** — highlight resolved predictions prominently
- [ ] Pagination / infinite scroll
- [ ] Search functionality
- [ ] Trending topics display

#### Voting UI
- [ ] Vote button on prediction cards
- [ ] Confidence slider for binary predictions
- [ ] Option selector for multiple choice
- [ ] Show vote distribution (after voting)
- [ ] Edit/remove vote functionality

### Priority 2: Social & Challenge Features

#### Invite to Bet
- [ ] "Invite Friend" button on predictions
- [ ] Email/link invitation flow
- [ ] Pending invitation notifications
- [ ] Accept/decline invitation UI

#### Challenge Mechanics
- [ ] "Challenge an Expert" flow
- [ ] "Beat my record" shareable links
- [ ] Challenge leaderboards
- [ ] Challenge history on profile

#### Friend & Community
- [ ] Friend leaderboards
- [ ] Private leagues creation/management
- [ ] Topical communities (elections, sports, geopolitics)
- [ ] Follow users

### Priority 3: Resolution & Scoring

#### Admin Resolution Panel
- [ ] Admin-only resolution page
- [ ] List of pending predictions (by resolution date)
- [ ] Resolution form (select correct option, add note)
- [ ] Confirmation dialog

#### AI Adjudication Pipeline
- [ ] News API integration (Perplexity/Exa/similar)
- [ ] Keyword extraction from predictions
- [ ] LLM analysis of top sources
- [ ] Confidence threshold for auto-resolution
- [ ] Escalation to human review queue
- [ ] Audit trail for disputes

#### Leaderboard
- [ ] Fetch users sorted by Brier score
- [ ] User ranking cards
- [ ] Filter by time period (all-time, monthly, weekly)
- [ ] **Topic leaderboards** (e.g., "Top Middle East Predictor")
- [ ] Current user highlight
- [ ] Calibration score display (Brier/log loss)

#### User Profile
- [ ] Display user stats (predictions created, votes, Brier score)
- [ ] Prediction history with outcomes
- [ ] Edit username/bio
- [ ] Public/private toggle
- [ ] **Badges system** (e.g., "Top Middle East Predictor")
- [ ] Verified expert badge (manual review)
- [ ] Historical accuracy metrics

### Priority 4: Embeddable Widget (MVP Phase 2)

#### Widget Core
- [ ] Embeddable JS snippet generator
- [ ] Customizable styling (colors, fonts)
- [ ] Iframe vs. script injection approach
- [ ] Widget SDK documentation

#### Widget Features
- [ ] Inline prediction suggestions tied to article content
- [ ] Quick-create prediction flow
- [ ] Contextual leaderboards
- [ ] Mini user profile display
- [ ] Sign-up/sign-in within widget

#### Publisher Integration
- [ ] Publisher dashboard
- [ ] Widget analytics (views, conversions)
- [ ] Publisher API keys management
- [ ] Pilot with 1–3 publishers/bloggers

### Priority 5: Social Sharing & Virality

#### Sharing Cards
- [ ] Shareable prediction card images (OG images)
- [ ] Link back to profile and source article
- [ ] Twitter/X share integration
- [ ] Facebook share integration
- [ ] LinkedIn share integration

#### Viral Mechanics
- [ ] "Beat the expert" challenge links
- [ ] Trending-topic leaderboards
- [ ] Share-to-signup tracking
- [ ] Embeds-driven signup attribution

### Priority 6: Engagement & Retention

#### Streaks & Gamification
- [ ] Daily reading/prediction streaks
- [ ] Streak counter in UI
- [ ] Streak rewards (coins, badges)
- [ ] Topical tournaments

#### Notifications
- [ ] New votes on your predictions
- [ ] Prediction resolution notifications
- [ ] Challenge invitations
- [ ] Breaking news prompts (push/email)
- [ ] Database table for notifications

### Priority 7: Polish & Optimization

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
- [ ] Meta tags for predictions
- [ ] Open Graph images for predictions
- [ ] Google Analytics
- [ ] Error tracking (Sentry)

#### Content Moderation
- [ ] Basic fraud detection workflows
- [ ] Safety guidelines enforcement
- [ ] Sensitive topics human review queue
- [ ] Report prediction functionality

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
- [ ] Widget integration guide for publishers
- [ ] Influencer onboarding guide

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

## 📅 MVP 90-Day Plan

### Phase 1: Core Web App (Weeks 1–4)
- Run database migrations
- Complete authentication UI
- LLM-assisted one-click prediction creation
- Coin economy basics
- Personal leaderboards
- Basic profile with accuracy stats
- Resolved Bets section

### Phase 2: Widget & Sharing (Weeks 5–8)
- Embeddable widget (customizable styling, JS snippet)
- Quick-create flow in widget
- Sharing cards with OG images
- Social platform integrations
- Invite to bet functionality

### Phase 3: Adjudication & Pilot (Weeks 9–12)
- AI evidence-sourcing pipeline
- Simple human adjudication UI
- Launch pilot with 1–3 publisher/influencer partners
- Instrument key metrics and iterate
- Gather feedback, iterate

---

## 📊 Success Metrics (Track from Pilot)

| Metric | Description | Target |
| ------ | ----------- | ------ |
| **Activation** | % of article viewers who create a prediction | 2–5% |
| **Retention** | 7/30-day DAU/MAU for active predictors | TBD |
| **Engagement** | Average predictions per active user per week | TBD |
| **Virality** | Share-to-signup conversion rate | TBD |
| **Quality** | Average user calibration score (Brier) | Lower = better |
| **Adjudication** | % resolved without dispute | >95% |
