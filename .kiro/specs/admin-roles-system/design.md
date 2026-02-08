# Design Document: Admin & Roles System

## Overview

This design replaces the existing boolean-based role system (`isAdmin`, `isModerator`) with a single `Role` enum on the User model, standardizes role-based API middleware, and enhances the admin panel with edit/soft-delete capabilities for predictions. It also adds inline moderation controls for resolvers and role badges across the UI.

The existing codebase already has:
- An admin panel at `/admin` with tabs for forecasts, comments, and users
- API routes at `/api/admin/*` for listing and managing these entities
- A `requireRole()` helper in `src/lib/admin.ts` that checks `isAdmin`/`isModerator` booleans
- Inline moderator resolution UI at `ModeratorResolutionSection.tsx`
- Soft-delete for comments (via `deletedAt` field)
- Role toggle buttons in the admin users tab

The main changes are:
1. Replace boolean flags with a `Role` enum in Prisma
2. Refactor `requireRole()` to work with the enum
3. Add prediction edit/soft-delete in admin panel
4. Add `deletedAt` field to the Prediction model
5. Add inline comment delete button for resolvers
6. Add role badges on profiles and comment authors
7. Seed script for initial admins

## Architecture

```mermaid
graph TD
    subgraph "Client Layer"
        AP[Admin Panel - /admin]
        IMC[Inline Moderation Controls]
        RB[Role Badges]
    end

    subgraph "API Layer"
        MW[requireRole Middleware]
        AF[/api/admin/forecasts]
        AC[/api/admin/comments]
        AU[/api/admin/users]
        PR[/api/predictions/resolve]
        CD[/api/comments/delete]
    end

    subgraph "Data Layer"
        DB[(PostgreSQL)]
        PM[Prisma Schema - Role Enum]
    end

    AP --> MW
    IMC --> MW
    MW --> AF
    MW --> AC
    MW --> AU
    MW --> PR
    MW --> CD
    AF --> DB
    AC --> DB
    AU --> DB
    PR --> DB
    CD --> DB
    PM --> DB
```

### Key Design Decisions

1. **Single `role` field vs. multiple booleans**: A single enum is more maintainable, prevents invalid states (e.g., `isAdmin=true, isModerator=false` when admins should implicitly have moderator powers), and is easier to extend with new roles.

2. **ADMIN implicitly includes RESOLVER permissions**: Rather than requiring both flags, `role = ADMIN` grants all permissions including resolution. The middleware handles this hierarchy.

3. **Soft-delete for predictions**: Mirrors the existing comment soft-delete pattern. Adds `deletedAt` to the Prediction model and filters it out in public queries.

4. **Migration strategy**: A two-step migration — first add the enum field with a default, then backfill from booleans, then drop the booleans. This allows a safe rollback window.

## Components and Interfaces

### 1. Prisma Schema Changes

```prisma
enum Role {
  USER
  RESOLVER
  ADMIN
}

model User {
  // ... existing fields ...
  role Role @default(USER)
  // Remove: isAdmin, isModerator
}

model Prediction {
  // ... existing fields ...
  deletedAt DateTime?
}
```

### 2. Role Middleware (`src/lib/admin.ts`)

Refactored `requireRole` function:

```typescript
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { apiError } from '@/lib/api-error'
import { Role } from '@prisma/client'

// Role hierarchy: ADMIN > RESOLVER > USER
const ROLE_HIERARCHY: Record<Role, number> = {
  USER: 0,
  RESOLVER: 1,
  ADMIN: 2,
}

export async function requireRole(minimumRole: Role) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return { error: apiError('Unauthorized', 401) }
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true },
  })

  if (!user) {
    return { error: apiError('User not found', 401) }
  }

  if (ROLE_HIERARCHY[user.role] < ROLE_HIERARCHY[minimumRole]) {
    return { error: apiError('Forbidden', 403) }
  }

  return { user }
}
```

This uses a hierarchy approach: `requireRole('RESOLVER')` allows both RESOLVER and ADMIN users. `requireRole('ADMIN')` allows only ADMIN users.

### 3. NextAuth Session Updates (`src/lib/auth.ts`)

The session callback replaces `isAdmin`/`isModerator` with the `role` field:

