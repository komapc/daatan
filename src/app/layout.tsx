import type { Metadata, Viewport } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import './globals.css'
import { StagingBanner } from '@/components/StagingBanner'
import Sidebar from '@/components/Sidebar'
import SessionWrapper from '@/components/SessionWrapper'
import PwaInstaller from '@/components/PwaInstaller'
import PushPermissionPrompt from '@/components/PushPermissionPrompt'
import GoogleAnalytics from '@/components/GoogleAnalytics'
import CookieConsent from '@/components/CookieConsent'
import AnalyticsUserSync from '@/components/AnalyticsUserSync'
import { Toaster } from 'react-hot-toast'
import { isRtl } from '@/i18n/config'
import type { Locale } from '@/i18n/config'

import { env } from '@/env'

const baseUrl = 'https://daatan.com'

export async function generateMetadata(): Promise<Metadata> {
  const isProd = env.NEXT_PUBLIC_ENV === 'production'

  return {
    metadataBase: new URL(baseUrl),
    title: {
      default: 'DAATAN - Prediction Market',
      template: '%s | DAATAN',
    },
    description: 'Prove you were right — without shouting into the void.',
    icons: {
      icon: [
        { url: '/favicon.ico', sizes: 'any' },
        { url: '/logo-icon.png', type: 'image/png', sizes: '512x512' },
      ],
      apple: '/apple-touch-icon.png',
    },
    manifest: '/manifest.webmanifest',
    verification: {
      google: 'ATwti6XWdVyDu_RJlJhqcBsq-Z_lkjA7nq8ooac',
      other: {
        'msvalidate.01': 'CAFA7BE0D5D83695993D635831499022',
      },
    },
    openGraph: {
      type: 'website',
      siteName: 'DAATAN',
      title: 'DAATAN - Prediction Market',
      description: 'Prove you were right — without shouting into the void.',
      url: 'https://daatan.com',
      images: [{ url: '/logo-icon.png', width: 512, height: 512, alt: 'DAATAN' }],
    },
    twitter: {
      card: 'summary',
      title: 'DAATAN - Prediction Market',
      description: 'Prove you were right — without shouting into the void.',
    },
    alternates: {
      languages: {
        'x-default': 'https://daatan.com',
        'en': 'https://daatan.com',
      },
    },
    robots: {
      index: isProd,
      follow: isProd,
      googleBot: {
        index: isProd,
        follow: isProd,
      },
    },
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const isStaging = env.NEXT_PUBLIC_ENV === 'staging'
  const gaMeasurementId = isStaging ? 'G-Z4XXM7GYHW' : (process.env.GA_MEASUREMENT_ID ?? '')

  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <GoogleAnalytics measurementId={gaMeasurementId} isStaging={isStaging} />
        <SessionWrapper>
          <AnalyticsUserSync />
          <StagingBanner />
          <div className="flex min-h-screen overflow-x-hidden">
            <Sidebar />
            {/* Main content with responsive margin */}
            <main className="flex-1 min-w-0 lg:ml-64 mt-16 lg:mt-0 overflow-x-hidden">
              {children}
            </main>
          </div>
          <PwaInstaller />
          <PushPermissionPrompt />
          <CookieConsent />
          <Toaster position="bottom-right" />
        </SessionWrapper>
      </body>
    </html>
  )
}
