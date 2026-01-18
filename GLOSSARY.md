# DAATAN Glossary

> Last updated: January 2026

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
The act of allocating Confidence Units (CU) to a specific Prediction. Represents "how strongly I stand behind this forecast." CU are locked until resolution.

---

## Resolution Outcomes

### Resolution
The final verdict of a Prediction once it's decidable.

| Outcome | Description | CU Effect | RS Effect |
| ------- | ----------- | --------- | --------- |
| **Correct** | The prediction happened | Unlock | Changes (calculated) |
| **Wrong** | The prediction did not happen | Unlock | Changes (calculated) |
| **Void** | Canceled/invalidated | Refund | No change |
| **Unresolvable** | Cannot be reliably determined | Unlock | No change |

### Void
A prediction that was canceled or invalidated, so it's not counted as correct or wrong. Happens when:
- Original news anchor was removed/changed significantly
- Resolution rules were flawed
- User canceled within the allowed window

CU are refunded and RS does not change.

### Unresolvable
Used when a prediction cannot end with a clean "true/false" even with good intent:
- No reliable information to decide (no official data, conflicting sources)
- Real-world situation changed midstream (postponed/replaced/redefined)
- Resolution rules are too ambiguous to judge fairly

Protects fairness and system credibility by allowing "we can't reliably determine this" instead of a forced call.

---

## Scoring System

### Reputation Score (RS)
A user's long-term credibility/accuracy score based on past resolved predictions. Updates over time in an ELO-like way (expected outcome vs. actual outcome). Can increase or decrease (including becoming negative).

RS powers titles/ranks (overall and/or by domain like politics/economy), earned and maintained only through sustained accuracy.

### Confidence Units (CU)
A limited per-period budget of "confidence" a user can allocate across predictions. CU represent intensity/conviction but:
- Have no monetary value
- Cannot be transferred
- Cannot be bought

### Prediction Weight
The influence/strength of a specific prediction in scoring/visibility calculations.

**Formula:** `Weight = RS × CU`

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
| `active` / `locked` | Published, CU committed, awaiting resolution |
| `resolved_correct` | Resolved as correct |
| `resolved_wrong` | Resolved as wrong |
| `void` | Invalidated |
| `unresolvable` | Cannot be determined |
| `expired` | (Optional) Deadline passed without resolution |

