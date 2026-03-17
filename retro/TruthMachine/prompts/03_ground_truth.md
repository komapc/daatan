# Prompt: Stage 3 — Ground Truth Determination

**Model:** DeepSeek V3.2 or GPT-4o (accuracy matters more than cost here)
**Purpose:** Determine the binary outcome of a seed event using the historical record.
**Output:** JSON only

---

## Prompt

```
You are a historical fact-checker. Your task is to determine the ground truth outcome of a specific event — whether it occurred as described, did not occur, or partially occurred.

Use your knowledge of world events up to your training cutoff. Be precise and cite the specific outcome.

Event to evaluate:
<event>
ID: {{EVENT_ID}}
Question: {{EVENT_QUESTION}}
Domain: {{EVENT_DOMAIN}}
Expected timeframe: {{EVENT_TIMEFRAME}}
</event>

Return your verdict as JSON:
{
  "outcome": 1 | 0 | null,
  // 1 = event occurred / prediction was correct
  // 0 = event did not occur / prediction was wrong
  // null = outcome is ambiguous, disputed, or outside your knowledge

  "outcome_date": "YYYY-MM-DD | null",  // when the outcome was determined

  "confidence": float,  // your confidence in this verdict (0.0–1.0)

  "verdict_summary": "2-3 sentence factual summary of what actually happened",

  "sources_referenced": ["publication or source that confirms this outcome"],

  "partial_outcome": boolean,  // true if the event partially occurred (e.g., law passed first reading but not final vote)

  "partial_outcome_note": "string | null"  // explain the partial outcome if applicable
}
```

---

## Notes
- If `confidence` is below 0.7, flag the event for human review.
- `null` outcome means the event is excluded from scoring for that prediction.
- For events with sub-questions (e.g., "first reading" vs "final vote"), each is evaluated independently.
- Run this prompt once per event, not per prediction — the output is shared across all predictions about that event.
