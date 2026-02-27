'use client'

import Script from 'next/script'

interface GoogleAnalyticsProps {
  measurementId: string
  /** When true, enables debug_mode and sets environment: 'staging' in GA */
  isStaging?: boolean
}

/**
 * Google Analytics 4 (gtag.js) component.
 * Renders GA scripts only when a valid measurement ID is provided.
 * The measurement ID is passed from the server layout (runtime env var)
 * so each environment (staging/production) can use its own GA property.
 * Staging adds debug_mode and environment dimension for filtering.
 */
const GoogleAnalytics = ({ measurementId, isStaging = false }: GoogleAnalyticsProps) => {
  if (!measurementId) return null

  const gtagConfig = isStaging
    ? `gtag('config', '${measurementId}', {
    debug_mode: true,
    send_page_view: true
  });
  gtag('set', {
    environment: 'staging'
  });`
    : `gtag('config', '${measurementId}');`

  return (
    <>
      {/* Must run before the GA script so the default consent state is applied
          before any events are sent. Strategy "beforeInteractive" ensures it
          executes synchronously during the initial HTML parse. */}
      <Script id="google-analytics-consent" strategy="beforeInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('consent', 'default', {
            analytics_storage: 'denied',
            ad_storage: 'denied'
          });
        `}
      </Script>
      <Script
        id="google-analytics-external"
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          gtag('js', new Date());
          ${gtagConfig}
        `}
      </Script>
    </>
  )
}

export default GoogleAnalytics
