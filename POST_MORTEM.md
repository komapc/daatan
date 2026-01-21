# Post-Mortem: Production Downtime - 2026-01-21

## Issue Summary
On January 21, 2026, `daatan.com` experienced significant downtime following attempts to deploy authentication UI features. The site was unreachable (Connection Refused) due to the failure of the Nginx and Application containers to start on the production server.

## Root Causes

1.  **Server Disk Space Exhaustion:** The EC2 instance ran out of disk space (`no space left on device`). This prevented Docker from extracting new image layers, causing deployments to fail silently or with ambiguous errors.
2.  **Next.js Build-Time Hook Violation:** The `useSession()` hook was called in components rendered during the static generation phase without a corresponding `SessionProvider` available in the server-side tree. This was exacerbated by wrapping the provider in a `dynamic(..., {ssr: false})` import, which removed it from the build-time tree entirely.
3.  **Dockerfile Syntax Error:** A comment placed on the same line as a `COPY` instruction was incorrectly parsed by Docker as part of the path, leading to "file not found" errors.
4.  **Docker Compose Variable Syntax:** The use of `$$` (escaped syntax) in `docker-compose.prod.yml` prevented host environment variables (like `POSTGRES_PASSWORD`) from being passed as build arguments.
5.  **Naming Conflict:** A naming conflict between an import named `dynamic` and the Next.js reserved export `export const dynamic = 'force-dynamic'` caused webpack/SWC compilation failures.

## Resolution Actions

1.  **Disk Cleanup:** Reclaimed ~5.8GB of space on the EC2 server using `docker system prune -af`.
2.  **Defanged Components:** Temporarily commented out `useSession` logic to bypass build errors and restore service.
3.  **Corrected Syntax:** Fixed Dockerfile comments and Docker Compose variable interpolation.
4.  **Bulletproof Build Stage:** Added environment variable fallbacks in the `Dockerfile` to ensure `npm run build` always has valid strings during compilation.
5.  **Forced Dynamic Rendering:** Added `export const dynamic = 'force-dynamic'` to the root layout to skip the problematic static generation phase for all pages.

## Future Precautions

### 1. Local Build Mandate
**No Pull Request shall be merged until `npm run build` passes successfully in the developer's local environment.** This catches hook violations and naming conflicts before they reach CI.

### 2. Provider Isolation
All React Context Providers must be placed in a standard `'use client'` component (e.g., `SessionWrapper.tsx`) and imported **without** `{ssr: false}` in the layout. This ensures context is available during prerendering.

### 3. Automated Maintenance
The deployment script (`deploy.sh`) now includes `docker image prune -f` to prevent future disk space issues.

### 4. Build-Time Safety
Components using `useSession` must handle the `undefined` or `loading` states gracefully to avoid destructuring errors if the provider is missing.

## Status
- **Production:** ONLINE
- **Staging:** ONLINE
- **Auth UI:** Temporarily Disabled (Pending Restoration PR)
