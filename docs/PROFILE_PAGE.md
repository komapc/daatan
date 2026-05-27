# User Profile Page

## Overview

The profile page (`/profile` for own profile, `/profile/[id]` for public profiles) shows a user's complete forecasting record including all scoring metrics, tabbed forecast lists, and per-topic filtering.

## URL State

All interactive state lives in URL query parameters — no client-side state. This makes every view shareable and bookmarkable.

| Param | Default | Values |
|-------|---------|--------|
| `tab` | `created` | `created`, `participated`, `resolved` |
| `tag` | *(none)* | tag slug string |
| `page` | `1` | positive integer |

Switching a tag resets page to 1. Switching a tab resets page to 1 but preserves the current tag. The helper `buildProfileUrl()` in `src/components/profile/profile-url.ts` centralises this logic and is used by both `TagFilter` and `ProfileTabs`.

## Page Architecture

```
ProfilePage (Server Component — page.tsx)
  └── UserProfileView (Server Component)
        ├── Profile header (avatar, name, RS card, CU balance)
        ├── TagFilter (Client Component — useSearchParams)
        ├── ScoresGrid (Server Component)
        │     ├── Score cards (10+ metrics)
        │     ├── GlickoChart
        │     └── TopicBreakdown (when no tag selected)
        └── ProfileTabs (Client Component — usePathname + useSearchParams)
              └── {children} — server-rendered tab content (CreatedList / CommitmentList)
```

Server components render the full page with no client-side data fetching. `ProfileTabs` is a client component only for the tab navigation links; the tab content itself is passed as `{children}` and rendered on the server.

## Data Service

`src/lib/services/profile.ts` exports two functions shared between both profile pages:

### `loadProfileScores({ userId, selectedTag }): Promise<ProfileScores>`

Runs 8 parallel DB queries to compute all scoring metrics for the scores grid. Returns `ProfileScores`:

| Field | Description |
|-------|-------------|
| `avgBrierScore` | Average (p − outcome)² across resolved commitments |
| `brierCount` | Number of resolved commitments with a Brier score |
| `peerScoreSum` | Sum of peer scores (you vs community consensus) |
| `peerScoreCount` | Number of peer-scored commitments |
| `aiScoreSum` | Sum of AI scores (you vs AI estimate) |
| `aiScoreCount` | Number of AI-scored commitments |
| `rsTagDelta` | Sum of RS changes in the selected tag (null when no tag selected) |
| `truthScore` | Average peer score per prediction (min 3, null otherwise) |
| `weightedPeerScore` | Metaculus-style decay-weighted peer score (min 3, null otherwise) |
| `roi` | Average net RS change per resolved prediction (min 3, null otherwise) |
| `accuracy` | Fraction of resolved commitments where rsChange > 0 (min 3, null otherwise) |
| `accuracyResolved` | Raw count of resolved commitments used for accuracy |
| `topicBreakdown` | Per-tag peer score averages (top 8 tags by count) |

### `loadProfileTab({ userId, isPublic, selectedTag, tab, page }): Promise<ProfileTabResult>`

Returns counts for all three tabs plus the items for the active tab (20 per page). The `isPublic` flag controls whether private predictions are included — own profile passes `false`, public profile passes `true`.

## Tabs

| Tab | Shows | Item type |
|-----|-------|-----------|
| **Created** | Predictions the user authored | `Prediction` (via `ForecastCard`) |
| **Participated** | All commitments (staked or voted) | `CommitmentForList` with probability badge |
| **Resolved** | Commitments on resolved predictions | `CommitmentForList` with probability + outcome/Brier badge |

## Own vs Public Profile

| Feature | Own (`/profile`) | Public (`/profile/[id]`) |
|---------|-----------------|------------------------|
| Private predictions visible | Yes | No |
| CU balance card | Yes | No |
| Edit profile link | Yes | No |
| SEO JSON-LD | No | Yes |
| Redirect if viewing own | N/A | Redirects to `/profile` |

## Scores Grid

See `docs/SCORING_SYSTEMS.md` for full descriptions of each metric. The grid renders ELO and Glicko-2 from the global stored values on `User`; per-tag replays (using `replayEloHistory` / `replayGlicko2History`) are **not** performed on the profile page — those are leaderboard-only for performance reasons.

The `ScoresGrid` component also renders:
- **GlickoChart** — Glicko-2 μ ± σ history via `GET /api/profile/[id]/glicko-history`
- **TopicBreakdown** — a table of per-tag peer score averages (hidden when a tag is already selected)

## Implementation Files

| File | Role |
|------|------|
| `src/app/profile/page.tsx` | Own-profile page; session-gated; shows private predictions |
| `src/app/profile/[id]/page.tsx` | Public profile; adds SEO JSON-LD; redirects if own |
| `src/components/profile/UserProfileView.tsx` | Shared view component (server) |
| `src/components/profile/ScoresGrid.tsx` | Scores grid + Glicko chart + topic breakdown |
| `src/components/profile/ProfileTabs.tsx` | Tab nav + pagination (client component) |
| `src/components/profile/TagFilter.tsx` | Tag pill filter (client component) |
| `src/components/profile/profile-url.ts` | `buildProfileUrl()` — shared URL builder |
| `src/lib/services/profile.ts` | `loadProfileScores` + `loadProfileTab` + shared types |
