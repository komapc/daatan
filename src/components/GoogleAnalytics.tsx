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
      {/* beforeInteractive runs synchronously before hydration, guaranteeing
          consent is established before the GA library initializes.
          The ESLint rule below is a Pages Router holdover; App Router layouts
          explicitly support beforeInteractive per Next.js docs. */}
      {/* eslint-disable-next-line @next/next/no-before-interactive-script-outside-document */}
      <Script id="google-analytics-consent" strategy="beforeInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          var _storedConsent;
          try { _storedConsent = localStorage.getItem('daatan_analytics_consent'); } catch(e) {}
          gtag('consent', 'default', {
            analytics_storage: _storedConsent === 'granted' ? 'granted' : 'denied',
            ad_storage: 'denied',
            functionality_storage: 'denied',
            personalization_storage: 'denied',
            security_storage: 'granted',
            wait_for_update: _storedConsent ? undefined : 500
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
