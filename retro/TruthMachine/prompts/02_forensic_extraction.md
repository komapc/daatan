# Prompt: Stage 2 — Forensic Extraction

**Model:** DeepSeek V3.2 (or equivalent, ~$0.25/1M tokens)
**Purpose:** Extract all distinct predictions from an article and quantify them as structured metrics.
**Output:** JSON only

---

## Prompt

```
You are a forensic prediction analyst. Extract every distinct forward-looking prediction from the article below and quantify each one precisely.

For each prediction, extract:

- **quote**: the exact sentence(s) from the article that contain the prediction
- **claim**: one-sentence neutral summary of what is being predicted
- **stance**: directional outlook on the outcome
  - -1.0 = strongly negative/bearish (predicts failure, decline, loss)
  - 0.0 = neutral / unclear direction
  - +1.0 = strongly positive/bullish (predicts success, rise, win)
- **sentiment**: emotional tone of the writing (0.0 = cold/analytical, 1.0 = highly charged/alarmed)
- **certainty**: how linguistically certain is the author (0.0 = very hedged, 1.0 = absolute confidence)
- **specificity**: how concrete and falsifiable is the prediction (0.0 = vague/general, 1.0 = precise with named actors, dates, thresholds)
- **hedge_ratio**: density of hedging language — "might", "could", "possibly", "likely", "some believe" (0.0 = no hedging, 1.0 = entirely hedged)
- **conditionality**: is this prediction conditional on another event? (0.0 = unconditional, 1.0 = fully conditional "only if X then Y")
- **magnitude**: how extreme is the predicted outcome (0.0 = minor/incremental, 1.0 = historic/catastrophic)
- **time_horizon**: predicted timeframe
  - "days" / "weeks" / "months" / "years" / "unspecified"
- **time_horizon_days**: best estimate in days (null if unspecified)
- **prediction_type**: "binary" (yes/no) / "continuous" (value/level) / "range" / "trend"
- **source_authority**: is the prediction based on insider/primary sources, or author's own analysis?
  - 0.0 = pure personal opinion
  - 0.5 = general expertise / public information
  - 1.0 = named insider sources / primary data

Article:
<article>
{{ARTICLE_TEXT}}
</article>

Source: {{SOURCE_NAME}}
Journalist: {{JOURNALIST_NAME}} (or "unknown")
Date: {{ARTICLE_DATE}}
Related event: {{EVENT_NAME}} — {{EVENT_DESCRIPTION}}

Return JSON only:
{
  "predictions": [
    {
      "quote": "string",
      "claim": "string",
      "stance": float,
      "sentiment": float,
      "certainty": float,
      "specificity": float,
      "hedge_ratio": float,
      "conditionality": float,
      "magnitude": float,
      "time_horizon": "string",
      "time_horizon_days": int | null,
      "prediction_type": "binary" | "continuous" | "range" | "trend",
      "source_authority": float
    }
  ]
}
```

---

## Notes
- Extract **every** distinct prediction, even vague ones. Vague predictions receive low `specificity` and `certainty`.
- If the article is in Hebrew, respond in the same structure — do not translate the `quote` field.
- Do not infer intent beyond what the text states.
- The `claim` field should be in English regardless of article language.
- Maximum predictions per article: 10. If more exist, take the most specific ones.
