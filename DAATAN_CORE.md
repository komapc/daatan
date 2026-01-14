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

## 2. Technical Migration Strategy (Base44 → Manual)

**Goal:** Migrate from the managed Base44 infrastructure to a scalable, developer-owned stack.

| Layer | Technology |
| ----- | ---------- |
| Frontend | React / Next.js (SEO + fast rendering) |
| Backend | Node.js / Supabase (Auth + PostgreSQL) |
| AI Orchestration | Cursor/Claude for codegen; Gemini Pro/Claude API for LLM features |
| Hosting | AWS (EC2/Amplify) + GitHub Actions CI/CD |

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

## 5. Implementation Roadmap (90 Days)

| Phase | Milestone | Tasks |
| ----- | --------- | ----- |
| **1** | Database Schema | Define `users`, `bets`, `outcomes`, `reputation` tables in SQL |
| **2** | Core UI | Build "Prediction Card" component and "News Feed" |
| **3** | Logic Layer | Implement Brier score math + Auth migration from Base44 |
| **4** | AI Integration | Connect "Resolution Engine" to search APIs |

---

## 6. Development Guidelines

### Naming Conventions

- **JavaScript/TypeScript:** `camelCase`
- **PostgreSQL:** `snake_case`

### Architecture Principles

- **Modularity:** Keep "Scoring Logic" separate from "UI Components" for testability
- **Security:** Manage API keys and secrets via `.env` — never hardcode credentials
