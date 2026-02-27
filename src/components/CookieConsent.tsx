'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'daatan_analytics_consent'

type ConsentValue = 'granted' | 'denied'

function getStoredConsent(): ConsentValue | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'granted' || v === 'denied') return v
  } catch {
    // localStorage unavailable (SSR, private mode)
  }
  return null
}

function applyConsent(value: ConsentValue) {
  if (typeof window === 'undefined') return
  // Ensure dataLayer and gtag exist before calling — the GA script may not have
  // loaded yet when this runs (both are afterInteractive). Defining them here
  // queues the consent update so gtag will process it when it initializes.
  window.dataLayer = window.dataLayer || []
  if (typeof window.gtag !== 'function') {
    // Define a minimal gtag that queues commands in dataLayer (same pattern as GA).
    // The real gtag will pick up and process the queued items when it loads.
    window.gtag = (...args: unknown[]) => window.dataLayer!.push(args)
  }
  window.gtag('consent', 'update', {
    analytics_storage: value,
    ad_storage: 'denied', // we never use ads
  })
}

/**
 * Shows a minimal GDPR/CCPA consent banner on first visit.
 * - Sets gtag consent to 'denied' by default (done in GoogleAnalytics.tsx).
 * - On accept: updates consent to 'granted' and persists to localStorage.
 * - On decline: persists 'denied', banner disappears.
 * - On subsequent visits: reads from localStorage and applies silently.
 */
export default function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const stored = getStoredConsent()
    if (stored !== null) {
      // Already decided — apply silently and do not show banner
      applyConsent(stored)
      return
    }
    setVisible(true)
  }, [])

  const handleAccept = () => {
    try { localStorage.setItem(STORAGE_KEY, 'granted') } catch { /* ignore */ }
    applyConsent('granted')
    setVisible(false)
  }

  const handleDecline = () => {
    try { localStorage.setItem(STORAGE_KEY, 'denied') } catch { /* ignore */ }
    // consent stays 'denied' (default already set in GoogleAnalytics)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white border-t border-gray-200 shadow-lg">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <p className="flex-1 text-sm text-gray-600">
          We use analytics cookies to understand how the app is used and improve it.
          No ads. No cross-site tracking.{' '}
        </p>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={handleDecline}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Decline
          </button>
          <button
            onClick={handleAccept}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  )
}
