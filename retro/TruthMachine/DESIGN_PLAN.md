# Daatan Implementation Plan: The Israel Forensic Matrix (2021–2026)

This document details the technical and financial roadmap for Daatan, a reputation ledger designed to audit five years of Israeli and international media foresight.

---

## 1. Infrastructure Setup (AWS)

To maintain a lean operation, the system utilizes ARM-based Graviton instances and high-performance vector storage.

- **Compute Instance:** AWS EC2 t4g.small (2 vCPUs, 2 GiB RAM)
  - _Reasoning:_ The t4g.small is free-tier eligible until December 31, 2026. It provides a 40% better price-performance ratio over T3 instances for Linux-based LLM orchestration.

- **Database:** PostgreSQL 16+ with pgvector and TimescaleDB extensions
  - **pgvector:** Efficiently stores multidimensional prediction vectors (Stance, Sentiment, Certainty) alongside 1536-dimensional semantic embeddings for clustering.
  - **TimescaleDB:** Uses "hypertables" to partition the five years of news data by time, ensuring fast lookups for "retro-analysis" queries.

- **Orchestration:** OpenClaw (or a custom "Nano Claw") managing asynchronous API calls to news aggregators, Polymarket, and OpenRouter.

---

## 2. Media & Event Selection Strategy

The system will build a **100×100 Matrix** cross-referencing 100 media entities against 100 "Defining Events."

### Source List

- **Israeli Mainstream:** Ynet, Haaretz, N12 (Mako), Israel Hayom, Globes, Kan 11
- **Israeli Independent/Bloggers:** Abu Ali Express (Telegram), Amit Segal (Telegram), Uri Kurlianchik (Substack), The Seventh Eye
- **International (Top 10):** Reuters, Bloomberg, BBC News, CNN, Al Jazeera, The New York Times, Financial Times, Wall Street Journal, The Economist, AP

### Ingestion Logic: Event-Centric Discovery

**Decision:** We will use Event-Centric Discovery to save tokens. Reading every article from 5 years of Hebrew media would cost >$15,000. Instead:

1. **Seed List:** Identify 100 major events (e.g., Oct 7 War, 2023 Judicial Reform, 2024 Moody's Credit Downgrade).
2. **Targeted Query:** Use APIs to pull articles mentioning these seeds.
   - **Perigon:** For enriched, high-volume real-time and historical news.
   - **Event Registry:** For deep archival data dating back to 2014.

---

## 3. LLM Pipeline & Prompt Strategy

To minimize costs, we use a **Two-Stage Filtering Pipeline** on OpenRouter.

### Stage 1: The Gatekeeper (Filter)

- **Model:** Nemotron 3 Nano (Free/Ultra-low cost)
- **Prompt:**
  > "Analyze this news snippet from `<source>`. Does the author make a directional prediction or forward-looking statement? Skip situational updates (e.g., 'Rockets fired'). Return JSON: `{'is_prediction': boolean, 'reason': string}`."

### Stage 2: Forensic Extraction

- **Model:** DeepSeek V3.2 ($0.25 per 1M input tokens)
- **Prompt:**
  > "Extract forensic metrics from this forecast regarding `[Event_Name]`:
  >
  > - **Stance:** Directional outlook (-1.0 for bearish/negative, 1.0 for bullish/positive).
  > - **Sentiment:** Emotional tone (0.0 to 1.0).
  > - **Certainty:** Linguistic sureness (0.0 to 1.0).
  >
  > Output JSON only."

---

## 4. Polymarket Integration

For every article extracted, the system polls the Polymarket Gamma API for the market probability at the time of publication.

- **Endpoint:** `GET https://gamma-api.polymarket.com/events` filtered by keywords
- **Logic:** If a matching market exists (e.g., "Will Israel strike Iran by Jan 31?"), fetch `outcomePrices`.
- **Data Storage:** Articles are saved with a `polymarket_prob` column to benchmark media sentiment against financial "skin-in-the-game" data.

---

## 5. Scoring & Machine Learning

### Mathematical Scoring (Brier Score)

We calculate the **Brier Skill Score** for every journalist to rank their reputation against a baseline.

```
BS = (1/N) * Σ(f_t - o_t)²
```

Where:
- `f_t` = probability derived from the LLM-extracted Stance and Certainty
- `o_t` = binary ground truth (1 for occurred, 0 for not)

### Teaching the Machine

- **Technique:** Supervised Fine-Tuning (SFT) is preferred over DPO.
- **Reasoning:** SFT yields better-calibrated confidence through maximum-likelihood estimation, whereas DPO can induce overconfidence via reward exploitation — detrimental to a "TruthMachine".

---

## 6. Price & Time Estimation

### Monthly/Build Cost (100 Events / 50k Scanned Articles)

| Component | Provider/Tier | Estimated Cost |
|---|---|---|
| News Ingestion | Perigon (Plus) or Event Registry (5K) | $90 – $550 |
| LLM Inference | OpenRouter (Blended) | ~$25 |
| AWS Hosting | t4g.small (Free Tier/Credits) | $0 |
| **Total Build** | | **$115 – $575** |

### Time Estimation

| Phase | Duration |
|---|---|
| Infra & API Polling Setup | 10 days |
| 100 Event Ground Truth Seeding | 3 days |
| Matrix Filling (Parallel Extraction) | 14 days |
| Scoring & Validation | 7 days |
| **Total MVP Timeline** | **~4.5 weeks** |

---

## 7. Trade-offs & Recommendations

- **Trade-off (Hebrew Accuracy):** Cheap models struggle with Hebrew nuance.
  - **Recommendation:** Use Perigon's English translations for extraction to ensure consistent Stance/Sentiment scoring.

- **Trade-off (Data Redundancy):** Bloggers like Abu Ali Express post ~25 times/day, but mostly republish wire news.
  - **Recommendation:** Use Perigon's "story clustering" to deduplicate articles before the LLM stage.

- **Legal Recommendation:** To bypass "Investment Adviser" registration, position Daatan as a "bona fide" newspaper providing impersonal historical audits rather than "buy/sell" signals.
