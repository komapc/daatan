# Daatan API Reference

All endpoints are prefixed with `/api`. Unless noted, protected endpoints require a valid NextAuth session cookie.

## Auth conventions

| Pattern | Meaning |
|---------|---------|
| Public | No auth required |
| Auth | Any authenticated user |
| Admin | `role = ADMIN` |
| Admin / Approver | `role = ADMIN` or `role = APPROVER` |
| Admin / Resolver | `role = ADMIN` or `role = RESOLVER` |
| Bot secret | `X-Bot-Runner-Secret` header = `BOT_RUNNER_SECRET` env |

---

## Forecasts

### `GET /api/forecasts`
List predictions. Public; optional session for user-context fields.

**Query params**

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `status` | enum | — | `DRAFT`, `ACTIVE`, `PENDING`, `PENDING_APPROVAL`, `RESOLVED_*`, `VOID`, `UNRESOLVABLE` |
| `authorId` | cuid | — | Filter by author |
| `tags` | string | — | Comma-separated tag names |
| `page` | number | 1 | |
| `limit` | number | 20 | max 100 |
| `sortBy` | enum | `newest` | `newest`, `deadline`, `cu` |
| `resolvedOnly` | bool | false | |
| `closingSoon` | bool | false | Within 7 days |

**Response** `{ predictions: [...], pagination: { page, limit, total, totalPages } }`

---

### `POST /api/forecasts` — Auth
Create a new prediction (status = DRAFT).

**Body** — `createPredictionSchema` (`src/lib/validations/prediction.ts`)

**Response** `201` — created prediction with author, newsAnchor, options

---

### `GET /api/forecasts/[id]`
Get single forecast by id or slug. Public; returns `userCommitment` if authenticated.

---

### `PATCH /api/forecasts/[id]` — Auth
Update forecast (author or admin). Core fields editable only on DRAFT; `isPublic` editable on any status.

**Body** — `patchPredictionSchema` (claimText, detailsText, resolutionRules, resolveByDatetime, isPublic)

---

### `DELETE /api/forecasts/[id]` — Auth
Delete forecast. Only DRAFT status allowed (admin can delete any).

---

### `POST /api/forecasts/[id]/publish` — Auth
Transition DRAFT → ACTIVE. Author only.

---

### `POST /api/forecasts/[id]/resolve` — Admin / Resolver
Resolve a prediction. Processes all commitments, distributes rewards, updates balances in one transaction.

**Body**

```json
{
  "outcome": "correct" | "wrong" | "void" | "unresolvable",
  "evidenceLinks": ["https://..."],
  "resolutionNote": "string",
  "correctOptionId": "cuid"  // required for MULTIPLE_CHOICE
}
```

---

### `POST /api/forecasts/[id]/approve` — Admin / Approver
Approve a bot `PENDING_APPROVAL` forecast → ACTIVE. Stakes on behalf of the bot.

---

### `POST /api/forecasts/[id]/reject` — Admin / Approver
Reject a bot `PENDING_APPROVAL` forecast → VOID. Creates `BotRejectedTopic`.

**Body**

```json
{
  "keywords": ["string"],   // optional, max 20
  "description": "string"   // optional, max 500
}
```

---

### `POST /api/forecasts/[id]/commit` — Auth
Create or update a commitment on a forecast.

**Body**

```json
{
  "confidence": -100,      // BINARY: -100 (certain NO) to +100 (certain YES); sign determines direction
  "confidence": 75,        // MULTIPLE_CHOICE: 1–100 certainty level
  "optionId": "cuid"       // required for MULTIPLE_CHOICE
}
```

`binaryChoice` is derived server-side from the sign of `confidence` (positive = YES).

---

### `GET /api/forecasts/[id]/commit/preview` — Auth
Preview expected RS outcomes before committing.

**Response** `{ confidence, probability, rsIfRight, rsIfWrong }`

---

### `GET /api/forecasts/[id]/context`
Return the public context timeline for a forecast (list of dated context snapshots with source articles and the AI probability estimate at that time). Public — no auth required.

**Response** — `{ currentContext, contextUpdatedAt, snapshots: ContextSnapshot[] }`, each snapshot shaped as:

```jsonc
{
  "id": "cuid",
  "predictionId": "cuid",
  "summary": "string",
  "sources": [{ "title": "...", "url": "...", "source": "...", "publishedDate": "..." }],
  "externalProbability": 64,                          // 0–100, or null
  "externalReasoning": "TruthMachine Oracle (...)",   // or null
  "oracleSnapshot": {                                 // null when LLM-fallback path was used
    "mean": 0.28,                                     // aggregated stance in [-1, 1]
    "std": 0.12,
    "ciLow": 52,                                      // 0–100, pre-scaled 95% CI
    "ciHigh": 76,
    "articlesUsed": 3,
    "sources": [
      {
        "sourceId": "reuters",
        "sourceName": "Reuters",
        "url": "https://reuters.com/...",
        "stance": 0.7,                                // [-1, 1], sign = YES/NO lean
        "certainty": 0.85,                            // [0, 1]
        "credibilityWeight": 0.95,                    // leaderboard weight, ~1.0 = neutral
        "claims": ["..."]
      }
    ]
  },
  "createdAt": "ISO-8601"
}
```

