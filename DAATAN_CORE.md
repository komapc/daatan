# DAATAN Core

## 1. Vision & Identity

**Name:** DAATAN (Hebrew/Arabic root for "Knowledge/Data-driven")

**Slogan:** "Prove you were right — without shouting into the void."

**Core Mission:** Transform passive news consumption into a verifiable, gamified track record of prediction accuracy.

### The DAATAN Philosophy

- **Accountability:** "Следить за базаром." No deleted takes. Every prediction becomes a permanent part of your digital legacy.
- **Interactivity over Doomscrolling:** Shift users from passive readers to active forecasters.

### Three Pillars of Content

1. **Facts** — Unbiased gist of the news
2. **Analytics** — Expert breakdown
3. **Opinions** — Personal takes (the fuel for predictions)

---

## 2. Technical Stack

| Layer | Technology |
| ----- | ---------- |
| Frontend | Next.js 15 (React 19, App Router) |
| Styling | Tailwind CSS |
| Backend | Next.js API Routes |
| Database | PostgreSQL 16 |
| Hosting | AWS EC2 (eu-central-1) |
| SSL | Let's Encrypt (auto-renewed) |
| Reverse Proxy | Nginx |

**Live URL:** https://daatan.com

---

## 3. Product Features & Logic

### A. The Prediction Engine ("The Hunch")

- **LLM-Assisted Phrasing:** System suggests binary (Yes/No) outcomes from news text
- **Confidence Slider:** Users select probability (50%–100%)
- **Scoring:** Brier Score for calibration measurement

$$B = \frac{1}{N} \sum_{t=1}^{N} (f_t - o_t)^2$$

> Where \(f_t\) = forecast probability, \(o_t\) = actual outcome (0 or 1)

### B. The Social & Authority Layer

- **Resolved Bets Hub:** Primary destination for "Who was right?"
- **Identity:** Persistent pseudonymous accounts — no real name required, but real history matters
- **Challenges:** "Invite a Friend" or "Challenge an Expert" to specific bets

### C. The Widget (Distribution Hook)

- Embeddable JS snippet for external bloggers/publishers
- Captures high-intent users directly on the news page

---

## 4. Automated Adjudication Logic

To minimize manual overhead, DAATAN uses an **AI Evidence Pipeline:**

| Stage | Process |
| ----- | ------- |
| **Collection** | On resolution date, query news APIs (Perplexity/Exa) for keywords |
| **Processing** | LLM analyzes top 5 sources |
| **Verdict** | Success/Failure with high confidence |
| **Escalation** | Contradictory sources → "Human Review" queue |

---

## 5. Current UI

The application features a responsive design:

| Screen Size | Behavior |
| ----------- | -------- |
| Mobile (< 1024px) | Hamburger menu, collapsible sidebar |
| Desktop (≥ 1024px) | Fixed sidebar always visible |

**Pages:**
- Feed — Prediction feed (home)
- Notifications — User notifications
- Create Bet — Create new predictions
- Leaderboard — Top predictors
- Profile — User profile
- Settings — User settings

---

## 6. Implementation Roadmap

| Phase | Status | Milestone |
| ----- | ------ | --------- |
| **1** | ✅ | Infrastructure setup (AWS, Terraform, Docker) |
| **2** | ✅ | Core UI skeleton with responsive design |
| **3** | 🔄 | Database schema for users, bets, outcomes |
| **4** | ⏳ | Auth system (login/registration) |
| **5** | ⏳ | Prediction creation and display |
| **6** | ⏳ | AI Resolution Engine integration |

---

## 7. Development Guidelines

### Naming Conventions

- **JavaScript/TypeScript:** `camelCase`
- **PostgreSQL:** `snake_case`
- **React Components:** `PascalCase`
- **CSS Classes:** Tailwind utility classes

### Architecture Principles

- **Modularity:** Keep "Scoring Logic" separate from "UI Components" for testability
- **Security:** Manage API keys and secrets via `.env` — never hardcode credentials
- **Mobile-First:** Design for mobile screens, enhance for desktop

### Git Workflow

- **Main branch is protected** — all changes require a Pull Request
- Create feature branches: `feature/description`
- Never push directly to `main`
