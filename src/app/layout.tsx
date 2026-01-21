import type { Metadata } from 'next'
import './globals.css'
import { StagingBanner } from '@/components/StagingBanner'
import dynamic from 'next/dynamic'

// Dynamically import Sidebar with ssr: false
const DynamicSidebar = dynamic(() => import('@/components/Sidebar'), { ssr: false })

// Dynamically import SessionWrapper (Allow SSR to provide context during build)
const SessionWrapper = dynamic(() => import('@/components/SessionWrapper'))

export const metadata: Metadata = {
  title: 'DAATAN - Prediction Market',
  description: 'Prove you were right — without shouting into the void.',
  icons: {
    icon: '/logo-icon.svg',
    apple: '/logo-icon.svg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning={true}>
      <body className="bg-white">
        <SessionWrapper>
          <StagingBanner />
          <div className="flex min-h-screen">
            <DynamicSidebar />
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
