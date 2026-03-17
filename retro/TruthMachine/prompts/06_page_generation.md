# Prompt: Stage 6 — Per-Event Page Generation

**Model:** DeepSeek V3.2 or Claude Sonnet
**Purpose:** Generate the human-readable analysis sections for the per-event retro page.
**Output:** JSON only

---

## Prompt

```
You are a forensic media analyst writing a post-event accuracy report.

Given the event outcome and the extracted predictions from various sources, write a structured analysis report for publication.

Event:
<event>
ID: {{EVENT_ID}}
Title: {{EVENT_TITLE}}
Question: {{EVENT_QUESTION}}
Outcome: {{OUTCOME}}  // 1 = occurred, 0 = did not occur
Outcome date: {{OUTCOME_DATE}}
Outcome summary: {{OUTCOME_SUMMARY}}
</event>

Accurate predictions (stance aligned with outcome):
<accurate>
{{ACCURATE_PREDICTIONS_LIST}}
</accurate>

Inaccurate predictions (stance opposed to outcome):
<inaccurate>
{{INACCURATE_PREDICTIONS_LIST}}
</inaccurate>

Write the analysis in this JSON structure:
{
  "tag": "short market/event label (e.g. 'POLITICAL FORECAST MARKET #882-VZ')",
  "title": "concise event title for the page header",
  "description": "2-3 sentence neutral description of the prediction landscape before the event",

  "left_column": {
    "label": "YES / [outcome direction]",
    "outcome": "[OUTCOME LABEL]",
    "sublabel": "ACCURATE ANALYTICAL FORECASTS"
  },

  "right_column": {
    "label": "NO / [opposite direction]",
    "outcome": "[FAILED LABEL]",
    "sublabel": "INACCURATE / DISMISSIVE FORECASTS"
  },

  "detailed_analysis": [
    {
      "title": "section title",
      "content": ["paragraph 1", "paragraph 2", "paragraph 3"]
    }
  ],

  "key_insight": "one powerful sentence summarizing the most interesting pattern in media accuracy for this event"
}
```

---

## Notes
- Write in a neutral, analytical tone — not editorializing
- `detailed_analysis` should have 2–4 sections covering: the dominant narrative before the event, the contrarian signals that were correct, what the inaccurate sources missed, and any structural bias patterns
- `key_insight` is shown prominently on the page — make it punchy and data-grounded
- Do not fabricate quotes or sources — use only what is provided in the input
