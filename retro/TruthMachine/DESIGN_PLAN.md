# TruthMachine: Design Plan & Implementation Roadmap

> **Working name:** TruthMachine | **Status:** MVP Design v3 | **Last updated:** 2026-03-17

---

## 0. Product Vision

TruthMachine is a **B2B oracle SaaS** built on a retroactive media accuracy audit. It has two distinct outputs:

1. **Oracle API** — probability estimates for future events (e.g., `"Chances of Netanyahu winning elections: 0.76"`), sold via API to corporate clients, hedge funds, Polymarket traders, and government agencies.
2. **Media Reputation Rankings** — journalist and outlet accuracy scores (Brier Score, custom ELO variant). Free tier shows public leaderboard; paid tier gives raw data and full API access.

### Scoring Universe
All sources compete on the **same leaderboard** regardless of type: media outlets, wire services, financial institutions (Goldman Sachs, J.P. Morgan), think tanks (CSIS, Quincy Institute), bloggers, and independent analysts. Leveling the playing field is a core product differentiator.

### Proof of Concept
**Israel 2021–2026** is the first dataset. The long-term goal is to expand to other regions and time periods. Historical data ideally goes back to 2005 or earlier — sparse early coverage is acceptable and improves over time.

### Relation to Daatan
TruthMachine is a **fully separate product** — separate repo, separate DB, separate deployment. Future integration with Daatan Forecast (e.g., sharing reputation scores via API) is deferred.

---

## 1. Repository & Infrastructure

### Repository
- **Separate repo** from Daatan (e.g., `daatan-truthmachine`)
- Daatan's `retro/prototype/` stays in the Daatan repo as a UI reference/demo
- TruthMachine repo contains: Python pipeline, data files, documentation

### Storage Strategy
**Phase 1 (MVP) — Filesystem JSON:**
```
data/
  events/          # one JSON per event (ground truth, metadata)
  sources/         # one JSON per source (metadata, scores)
  matrix/          # one JSON per event+source pair (extracted predictions)
  pages/           # auto-generated per-event page data (consumed by UI)
```
~125 events × 25 sources = ~3,000 matrix files. Manageable, git-trackable, human-readable.

**Phase 2 — PostgreSQL** with `pgvector` + `TimescaleDB`, once the pipeline is proven to work. The JSON schema from Phase 1 maps directly to DB schema.

### Compute (AWS)
- **EC2 t4g.small** (2 vCPUs, 2 GiB RAM) — free-tier eligible until December 31, 2026
- Single Postgres instance sufficient for MVP; read replicas / dedicated vector DB added when needed

---

## 2. Source List

**25 sources total: 15 Israeli + 6 international + Polymarket (auxiliary data)**

See `sources.json` for the machine-readable list and `SOURCES.md` for selection criteria.

### Israeli Sources (15) — web only for MVP
Ynet, Haaretz, N12 (Mako), Israel Hayom, Globes, Kan 11, The Marker, Walla News, Maariv, Jerusalem Post, Times of Israel, Calcalist, Channel 13 News, Channel 14 (Now 14), Uri Kurlianchik (Substack)

### International Sources (6)
BBC News, Al Jazeera, CNN, Reuters, Bloomberg, Wall Street Journal

### Auxiliary
Polymarket — not a source, but `polymarket_prob` stored per prediction where a matching market exists. `NULL` when no market exists (expected for ~70% of Israeli events).

### Phase 2 Additions
Telegram channels (Abu Ali Express, Amit Segal), video/audio (Kan 11 segments, podcasts).

### Byline Handling
Store journalist byline when available. Score at outlet level only when byline is absent (wire services, unsigned editorials).

---

## 3. Event Seed List

**125 concrete binary events across 9 domains.** See `EVENTS.md` for the full list.

| Domain | Count |
|---|---|
| A — Israeli Politics & Elections | 25 |
| B — October 7 & Gaza War | 22 |
| C — Iran & Regional | 23 |
| D — Israeli Economy | 15 |
| E — Global Events | 10 |
| F — Israeli Society | 5 |
| G — Technology & AI | 10 |
| H — Israeli Tech & Cyber | 10 |
| I — Energy & Climate | 5 |

**Event selection criteria:**
- Massively covered after it occurred by multiple sources
- Considered a major event
- Concrete and binary (e.g., "Did law X pass the Knesset?" not "Did the judicial reform succeed?")
- High-coverage events decomposed into multiple sub-questions (first reading, second reading, final vote, court ruling)

**Temporal scope:** MVP covers 2021–2026. Long-term target: 2005+. Sparse early coverage is acceptable.

---

## 4. Data Model: Predictions

Each extracted prediction is stored as an **independent unit** — one article may produce multiple predictions, each scored separately.

### Fields per prediction

| Field | Type | Description |
|---|---|---|
| `event_id` | string | Reference to seed event |
| `source_id` | string | Reference to source |
| `journalist` | string \| null | Byline if available |
| `article_url` | string | Source article |
| `article_date` | date | Publication date |
| `headline` | string | Article headline |
| `quote` | string \| null | Relevant extracted quote |
| `stance` | float (-1.0 to 1.0) | Directional outlook |
| `sentiment` | float (0.0 to 1.0) | Emotional tone |
| `certainty` | float (0.0 to 1.0) | Linguistic sureness |
| `specificity` | float (0.0 to 1.0) | How concrete the prediction is |
| `timing_stated` | bool | Did prediction specify a timeframe? |
| `polymarket_prob` | float \| null | Market probability at publication date |
| *(more TBD)* | | Additional forensic dimensions |

> These intermediate metrics are **internal only** — clients never see them. They feed the model that produces oracle probabilities.

