/**
 * Thin wrapper around window.gtag so callers don't need to type-guard
 * every call site. Safe to call when GA is not loaded (e.g. dev, consent denied).
 */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}

export function trackEvent(
  name: string,
  params?: Record<string, string | number | boolean>,
) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
  window.gtag('event', name, params)
}

// ── Named events ─────────────────────────────────────────────────────────────

export const analytics = {
  forecastCreated(params: { outcome_type: string; is_express: boolean }) {
    trackEvent('forecast_created', params)
  },
  commitmentMade(params: { forecast_id: string; cu_committed: number }) {
    trackEvent('commitment_made', params)
  },
  commentPosted(params: { is_reply: boolean }) {
    trackEvent('comment_posted', params)
  },
  signIn(params: { method: string }) {
    trackEvent('login', params)
  },
}
