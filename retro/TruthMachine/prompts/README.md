# TruthMachine: Prompt Library

> **Last updated:** 2026-03-17

Each prompt corresponds to a pipeline stage. They are designed to be composed sequentially — the output of each stage feeds into the next.

---

## Pipeline Flow

```
Article
  │
  ▼
01_gatekeeper        → is_prediction? (cheap model)
  │ yes
  ▼
02_forensic_extraction → extract all predictions + metrics (DeepSeek)
  │
  ▼
04_event_matching    → match each prediction to seed event(s) (cheap model)
  │
  ▼
05_contrarianism     → compute deviation from consensus (after batch collected)
  │
  ▼
[scoring]            → Brier Score + ELO update (computed, not LLM)

Ground truth (run once per event, not per article):
03_ground_truth      → binary outcome determination (DeepSeek / GPT-4o)

Page generation (run once per event, after all predictions scored):
06_page_generation   → human-readable retro page (DeepSeek / Claude Sonnet)
```

---

## Prompt Files

| File | Stage | Model | Cost |
|---|---|---|---|
| `01_gatekeeper.md` | Filter — is this a prediction? | Nemotron 3 Nano | ~free |
| `02_forensic_extraction.md` | Extract all predictions + metrics | DeepSeek V3.2 | ~$0.25/1M |
| `03_ground_truth.md` | Determine binary event outcome | DeepSeek V3.2 / GPT-4o | ~$0.25–$5/1M |
| `04_event_matching.md` | Match prediction to seed event | Nemotron / DeepSeek | ~free–$0.25/1M |
| `05_contrarianism.md` | Score deviation from consensus | Nemotron 3 Nano | ~free |
| `06_page_generation.md` | Generate per-event analysis page | DeepSeek / Claude Sonnet | ~$0.25–$3/1M |

---

## Key Metrics Extracted (Stage 2)

| Metric | Range | Description |
|---|---|---|
| `stance` | -1.0 to 1.0 | Directional outlook |
| `sentiment` | 0.0 to 1.0 | Emotional tone |
| `certainty` | 0.0 to 1.0 | Linguistic sureness |
| `specificity` | 0.0 to 1.0 | How concrete/falsifiable |
| `hedge_ratio` | 0.0 to 1.0 | Density of hedging language |
| `conditionality` | 0.0 to 1.0 | Is prediction conditional? |
| `magnitude` | 0.0 to 1.0 | How extreme the predicted outcome |
| `time_horizon_days` | int / null | Days until predicted outcome |
| `source_authority` | 0.0 to 1.0 | Primary sources vs. personal opinion |
| `prediction_type` | enum | binary / continuous / range / trend |
| `contrarianism` | -1.0 to 1.0 | Deviation from consensus (Stage 5) |
