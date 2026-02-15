import type { Metadata, Viewport } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import './globals.css'
import { StagingBanner } from '@/components/StagingBanner'
import Sidebar from '@/components/Sidebar'
import SessionWrapper from '@/components/SessionWrapper'
import PwaInstaller from '@/components/PwaInstaller'
import GoogleAnalytics from '@/components/GoogleAnalytics'
import { isRtl } from '@/i18n/config'
import type { Locale } from '@/i18n/config'

export const metadata: Metadata = {
  title: 'DAATAN - Prediction Market',
  description: 'Prove you were right — without shouting into the void.',
  icons: {
    icon: '/logo-icon.svg',
    apple: '/logo-icon.svg',
  },
  manifest: '/manifest.webmanifest',
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
  const locale = await getLocale() as Locale
  const messages = await getMessages()
  const gaMeasurementId = process.env.GA_MEASUREMENT_ID ?? ''

  return (
    <html lang={locale} dir={isRtl(locale) ? 'rtl' : 'ltr'} suppressHydrationWarning>
      <body className="bg-white" suppressHydrationWarning>
        <GoogleAnalytics measurementId={gaMeasurementId} />
        <NextIntlClientProvider messages={messages}>
          <SessionWrapper>
            <StagingBanner />
            <div className="flex min-h-screen overflow-x-hidden">
              <Sidebar />
              {/* Main content with responsive margin */}
              <main className="flex-1 min-w-0 lg:ml-64 mt-16 lg:mt-0 overflow-x-hidden">
                {children}
              </main>
            </div>
            <PwaInstaller />
          </SessionWrapper>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
