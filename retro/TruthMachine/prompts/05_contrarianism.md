# Prompt: Stage 5 — Contrarianism Score

**Model:** Nemotron 3 Nano (lightweight calculation)
**Purpose:** Calculate how far a prediction deviates from the consensus of other sources at the same timestamp.
**Output:** JSON only

---

## Prompt

```
You are calculating a contrarianism score for a prediction.

Given a prediction and the consensus of other sources at the same time, determine how contrarian this prediction is.

Target prediction:
<prediction>
Claim: {{PREDICTION_CLAIM}}
Stance: {{PREDICTION_STANCE}}  // -1.0 to 1.0
Source: {{SOURCE_NAME}}
Date: {{ARTICLE_DATE}}
</prediction>

Consensus at time of publication:
<consensus>
Mean stance of other sources: {{CONSENSUS_MEAN_STANCE}}
Number of sources in consensus: {{CONSENSUS_COUNT}}
Consensus summary: {{CONSENSUS_SUMMARY}}
</consensus>

Return JSON only:
{
  "contrarianism": float,
  // -1.0 = strongly agrees with consensus (same direction, high confidence)
  // 0.0 = neutral / no clear deviation
  // +1.0 = strongly contrarian (opposite direction from consensus)

  "contrarianism_note": "one sentence explaining the deviation"
}
```

---

## Notes
- Contrarianism is computed **after** all predictions for an event/timeframe are extracted
- High contrarianism + correct outcome = major ELO boost for the source
- High contrarianism + wrong outcome = major ELO penalty
- This is one of the most important signals for the oracle model
- Requires at least 3 other sources on the same event to compute meaningfully
