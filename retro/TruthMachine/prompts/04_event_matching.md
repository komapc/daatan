# Prompt: Stage 4 — Event Matching

**Model:** Nemotron 3 Nano or DeepSeek V3.2
**Purpose:** Match an extracted prediction to one or more seed events from the master list.
**Output:** JSON only

---

## Prompt

```
You are matching a news prediction to a list of known seed events.

Given the prediction below, determine which seed event(s) it relates to. A prediction may relate to more than one event.

Prediction:
<prediction>
Claim: {{PREDICTION_CLAIM}}
Source: {{SOURCE_NAME}}
Date: {{ARTICLE_DATE}}
Quote: "{{PREDICTION_QUOTE}}"
</prediction>

Seed events (ID and description):
<events>
{{EVENTS_LIST}}
</events>

Return JSON only:
{
  "matches": [
    {
      "event_id": "string",
      "relevance": float,  // 0.0–1.0 how closely this prediction relates to the event
      "match_reason": "one sentence"
    }
  ],
  "no_match": boolean,  // true if no seed event matches
  "no_match_reason": "string | null"  // why no match was found
}
```

---

## Matching Rules
- Include matches with `relevance >= 0.5`
- A prediction about "Netanyahu winning the election" matches election events, not judicial reform events
- A vague prediction about "Israel's political future" may match multiple events with lower relevance scores
- If `no_match` is true, the prediction is stored but not scored against any event
- The `EVENTS_LIST` should be filtered to the same domain/time period as the article to reduce prompt size
