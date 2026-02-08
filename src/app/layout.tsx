import type { Metadata, Viewport } from 'next'
import './globals.css'
import { StagingBanner } from '@/components/StagingBanner'
import Sidebar from '@/components/Sidebar'
import SessionWrapper from '@/components/SessionWrapper'

export const metadata: Metadata = {
  title: 'DAATAN - Prediction Market',
  description: 'Prove you were right — without shouting into the void.',
  icons: {
    icon: '/logo-icon.svg',
    apple: '/logo-icon.svg',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-white" suppressHydrationWarning>
        <SessionWrapper>
          <StagingBanner />
          <div className="flex min-h-screen">
            <Sidebar />
            {/* Main content with responsive margin */}
            <main className="flex-1 lg:ml-64 mt-16 lg:mt-0">
              {children}
            </main>
          </div>
        </SessionWrapper>
      </body>
    </html>
  )
}