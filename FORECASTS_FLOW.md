# DAATAN Forecasts - End-to-End Flow

> Implementation reference for the core Forecasts feature.
> See [GLOSSARY.md](./GLOSSARY.md) for terminology.

---

## Overview

```
[News Anchor] → [Prediction Draft] → [Define Outcome] → [Commit CU] → [Active] → [Resolution]
```

---

## Step 1: Select News Anchor

### User Action
Pick a specific news story/event to attach the forecast to.

### System Requirements
- Create or reuse a `NewsAnchor` (dedupe/canonicalize if needed)
- Store snapshot of key fields so context won't drift if article changes:
  - `title`
  - `source`
  - `published_at`
  - `url_hash`

---

## Step 2: Write Prediction (Draft)

### User Action
- Enter a short, testable forecast statement (`claim_text`)
- Optionally add details/conditions (`details_text`)
- Choose a domain (or auto-fill from anchor)

### System Storage (Minimum)
```
Prediction {
  status: "draft"
  author_user_id: string
  news_anchor_id: string
  claim_text: string
  details_text?: string
  domain: string
}
```

### Validation
- `claim_text` required (minimum length)
- Soft warning if statement is too vague or missing time-bound aspect

---

## Step 3: Define Outcome Type + Deadline

### User Action
1. Choose `outcome_type`:
   - **Binary** — will happen / won't happen
   - **Multiple Choice** — one option out of N
   - **Numeric Threshold** — metric crosses a defined value

2. Set `resolve_by_datetime` (deadline for resolution)

### System Storage
```
Prediction {
  ...
  outcome_type: "binary" | "multiple_choice" | "numeric"
  outcome_payload: object  // type-specific data
  resolve_by_datetime: datetime
  resolution_rules: string  // default: "resolved by official/reliable sources"
}
```

### Validation
| Type | Rules |
| ---- | ----- |
| All | `resolve_by_datetime` must be in the future |
| Multiple Choice | Min 2 options, no duplicates |
| Numeric | Valid number + defined metric/source |

---

## Step 4: Commit CU + Publish (Lock)

### User Action
1. Choose how many Confidence Units (CU) to commit
2. Press **Publish**

### System Requirements (Atomic Transaction)
1. Check user has enough `CU_available`
2. Create `Commitment`:
   ```
   Commitment {
     prediction_id: string
     user_id: string
     cu_committed: number
     rs_snapshot: number  // RS at publish time
   }
   ```
3. Lock CU in user's ledger:
   - Reduce `CU_available`
   - Increase `CU_locked`
4. Update Prediction:
   ```
   Prediction {
     status: "active"
     published_at: datetime
     locked_at: datetime
   }
   ```

### Rule
**After publish, prediction is immutable** — no edits to claim/outcome/deadline/CU.

---

## Step 5: Forecast Page + Lifecycle

### Forecast Page Display
- News Anchor (with snapshot)
- Prediction text + details
- Outcome definition (Binary/MC/Numeric)
- Resolve-by deadline
- Commitment details (CU, RS snapshot, weight)

### Prediction Statuses

| Status | Description |
| ------ | ----------- |
| `draft` | Created, not published |
| `active` | Published, awaiting resolution |
| `resolved_correct` | Resolved as correct |
| `resolved_wrong` | Resolved as wrong |
| `void` | Invalidated |
| `unresolvable` | Cannot be determined |

---

## Step 6: Resolution Trigger

Resolution starts when:
1. `resolve_by_datetime` arrives, **OR**
2. An earlier authoritative source enables resolution

---

## Step 7: Who Resolves

**Core Version:**
- System/moderator resolves based on defined rules and evidence
- No community voting in core implementation

---

## Step 8: Resolution Action

### System Storage
```
Prediction {
  resolution_outcome: "correct" | "wrong" | "void" | "unresolvable"
  evidence_link: string[]  // at least one URL
  resolved_at: datetime
  status: "resolved_correct" | "resolved_wrong" | "void" | "unresolvable"
}
```

---

## Resolution Rules (Core)

### Evidence Requirements
- Evidence is **mandatory** for every resolution (at least one link)
- Source priority: `official data > reputable news`

### Decision Logic

| Situation | Outcome |
| --------- | ------- |
| Clear evidence supports prediction | `correct` |
| Clear evidence contradicts prediction | `wrong` |
| Conflicting reliable sources, cannot decide | `unresolvable` |
| Deadline passed + no reliable data (within grace window) | `unresolvable` |
| Prediction canceled/invalidated (rule issues, broken anchor, abuse) | `void` |

---

## CU + RS Effects

| Outcome | CU Effect | RS Effect |
| ------- | --------- | --------- |
| `correct` | Unlock | Changes (calculated) |
| `wrong` | Unlock | Changes (calculated) |
| `void` | Refund | No change |
| `unresolvable` | Unlock | No change |

---

## Database Schema Reference

See `prisma/schema.prisma` for full schema. Key models:

- `User` — with RS, CU balance
- `NewsAnchor` — news story snapshot
- `Prediction` — forecast statement
- `Commitment` — CU allocation
- `CuTransaction` — CU ledger