### Vague predictions
Not discarded — assigned low `specificity` and `certainty`, carry less weight in the model, but remain in the dataset.

---

## 5. LLM Pipeline & Prompt Strategy

Two-stage filtering pipeline via OpenRouter to minimize cost.

### Stage 1: The Gatekeeper
- **Model:** Nemotron 3 Nano (free / ultra-low cost)
- **Task:** Does this snippet contain a forward-looking prediction?
- **Output:** `{"is_prediction": boolean, "reason": string}`

### Stage 2: Forensic Extraction
- **Model:** DeepSeek V3.2 ($0.25/1M input tokens)
- **Task:** Extract structured prediction metrics into Pydantic schema (via `instructor`)
- **Output:** Full prediction JSON

### Hebrew handling
DeepSeek V3 handles Hebrew adequately. Do **not** default to English translations — Perigon's translations may shift nuance. Evaluate per-source during testing.

---

## 6. Python Pipeline Stack

The pipeline is a **standalone Python service** in the TruthMachine repo.

| Layer | Tool | Reason |
|---|---|---|
| HTTP fetching | `httpx` + `asyncio` | Async parallel article fetching |
| LLM calls | `litellm` | Unified interface to OpenRouter/any model |
| Structured extraction | `instructor` | Forces LLM output into Pydantic schemas |
| Data validation | `Pydantic v2` | Schema enforcement throughout |
| Database (Phase 2) | `SQLAlchemy` async + `asyncpg` | Async Postgres |
| Scheduling | `APScheduler` | Simple cron-like scheduling, no Redis needed |
| Package manager | `uv` | Fast, modern |
| Testing | `pytest` + `pytest-asyncio` | Standard |

**Folder:** `pipeline/` in the TruthMachine repo (not inside Daatan).

---

## 7. Output: Per-Event Pages

The pipeline **automatically generates** a per-event page data file in `data/pages/` for every event. The Next.js UI renders these without manual intervention.

Page structure (based on existing prototype):
- Two-column verdict: accurate sources (YES) vs. inaccurate sources (NO)
- Source name, headline, date, extracted quote
- Detailed analysis section
- Citations

The `retro/prototype/page.tsx` and `data.ts` in the Daatan repo serve as the UI reference for this format.

---

## 8. Scoring & Reputation System

### Two independent tracks
- **Journalist score** — follows the person across outlets
- **Outlet score** — reflects the publication's aggregate accuracy
- Both scored **per domain** — domain specialization emerges naturally from writing patterns

### Scoring methods

**Brier Score** — primary calibration metric:
```
BS = (1/N) * Σ(f_t - o_t)²
```
Where `f_t` = derived probability (Stance × Certainty), `o_t` = binary ground truth.

**Custom ELO variant** — zero-sum: journalists predicting the same event compete; correct predictors gain points from incorrect ones. Exact formula TBD.

### Cold start
New journalists default to outlet average score as prior. Full solution deferred.

---

## 9. Oracle Model

Generates forward-looking probability estimates by:
1. Aggregating predictions on a topic, **weighted by reputation score**
2. Applying ML model trained on historical prediction → outcome pairs
3. Model architecture (regression / neural net / LLM fine-tune) decided after sufficient labeled data exists

**Update frequency:** Batch retraining for MVP. Real-time updates per major event as a later milestone.

**No external signals** — oracle is derived purely from ingested publications + reputation scores + historical training.

---

## 10. API Design

The API is the product.

| Endpoint type | Description |
|---|---|
| Event probability | `"What is the probability of X?"` *(primary)* |
| Journalist reputation | Score, domain breakdown, history |
| Outlet reputation | Same at outlet level |

**Auth & billing:** Deferred. MVP will be open/internal to validate the model first.

---

## 11. Cost & Time Estimation

### Build cost (25 sources × 125 events)

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
| Event ground truth seeding | 3 days |
| Matrix filling (parallel extraction) | 14 days |
| Scoring & validation | 7 days |
| **Total MVP** | **~4.5 weeks** |

---

## 12. Open Problems & Deferred Decisions

| # | Problem | Status |
|---|---|---|
| 1 | Perigon/Event Registry Hebrew coverage quality | ⚠️ Needs validation before committing |
| 2 | Oracle ML model architecture | Deferred — needs labeled data first |
| 3 | Exact ELO formula | Deferred |
| 4 | Cold start for new journalists | Deferred — outlet average as likely prior |
| 5 | Telegram/video ingestion | Phase 2 |
| 6 | Journalist identity merging across platforms | Deferred to Phase 2 |
| 7 | API auth & billing | Deferred — open/internal first |
| 8 | Commercial branding | TBD (TruthMachine is working name) |
| 9 | **Legal review** — Investment Adviser registration risk | ⚠️ Must resolve before commercial launch |
| 10 | Orchestration layer (OpenClaw vs custom) | TBD during build |
| 11 | Political lean axis learning (model-derived, not manual) | Phase 2 — model fills it |
| 12 | Daatan ↔ TruthMachine API integration | Future — fully separate for now |
| 13 | PulseNews integration | Future — product exists but not priority |

---

## 13. Trade-offs & Recommendations

- **Hebrew accuracy:** DeepSeek V3 handles Hebrew well. Do not default to English translations — evaluate first.
- **Data redundancy:** High-volume sources republish wire news. Use story clustering to deduplicate before LLM stage.
- **Legal:** "Bona fide newspaper" defense is not solid protection for a B2B oracle. Legal counsel required before onboarding paying clients.
- **Source diversity:** Financial institutions and think tanks compete on the same leaderboard as media — this is intentional and a product differentiator.

---

*First priority: validate Perigon/EventRegistry Hebrew coverage, then build ingestion pipeline.*
