import type { Metadata, Viewport } from 'next'
import { headers } from 'next/headers'
import { Inter } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import './globals.css'

const inter = Inter({ subsets: ['latin'], display: 'swap' })
import { StagingBanner } from '@/components/StagingBanner'
import { NextBanner } from '@/components/NextBanner'
import Sidebar from '@/components/Sidebar'
import { MainContent } from '@/components/MainContent'
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
      default: 'DAATAN — Prediction Market & Forecast Tracking',
      template: '%s | DAATAN',
    },
    description:
      'DAATAN is a prediction market and forecast tracking platform. Make calibrated forecasts, stake reputation, and prove your accuracy with Brier scores and head-to-head ELO.',
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
      title: 'DAATAN — Prediction Market & Forecast Tracking',
      description:
        'Make calibrated forecasts, stake reputation, and prove your accuracy with Brier scores and head-to-head ELO.',
      url: 'https://daatan.com',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'DAATAN — Prediction Market & Forecast Tracking',
      description:
        'Make calibrated forecasts, stake reputation, and prove your accuracy with Brier scores and head-to-head ELO.',
    },
    alternates: {
      languages: {
        'x-default': 'https://daatan.com',
        'en': 'https://daatan.com',
        'he': 'https://daatan.com/he',
        'ru': 'https://daatan.com/ru',
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
}

function localeFromPathname(pathname: string | null): Locale | null {
  if (!pathname) return null
  const match = pathname.match(/^\/(he|ru|eo)(\/|$)/)
  return (match?.[1] as Locale | undefined) ?? null
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Prefer URL-derived locale (set by middleware) over cookie so crawlers
  // see the correct <html lang> on /he and /ru pages.
  const headersList = await headers()
  const urlLocale = localeFromPathname(headersList.get('x-pathname'))
  const cookieLocale = (await getLocale()) as Locale
  const locale: Locale = urlLocale ?? cookieLocale
  const messages = await getMessages()
  const isStaging = env.NEXT_PUBLIC_ENV === 'staging'
  const gaMeasurementId = isStaging ? 'G-Z4XXM7GYHW' : (process.env.GA_MEASUREMENT_ID ?? '')

  return (
    <html lang={locale} dir={isRtl(locale) ? 'rtl' : 'ltr'} suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <GoogleAnalytics measurementId={gaMeasurementId} isStaging={isStaging} />
        <NextIntlClientProvider messages={messages}>
          <SessionWrapper>
            <AnalyticsUserSync />
            <StagingBanner />
            <NextBanner />
            <div className="flex min-h-screen overflow-x-hidden">
              <Sidebar />
              <MainContent>{children}</MainContent>
            </div>
            <PwaInstaller />
            <PushPermissionPrompt />
            <CookieConsent />
            <Toaster position="bottom-right" />
          </SessionWrapper>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
