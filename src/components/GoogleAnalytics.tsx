'use client'

import Script from 'next/script'

interface GoogleAnalyticsProps {
  measurementId: string
}

/**
 * Google Analytics 4 (gtag.js) component.
 * Renders GA scripts only when a valid measurement ID is provided.
 * The measurement ID is passed from the server layout (runtime env var)
 * so each environment (staging/production) can use its own GA property.
 */
const GoogleAnalytics = ({ measurementId }: GoogleAnalyticsProps) => {
  if (!measurementId) return null

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${measurementId}');
        `}
      </Script>
    </>
  )
}

export default GoogleAnalytics
