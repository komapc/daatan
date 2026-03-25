/**
 * Middleware routing consistency tests.
 *
 * These are static analysis tests — no server is needed. They read source files
 * directly to catch the class of bug that caused the March 2026 redirect loop
 * incident: a mismatch between next-intl routing configuration and the app
 * folder structure.
 *
 * Background:
 *   - next-intl's createMiddleware expects pages to live under src/app/[locale]/
 *   - If localePrefix is 'as-needed' AND pages live under [locale]/, a loop forms:
 *       / -> rewrite to /en (next-intl) -> redirect back to / (strip prefix) -> loop
 *   - The fix was to remove [locale]/ folder AND remove next-intl from middleware.
 *
 * These tests enforce the invariants so the same mistake cannot be reintroduced
 * silently.
 */

import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const ROOT = path.resolve(__dirname, '../..')

const MIDDLEWARE_PATH = path.join(ROOT, 'src/middleware.ts')
const ROUTING_PATH = path.join(ROOT, 'src/i18n/routing.ts')
const LOCALE_APP_DIR = path.join(ROOT, 'src/app/[locale]')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readMiddleware(): string {
  if (!fs.existsSync(MIDDLEWARE_PATH)) {
    throw new Error(`src/middleware.ts not found at ${MIDDLEWARE_PATH}`)
  }
  return fs.readFileSync(MIDDLEWARE_PATH, 'utf-8')
}

function middlewareUsesNextIntl(src: string): boolean {
  // Detect: import ... from 'next-intl/middleware'
  return /from\s+['"]next-intl\/middleware['"]/.test(src)
}

// ---------------------------------------------------------------------------
// Test group 1: Locale folder <-> routing config consistency
//
// Rule: next-intl middleware, routing.ts, and [locale]/ folder must all be
// present together — or all absent. A partial setup produces broken routing.
// ---------------------------------------------------------------------------

describe('Locale folder <-> routing config consistency', () => {
  it('if middleware imports next-intl/middleware, src/i18n/routing.ts must exist', () => {
    const src = readMiddleware()
    const usesNextIntl = middlewareUsesNextIntl(src)

    if (usesNextIntl) {
      expect(
        fs.existsSync(ROUTING_PATH),
        'next-intl middleware is active but src/i18n/routing.ts does not exist. ' +
        'Create routing.ts with locales and defaultLocale, or remove next-intl from middleware.'
      ).toBe(true)
    } else {
      // next-intl not in use — this branch is the "all absent" case, which is fine
      expect(usesNextIntl).toBe(false)
    }
  })

  it('if middleware imports next-intl/middleware, src/app/[locale] directory must exist', () => {
    const src = readMiddleware()
    const usesNextIntl = middlewareUsesNextIntl(src)

    if (usesNextIntl) {
      expect(
        fs.existsSync(LOCALE_APP_DIR),
        'next-intl routing is active but pages are not under [locale] folder. ' +
        'Either move pages under src/app/[locale]/ or remove next-intl from middleware.'
      ).toBe(true)
    } else {
      expect(usesNextIntl).toBe(false)
    }
  })

  it('if src/app/[locale] directory exists, middleware must import next-intl/middleware', () => {
    // Inverse check: [locale]/ folder without next-intl middleware means pages
    // are unreachable — requests go to the [locale] route but no rewrite sets the
    // locale param, so every page returns 404 or a params error.
    if (fs.existsSync(LOCALE_APP_DIR)) {
      const src = readMiddleware()
      expect(
        middlewareUsesNextIntl(src),
        '[locale] folder exists but middleware is not using next-intl routing — ' +
        'pages won\'t be served correctly. Add next-intl createMiddleware to src/middleware.ts ' +
        'or move pages out of the [locale] folder.'
      ).toBe(true)
    } else {
      // [locale] folder absent — nothing to check
      expect(fs.existsSync(LOCALE_APP_DIR)).toBe(false)
    }
  })
})

// ---------------------------------------------------------------------------
// Test group 2: The specific bug — localePrefix: 'as-needed' + [locale] folder
//
// Root cause of the March 2026 incident:
//   - localePrefix: 'as-needed' tells next-intl that the default locale (e.g. en)
//     should NOT appear in the URL — so /en redirects to /
//   - But the [locale] folder structure requires /en/... URLs to exist, meaning
//     next-intl rewrites / to /en internally
//   - This creates an infinite loop: / -> rewrite /en -> redirect / -> repeat
//
// Fix: use localePrefix: 'always' when using [locale] folder, so /en URLs are
// canonical and no redirect is issued for them.
// ---------------------------------------------------------------------------

describe('Redirect loop guard: localePrefix as-needed + [locale] folder', () => {
  it(
    "localePrefix: 'as-needed' combined with [locale] folder creates an infinite redirect loop",
    () => {
      if (!fs.existsSync(ROUTING_PATH) || !fs.existsSync(LOCALE_APP_DIR)) {
        // At least one of the two conditions is absent — no loop possible
        return
      }

      const routingContent = fs.readFileSync(ROUTING_PATH, 'utf-8')
      const hasAsNeeded = /localePrefix\s*:\s*['"]as-needed['"]/.test(routingContent)

      expect(
        hasAsNeeded,
        "localePrefix: 'as-needed' with [locale] folder creates an infinite redirect loop: " +
        '/ rewrites to /en, then /en redirects back to /. ' +
        "Use localePrefix: 'always' when using [locale] folder structure."
      ).toBe(false)
    }
  )
})

// ---------------------------------------------------------------------------
// Test group 3: Middleware matcher safety
//
// Having both a standalone '/' entry AND a catch-all pattern in the matcher
// causes the middleware to run twice on root requests. This can produce
// duplicate header writes, double-redirect logic, or unexpected behaviour
// with some Next.js middleware APIs.
// ---------------------------------------------------------------------------

describe('Middleware matcher safety', () => {
  it('matcher does not contain both standalone "/" and a catch-all pattern', () => {
    const src = readMiddleware()

    // Extract the content of the `matcher` array from the config export.
    // We look for the array literal that follows `matcher:`.
    const matcherMatch = src.match(/matcher\s*:\s*\[([\s\S]*?)\]/)
    if (!matcherMatch) {
      // No matcher array found — nothing to validate
      return
    }

    const matcherContent = matcherMatch[1]

    // Detect a standalone '/' entry (quoted, possibly with surrounding whitespace)
    const hasStandaloneSlash = /['"]\/['"]/.test(matcherContent)

    // Detect a catch-all pattern like /((?!...) or /(.*)
    const hasCatchAll = /['"]\s*\/\s*\(/.test(matcherContent)

    if (hasStandaloneSlash && hasCatchAll) {
      expect(
        false,
        'middleware matcher contains both a standalone "/" entry and a catch-all pattern. ' +
        'This causes the middleware to run twice on root requests. ' +
        'Remove the standalone "/" entry and rely solely on the catch-all pattern, ' +
        'or vice versa.'
      ).toBe(true)
    }

    // If only one or neither is present, the test passes
    expect(!(hasStandaloneSlash && hasCatchAll)).toBe(true)
  })
})
