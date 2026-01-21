import type { Metadata } from 'next'
import './globals.css'
import { StagingBanner } from '@/components/StagingBanner' // Keep StagingBanner import
import dynamic from 'next/dynamic'
import { ClientOnly } from '@/components/ClientOnly' // Import ClientOnly component

// Dynamically import Sidebar with ssr: false
const DynamicSidebar = dynamic(() => import('@/components/Sidebar'), { ssr: false })

// Define the SessionWrapper component (now Client Component)
// This component will contain SessionProvider and render children
const SessionWrapper = dynamic(() => import('@/components/SessionWrapper'), { ssr: false })

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
            <ClientOnly>
              <DynamicSidebar />
            </ClientOnly>
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