```typescript
// In session callback
session.user.role = user.role
// Remove: session.user.isAdmin, session.user.isModerator
```

TypeScript type augmentation for NextAuth:

```typescript
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: Role
      // ... other fields
    }
  }
}
```

### 4. Validation Schemas (`src/lib/validations/admin.ts`)

```typescript
import { z } from 'zod'

export const updateUserRoleSchema = z.object({
  role: z.enum(['USER', 'RESOLVER', 'ADMIN']),
})

export const adminUpdatePredictionSchema = z.object({
  claimText: z.string().min(10).max(500).optional(),
  detailsText: z.string().max(5000).optional().nullable(),
  domain: z.string().max(100).optional().nullable(),
  resolutionRules: z.string().max(2000).optional().nullable(),
})

export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>
export type AdminUpdatePredictionInput = z.infer<typeof adminUpdatePredictionSchema>
```

### 5. Admin API Route Changes

**PATCH /api/admin/forecasts/[id]** — Edit prediction (admin only, not resolved):
- Validates with `adminUpdatePredictionSchema`
- Rejects if prediction status is resolved/void/unresolvable

**DELETE /api/admin/forecasts/[id]** — Soft-delete prediction (admin only):
- Sets `deletedAt = new Date()`

**PATCH /api/admin/users/[id]/role** — Updated to use `role` enum:
- Validates with `updateUserRoleSchema`
- Prevents self-role-change

### 6. Admin Panel UI Changes (`AdminClient.tsx`)

- Replace `isAdmin`/`isModerator` checks with `role` comparisons
- Add edit modal/inline edit for forecasts (claim text, details, domain, resolution rules)
- Add soft-delete button for forecasts with confirmation
- Show deleted forecasts with visual distinction (like comments tab)

### 7. Inline Moderation Controls

**Comment delete button** (`CommentItem.tsx`):
- Show delete icon for users with `role >= RESOLVER` on any comment
- Calls existing `DELETE /api/comments/[id]`

**Resolution section** (`ModeratorResolutionSection.tsx`):
- Update role check from `isModerator || isAdmin` to `role === 'RESOLVER' || role === 'ADMIN'`

### 8. Role Badges Component

A reusable `RoleBadge` component:

```typescript
function RoleBadge({ role }: { role: string }) {
  if (role === 'ADMIN') return <span className="...">Admin</span>
  if (role === 'RESOLVER') return <span className="...">Resolver</span>
  return null
}
```

Used in: Sidebar, CommentItem, profile pages, prediction author displays.

### 9. Seed Script (`prisma/seed-admins.ts`)

Reads admin emails from an environment variable (`ADMIN_EMAILS`) or a config constant, updates matching users to `role = ADMIN`.

## Data Models

### Role Enum

| Value | Description | Permissions |
|-------|-------------|-------------|
| `USER` | Default role | Create predictions, comment, commit CU |
| `RESOLVER` | Moderator | All USER permissions + resolve predictions, delete comments, access admin panel (forecasts/comments tabs) |
| `ADMIN` | Administrator | All RESOLVER permissions + manage users/roles, edit/delete predictions, access full admin panel |

### Migration Plan

**Step 1**: Add `Role` enum and `role` field with default `USER`
```sql
CREATE TYPE "Role" AS ENUM ('USER', 'RESOLVER', 'ADMIN');
ALTER TABLE "users" ADD COLUMN "role" "Role" NOT NULL DEFAULT 'USER';
```

**Step 2**: Backfill from booleans
```sql
UPDATE "users" SET "role" = 'ADMIN' WHERE "isAdmin" = true;
UPDATE "users" SET "role" = 'RESOLVER' WHERE "isModerator" = true AND "isAdmin" = false;
```

**Step 3**: Drop boolean columns
```sql
ALTER TABLE "users" DROP COLUMN "isAdmin";
ALTER TABLE "users" DROP COLUMN "isModerator";
```

**Step 4**: Add `deletedAt` to predictions
```sql
ALTER TABLE "predictions" ADD COLUMN "deletedAt" TIMESTAMP;
CREATE INDEX "predictions_deletedAt_idx" ON "predictions"("deletedAt");
```

### Updated Prediction Queries

All public-facing prediction queries must add `deletedAt: null` to their where clause, matching the existing comment pattern.

