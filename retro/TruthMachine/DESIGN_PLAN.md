# Daatan Implementation Plan: The Israel Forensic Matrix (2021–2026)

> **Working name:** TruthMachine | **Status:** MVP Design | **Last updated:** 2026-03-17

This document details the technical and financial roadmap for TruthMachine — a **B2B oracle SaaS** that audits media foresight accuracy, ranks journalists and outlets by predictive precision, and generates probability estimates for future geopolitical and economic events.

---

## 0. Product Vision

TruthMachine has two distinct outputs:

1. **Oracle API** — probability estimates for future events (e.g., `"Chances of Netanyahu winning elections: 0.76"`), sold as a B2B API to corporate clients, hedge funds, Polymarket bettors, and government agencies.
2. **Media Reputation Rankings** — journalist and outlet accuracy scores (Brier Score, custom ELO variant), publicly visible as a freemium transparency tool; raw data and API access behind a paywall.

**Israel 2021–2026 is the proof of concept.** The long-term goal is to expand to other regions and time periods. Historical data ideally goes back to 2005 or earlier — sparse early coverage is acceptable; more data improves the model over time.

---

## 1. Infrastructure Setup (AWS)

### MVP (20–30 sources × 100 events)

- **Compute:** AWS EC2 t4g.small (2 vCPUs, 2 GiB RAM) — free-tier eligible until December 31, 2026; 40% better price-performance than T3 for Linux LLM workloads.
- **Database:** PostgreSQL 16+ with `pgvector` and `TimescaleDB` extensions.
  - `pgvector`: Stores prediction vectors (Stance, Sentiment, Certainty, + future dimensions) and 1536-dim semantic embeddings.
  - `TimescaleDB`: Hypertables for time-partitioned article/event data, enabling fast retro-analysis queries.
- **Orchestration:** OpenClaw or a custom lightweight worker (TBD — to be revisited during build phase).

### Scale Path
Single Postgres instance is sufficient for MVP. Read replicas and/or a dedicated vector DB (Qdrant/Pinecone) to be added when client load and dataset size demand it.

---

## 2. Media & Event Selection Strategy

### MVP Source List (20–30 sources)

**Israeli Mainstream:** Ynet, Haaretz, N12 (Mako), Israel Hayom, Globes, Kan 11

**Israeli Independent/Bloggers:** Abu Ali Express (Telegram — Phase 2), Amit Segal (Telegram — Phase 2), Uri Kurlianchik (Substack), The Seventh Eye

**International (Top 10):** Reuters, Bloomberg, BBC News, CNN, Al Jazeera, The New York Times, Financial Times, Wall Street Journal, The Economist, AP

> **Phase 2 additions:** Telegram channels, video/audio (Kan 11 segments, podcasts). Text-only for MVP.

### Event Seed List (~100 Defining Events)

**Process:** LLM generates 150–200 candidate events → manual editorial approval → final list of ~100.

Coverage spans: Oct 7 War, 2023 Judicial Reform, 2024 Moody's credit downgrade, Israeli election cycles, regional geopolitical shifts, economic indicators, and global events (COVID, Ukraine, etc.).

**Temporal scope:** MVP covers 2021–2026. Long-term target: 2005+. Pre-2015 data will be sparse — this is acceptable.

### Ingestion Logic: Event-Centric Discovery

Reading all articles from 5 years of Hebrew media would cost >$15,000. Instead:

1. Identify ~100 seed events.
2. Pull articles mentioning these seeds via API.
   - **Perigon:** Enriched real-time and historical news (Hebrew coverage to be validated before commit).
   - **Event Registry:** Deep archival data back to 2014.

> ⚠️ **Validation needed:** Hebrew-language coverage quality of both APIs must be tested before selecting as primary ingestion layer.

---

## 3. Data Model: Predictions

Each extracted prediction is stored as an independent unit (not per-article). A single article may contain multiple predictions — each is scored separately.

### Extracted Fields (per prediction)

| Field | Type | Description |
|---|---|---|
| `stance` | float (-1.0 to 1.0) | Directional outlook (bearish → bullish) |
| `sentiment` | float (0.0 to 1.0) | Emotional tone |
| `certainty` | float (0.0 to 1.0) | Linguistic sureness |
| `specificity` | float (0.0 to 1.0) | How precise/concrete the prediction is |
| `timing_accuracy` | float | Did prediction specify timing? How accurate? |
| *(more TBD)* | | Additional forensic dimensions to be added |

> **Note:** These intermediate metrics are internal — clients never see them. They feed the model that produces oracle probabilities.

### Vague Predictions
Vague predictions are **not discarded** — they receive low `specificity` and `certainty` scores and carry less weight in the model, but remain in the dataset.

---

## 4. Ground Truth

Ground truth is the **historical event outcome** — did the predicted event occur or not?

- **Method:** LLM-based judgment, reading the historical record (post-event publications, Wikipedia, news summaries).
- **Format:** Binary (occurred / did not occur) or graded for partial outcomes.
- **Examples:** "Putin invaded Ukraine ✓", "Khamenei died ✗ (as of 2024)", "Trump attacked Venezuela ✓/✗", election results, oil price thresholds.