---

### `POST /api/forecasts/[id]/context` — Auth
Refresh the AI context for a forecast: fetches web articles for the claim, asks an LLM to summarise them, computes an "AI %" probability, and appends a new snapshot to the context timeline. Author-only and rate-limited to once per 24h per forecast.

**Probability source (tried in order):**

1. **TruthMachine Oracle API** (`POST ${ORACLE_URL}/forecast`) — calibrated multi-source estimate. Used when `ORACLE_URL` and `ORACLE_API_KEY` are set and the Oracle returns a non-placeholder response with at least one usable article. See [docs/LLM_ARCHITECTURE.md](./LLM_ARCHITECTURE.md#oracle-api-integration). When this path is taken, the full Oracle payload (mean, std, 95% CI, per-source stance/certainty/credibility) is persisted on the snapshot in the `oracleSnapshot` field and surfaced in the UI.
2. **LLM `guessChances`** (Gemini → Ollama fallback) — used when the Oracle is unconfigured, times out, returns `placeholder: true`, or the API version is incompatible. Snapshots from this path have `oracleSnapshot = null`.

The chosen source is recorded in `externalReasoning` on the snapshot (`"TruthMachine Oracle (calibrated multi-source estimate)"` vs the LLM-generated justification).

**Response** — `{ success, newContext, contextUpdatedAt, snapshot, timeline }` where `snapshot` and each `timeline` entry use the same `ContextSnapshot` shape documented under `GET /api/forecasts/[id]/context` above (including the optional `oracleSnapshot` field).

---

### `POST /api/forecasts/[id]/research` — Auth
AI-assisted resolution research for resolvers. Searches for recent articles about the forecast claim (Oracle → 3-way parallel local fallback), optionally generates better queries via LLM if initial results are sparse, then asks an LLM to suggest a resolution outcome and evidence links. Rate-limited to 10 calls per hour per user. Requires `RESOLVER` or `ADMIN` role.

**Response**

```jsonc
{
  "outcome": "correct",          // "correct" | "wrong" | "void" | "unresolvable"
  "reasoning": "string",         // LLM explanation for the suggested outcome
  "evidenceLinks": ["https://..."],  // URLs found that support the resolution
  "correctOptionId": "opt_cuid", // only set for MULTIPLE_CHOICE predictions
  "timings": { "searchMs": 8200, "llmMs": 9400, "totalMs": 17600 }
}
```

---

### `GET /api/forecasts/similar`
Find forecasts similar to a given forecast (by ID) or query text, using pgvector cosine similarity on Gemini `text-embedding-004` embeddings. Public — no auth required. Returns results from `ACTIVE` and `PENDING_APPROVAL` forecasts only, filtered to cosine similarity ≥ 0.75.

**Query params**

| Param | Required | Description |
|-------|----------|-------------|
| `id` | one of `id`/`q` | Forecast ID to find similar forecasts for (claimText + tags fetched automatically) |
| `q` | one of `id`/`q` | Free-text query to embed (max 200 chars) |
| `tags` | no | Comma-separated tag names used to boost results with shared tags (max 10, 50 chars each) |
| `limit` | no | Max results to return (default `3`, max `10`) |

**Response** — `{ similar: SimilarForecast[] }`, each entry shaped as:

```jsonc
{
  "id": "cuid",
  "slug": "bitcoin-will-reach-100k-by-2026",
  "claimText": "Bitcoin will reach $100k by end of 2026",
  "status": "ACTIVE",
  "resolveByDatetime": "2026-12-31T00:00:00Z",
  "author": { "name": "Alice", "username": "alice" },
  "score": 0.91    // cosine similarity, 0–1
}
```

Returns `{ similar: [] }` when no embedding is available (Gemini API key not configured) or no results pass the similarity threshold.

---

### `GET /api/forecasts/[id]/translate` — Auth
Return translated version of the forecast in the user's language preference.

---

### `GET /api/forecasts/express/generate` — Auth
Generate an "express" forecast via AI from a URL or topic.

---

### `POST /api/forecasts/express/guess` — Auth
Estimate the probability that a given claim will resolve YES, based on supplied article search results.

**Body**

```json
{
  "claimText": "string",
  "detailsText": "string",
  "articles": [{ "title": "...", "url": "...", "snippet": "..." }]
}
```

**Response** `{ probability: number, reasoning: string }` (probability is `0–100`).

Same Oracle-first → LLM-fallback logic as `POST /api/forecasts/[id]/context` above.

---

## Commitments

### `GET /api/commitments` — Auth
List commitments for the current user.

**Query params** — `listCommitmentsQuerySchema` (predictionId, status, page, limit)

---

### `GET /api/commitments/stats` — Auth
Aggregate stats for the current user's commitments (total, resolved, CU).

---

### `GET /api/commitments/activity` — Auth
Recent commitment activity feed.

---

## Comments

### `GET /api/comments`
List comments. Accepts `predictionId` query param.

### `POST /api/comments` — Auth
Create a comment.

### `PATCH /api/comments/[id]` — Auth
Edit a comment (author only).

### `DELETE /api/comments/[id]` — Auth
Delete a comment (author or admin).

### `POST /api/comments/[id]/react` — Auth
Add or remove a reaction.

### `POST /api/comments/[id]/translate` — Auth
Translate a comment.

---

## Notifications

### `GET /api/notifications` — Auth
List notifications for the current user.

### `PATCH /api/notifications/[id]` — Auth
Mark notification as read.

### `GET /api/notifications/unread-count` — Auth
Return `{ count: number }`.

### `GET /api/notifications/preferences` — Auth
Get notification preferences.

### `PATCH /api/notifications/preferences` — Auth
Update notification preferences.

---

## Profile

### `PATCH /api/profile/update` — Auth
Update profile (name, username, bio, etc.).

### `POST /api/profile/avatar` — Auth
Upload avatar image. Accepts multipart form with `file` field.

### `PATCH /api/profile/language` — Auth
Set preferred display language.

---

## Leaderboard & Stats

### `GET /api/leaderboard`
Top users by RS score. Public.

### `GET /api/top-reputation`
Top users by reputation for sidebar widget. Public.

---

## Tags

### `GET /api/tags`
List all tags with usage counts. Public.

### `POST /api/tags` — Admin
Create a tag.

### `DELETE /api/tags/[id]` — Admin
Delete a tag.

---

## AI

### `POST /api/ai/extract` — Auth
Extract structured prediction data from free text.

### `POST /api/ai/suggest-tags` — Auth
Suggest relevant tags for a forecast.

---

## Push Notifications

### `POST /api/push/subscribe` — Auth
Register a Web Push subscription.

---

## News Anchors

### `GET /api/news-anchors` — Auth
List news anchors the user has used.

---

## Admin

All admin endpoints require `role = ADMIN`.

### `GET /api/admin/forecasts`
List all forecasts regardless of status.

### `PATCH /api/admin/forecasts/[id]`
Admin-level forecast update (no status restrictions).

### `POST /api/admin/forecasts/backfill-rules` — Admin
LLM-generate resolution rules for all forecasts that are missing them. Long-running (up to 300s).

### `GET /api/admin/approvals`
List forecasts with status `PENDING_APPROVAL`.

### `GET /api/admin/users`
List all users.

### `GET /api/admin/users/[id]`
Get user details.

### `PATCH /api/admin/users/[id]`
Update user (role, cuAvailable, etc.).

### `POST /api/admin/users/grant-cu`
Grant CU to a user.

### `GET /api/admin/comments`
List all comments.

### `DELETE /api/admin/comments/[id]`
Delete any comment.

### `GET /api/admin/bots`
List all bot configs.

### `POST /api/admin/bots`
Create a bot config.

### `PATCH /api/admin/bots/[id]`
Update a bot config.

### `DELETE /api/admin/bots/[id]`
Delete a bot config.

### `POST /api/admin/bots/[id]/run`
Manually trigger a bot run.

### `GET /api/admin/bots/[id]/logs`
Fetch recent bot run logs.

---

## Bots

### `POST /api/bots/run` — Bot secret
Trigger the bot runner. Used by the GitHub Actions cron workflow.

**Header** `X-Bot-Runner-Secret: <BOT_RUNNER_SECRET>`

---

## System

### `GET /api/meta/timings`
Returns average server-side timing samples for the context-analysis pipeline (search → LLM → Oracle) aggregated over the last 30 days. The client uses these estimates to drive step-progress labels ("Searching… 10s → Analyzing… 12s → Estimating… 8s"). Public — no auth required.

**Response**

```jsonc
// When ≥ 3 samples exist:
{ "hasData": true, "sampleCount": 142, "timings": { "searchMs": 9800, "llmMs": 11200, "oracleMs": 7400 } }

// When fewer than 3 samples:
{ "hasData": false, "timings": { "searchMs": 10000, "llmMs": 12000, "oracleMs": 8000 } }
```

---

### `GET /api/health`
Liveness + readiness probe. Returns `200` when the DB is reachable, `503` when it is not.

```json
{
  "status": "ok",         // "ok" | "degraded"
  "version": "1.10.1",    // app version from src/lib/version.ts
  "commit": "e3a594f",    // short GIT_COMMIT baked at build time
  "timestamp": "2026-04-16T17:31:45.056Z",
  "env": "production",    // APP_ENV
  "db": true
}
```

### `GET /api/health/auth`
Auth subsystem health check.

### `GET /api/health/search`
Search provider health check. Returns credit/status for Serper, SerpAPI, and ScrapingBee.

### `GET /api/cron/cleanup`
Clean up expired/stale data. Intended for cron use.

---

## Auth

### `POST /api/auth/signup`
Register a new account with email + password.

### `POST /api/auth/forgot-password`
Send a password reset email.

### `POST /api/auth/reset-password`
Reset password using a token from the reset email.

---

## Account

### `DELETE /api/account`
Delete the authenticated user's account and all associated data.
