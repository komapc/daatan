# DAATAN Glossary

> Last updated: April 2026

## Core Concepts

### DAATAN (Product)
The overall platform that measures users' understanding and accuracy in forecasting news and current events. No money, no gambling.

### DAATAN Forecasts
The main feature where users create news-linked forecasts (commitments) that later get resolved and affect their reputation. Formerly known as "ScoopBet".

---

## Forecast Components

### News Anchor
A specific news story/event that a forecast is attached to. Provides context and a reference point for what the forecast is about. Also called "Event Card" or "News Item".

### Prediction
The forecast statement itself: a clear, testable claim about what will (or won't) happen, by a defined deadline and with defined resolution rules.

### Commitment
The act of expressing a confidence level on a specific Prediction. Represents "how strongly I stand behind this forecast." Stored as a value from -100 to +100 (BINARY) or 1–100 (Multiple Choice). Resolution computes a Brier score and awards or deducts RS accordingly.

---

## Resolution Outcomes

### Resolution
The final verdict of a Prediction once it's decidable.

| Outcome | Description | RS Effect |
| ------- | ----------- | --------- |
| **Correct** | The prediction happened | ΔRS via Brier score (up to +25) |
| **Wrong** | The prediction did not happen | ΔRS via Brier score (down to -75) |
| **Void** | Canceled/invalidated | No change |
| **Unresolvable** | Cannot be reliably determined | No change |

### Void
A prediction that was canceled or invalidated, so it's not counted as correct or wrong. Happens when:
- Original news anchor was removed/changed significantly
- Resolution rules were flawed
- User canceled within the allowed window

RS does not change for void outcomes.

### Unresolvable
Used when a prediction cannot end with a clean "true/false" even with good intent:
- No reliable information to decide (no official data, conflicting sources)
- Real-world situation changed midstream (postponed/replaced/redefined)
- Resolution rules are too ambiguous to judge fairly

Protects fairness and system credibility by allowing "we can't reliably determine this" instead of a forced call.

---

## Scoring System

### Reputation Score (RS)
A user's long-term credibility/accuracy score based on past resolved predictions. Can increase or decrease (including going negative). RS is the only score that matters — earned through calibrated, accurate forecasting.

### Brier Score
Probability calibration metric measuring forecast accuracy. Formula: `(probability − outcome)²`. Lower is better; 0 = perfect, 0.25 = break-even.

Used to compute RS change on resolution: `ΔRS = round((0.25 − brierScore) × 100)`.

### Confidence (value stored on Commitment)
An integer representing how strongly the user believes in their forecast direction:
- **Binary:** -100 (certain NO) → 0 (neutral) → +100 (certain YES). Sign determines YES/NO; magnitude determines Brier score impact.
- **Multiple Choice:** 1–100, where higher = more certain about the chosen option.

A neutral (0) confidence always gives ΔRS = 0 regardless of outcome. Max confidence (±100) yields up to +25 RS if right or -75 RS if wrong.

---

## Prediction Types

### Binary
Will happen / Won't happen. Simple yes/no outcome.

### Multiple Choice
One option out of N defined choices.

### Numeric Threshold
A metric crosses a defined value (e.g., "Bitcoin will exceed $100k").

---

## Prediction Statuses

| Status | Description |
| ------ | ----------- |
| `draft` | Created but not published |
| `pending_approval` | Created by bot, awaiting human review before going active |
| `active` / `locked` | Published, confidence committed, awaiting resolution |
| `resolved_correct` | Resolved as correct |
| `resolved_wrong` | Resolved as wrong |
| `void` | Invalidated |
| `unresolvable` | Cannot be determined |
| `expired` | (Optional) Deadline passed without resolution |

---

## Commitment Lifecycle

### Commitment Removal
A user can remove their commitment from an active prediction before resolution. Removing a commitment does not affect RS — Brier scoring only applies at resolution.

---

## Bot System

### Bot
An automated user account (`isBot: true`) that autonomously creates forecasts and votes based on a configured persona and RSS feed topics. Bot-created forecasts are marked with `source: 'bot'` and a `🤖` prefix in the title and require human approval (`pending_approval`) before going active (unless `autoApprove` is enabled).

### BotConfig
Database model storing bot configuration: persona prompt, run interval, topic/tag filter, vote bias, and autoApprove flag.

### BotRunLog
Audit log entry for each bot execution, recording the action taken (`CREATED_FORECAST`, `VOTED`, `SKIPPED`, `ERROR`), dry-run flag, and any generated text or error message.