> **Polymarket is NOT ground truth.** It is an auxiliary signal — the `polymarket_prob` column benchmarks media sentiment against "skin-in-the-game" financial data where markets exist. Many Israeli events will have no Polymarket market; `NULL` is acceptable.

---

## 5. LLM Pipeline & Prompt Strategy

Two-stage filtering pipeline on OpenRouter to minimize cost.

### Stage 1: The Gatekeeper (Filter)

- **Model:** Nemotron 3 Nano (free / ultra-low cost)
- **Task:** Detect whether a snippet contains a forward-looking prediction.
- **Output:** `{"is_prediction": boolean, "reason": string}`

### Stage 2: Forensic Extraction

- **Model:** DeepSeek V3.2 ($0.25/1M input tokens)
- **Task:** Extract structured prediction metrics.
- **Output:** JSON with Stance, Sentiment, Certainty, Specificity, and timing fields.

> **Hebrew note:** DeepSeek V3 handles Hebrew adequately. Using Perigon's English translations may introduce translation bias. Evaluate per-source during testing.

---

## 6. Scoring & Reputation System

### Journalist Score vs. Outlet Score
Two **independent** reputation tracks:
- **Journalist score** — follows the person across outlets.
- **Outlet score** — reflects the publication's aggregate accuracy.
- Both scored **per domain** (e.g., Middle East, Economics, Security, etc.) — domain specialization emerges naturally from what each journalist writes about.

### Scoring Methods

**Brier Score** — primary calibration metric:
```
BS = (1/N) * Σ(f_t - o_t)²
```
Where `f_t` = derived probability (from Stance × Certainty), `o_t` = binary ground truth.

**Custom ELO variant** — zero-sum competition: journalists who predicted the same event compete; correct predictors gain points from incorrect ones. Exact formula TBD.

### Cold Start Problem
New journalists with no track record: **open problem, deferred.** Likely solution: default to outlet average score as prior.

---

## 7. Oracle Model

The oracle generates forward-looking probability estimates by:

1. Aggregating journalist predictions on a given topic, **weighted by their reputation score**.
2. Applying ML model trained on historical prediction → outcome pairs.
3. Model architecture (regression, neural net, LLM fine-tune) to be determined once sufficient labeled data exists.

**Update frequency:** Batch retraining for MVP. Real-time updates (per new publication or major event) as a later milestone.

**No external signal dependency** — oracle is purely derived from ingested publications + reputation scores + historical ML training. No Polymarket, no economic indicators fed directly into oracle output.

---

## 8. API Design (Product)

The API is the product. Primary query types:

1. **Event probability** — `"What is the probability of X happening?"` *(primary)*
2. **Journalist reputation** — score, domain breakdown, historical accuracy
3. **Outlet reputation** — same as above at outlet level

**Auth & billing:** Deferred. MVP may be open to all users or internal-only for the first phase to validate the model.

---

## 9. Cost & Time Estimation

### Build Cost (MVP: 20–30 sources × 100 events)

| Component | Provider | Estimated Cost |
|---|---|---|
| News Ingestion | Perigon (Plus) or Event Registry | $90 – $550/mo |
| LLM Inference | OpenRouter (blended) | ~$25 |
| AWS Hosting | t4g.small (free tier) | $0 |
| **Total** | | **$115 – $575** |

### Timeline

| Phase | Duration |
|---|---|
| Infra & API polling setup | 10 days |
| 100-event ground truth seeding | 3 days |
| Matrix filling (parallel extraction) | 14 days |
| Scoring & validation | 7 days |
| **Total MVP** | **~4.5 weeks** |

---

## 10. Open Problems & Deferred Decisions

| # | Problem | Status |
|---|---|---|
| 1 | Perigon/Event Registry Hebrew coverage quality | ⚠️ Needs validation |
| 2 | Oracle ML model architecture | Deferred — needs labeled data first |
| 3 | Exact ELO formula for zero-sum journalist scoring | Deferred |
| 4 | Cold start for new journalists | Deferred — likely outlet average as prior |
| 5 | Telegram/video ingestion | Phase 2 |
| 6 | Journalist identity merging across platforms | Deferred to Phase 2 |
| 7 | API auth & billing | Deferred — open/internal for first phase |
| 8 | Commercial branding (TruthMachine is working name) | TBD |
| 9 | **Legal review** — Investment Adviser registration risk | ⚠️ Must resolve before commercial launch |
| 10 | Orchestration layer (OpenClaw vs custom) | TBD during build |

---

## 11. Trade-offs & Recommendations

- **Hebrew accuracy:** DeepSeek V3 handles Hebrew well. Test before defaulting to English translations, which may introduce bias.
- **Data redundancy:** Bloggers (e.g., Abu Ali Express) post ~25×/day, mostly wire republishing. Use Perigon's story clustering to deduplicate before LLM stage.
- **Legal:** Positioning as a "bona fide newspaper" to avoid Investment Adviser registration is a theoretical defense — **not solid protection** for a B2B oracle. Legal counsel required before onboarding paying clients.

---

*Agents: Work through open tasks in priority order. Notify via Telegram when ready for review.*
