# SPA Refactor Requirements

## Overview
Evaluate and potentially refactor DAATAN from Next.js App Router (SSR/SSG) to a classical Single Page Application architecture with 2026 best practices.

## Current Architecture
- **Framework**: Next.js 14 with App Router
- **Rendering**: Server-Side Rendering (SSR) + Server Components
- **Routing**: File-based routing with Next.js
- **Data Fetching**: Server Components fetch data on server
- **Deployment**: Standalone Docker build

## Questions to Answer

### 1. Why SPA?
- What problems does the current SSR architecture cause?
- What benefits would pure client-side rendering provide?
- Is this about performance, developer experience, or deployment simplicity?

### 2. SEO Impact
- Do we need search engine indexing for predictions/forecasts?
- Can we afford to lose SSR benefits for initial page load?
- Would we need a separate solution for public pages?

### 3. Technical Approach
If proceeding with SPA:
- **Router**: React Router v6? TanStack Router?
- **State Management**: React Query + Zustand? Redux Toolkit?
- **Build Tool**: Vite? Keep Next.js but disable SSR?
- **API Layer**: Keep existing Next.js API routes or migrate to separate backend?

### 4. Migration Strategy
- Big bang rewrite or incremental migration?
- Can we use Next.js in SPA mode (export static)?
- What's the rollback plan?

## Proposed User Stories

### As a developer
- I want faster local development without SSR overhead
- I want simpler mental model (client-only rendering)
- I want better debugging without server/client boundary issues

### As a user
- I want fast page transitions (no full page reloads)
- I want the app to work offline (with service workers)
- I want instant feedback on interactions

## Acceptance Criteria

### Must Have
1. All current functionality preserved
2. Authentication still works (NextAuth or migrate to client-side auth)
3. API routes accessible from client
4. No performance regression on initial load
5. Mobile experience remains smooth

### Should Have
1. Faster subsequent page navigations
2. Better offline support
3. Simpler deployment (static files)
4. Improved developer experience

### Could Have
1. Progressive Web App (PWA) features
2. Better caching strategies
3. Optimistic UI updates

## Open Questions
1. **Do we actually need this?** Current Next.js setup works well
2. **What's the ROI?** Effort vs benefit analysis needed
3. **User approval?** This is a major architectural decision

## Recommendation
**HOLD** - This requires user input on:
- Why move away from Next.js SSR?
- What specific problems are we solving?
- What's the acceptable tradeoff for SEO/initial load?

Current Next.js 14 App Router is modern and follows 2024-2026 best practices. A "classical SPA" would be a step backward in many ways (SEO, initial load, complexity).

**Alternative**: If the goal is better client-side interactivity, we can:
1. Use more Client Components where needed
2. Add React Query for better data fetching
3. Implement optimistic updates
4. Add service workers for offline support

All without abandoning Next.js benefits.
