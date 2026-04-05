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

### `POST /api/forecasts/[id]/context` — Auth
Update the AI context note for a forecast (author only).

---

### `POST /api/forecasts/[id]/research` — Auth
Trigger AI research for a forecast.

---

### `GET /api/forecasts/[id]/translate` — Auth
Return translated version of the forecast in the user's language preference.

---

### `GET /api/forecasts/express/generate` — Auth
Generate an "express" forecast via AI from a URL or topic.

---

### `GET /api/forecasts/express/guess` — Auth
Guess the resolution of a forecast using AI.

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

### `GET /api/health`
Basic health check. Returns `{ ok: true, db: "ok" }`.

### `GET /api/health/auth`
Auth subsystem health check.

### `GET /api/cron/cleanup`
Clean up expired/stale data. Intended for cron use.
