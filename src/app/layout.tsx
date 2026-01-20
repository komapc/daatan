import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/Sidebar' // Uncomment this import
import { StagingBanner } from '@/components/StagingBanner'
import { SessionProvider } from 'next-auth/react' // Directly import SessionProvider
import dynamic from 'next/dynamic'
import { ClientOnly } from '@/components/ClientOnly' // Import ClientOnly component

// Dynamically import Sidebar with ssr: false
const DynamicSidebar = dynamic(() => import('@/components/Sidebar'), { ssr: false })

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
    <html lang="en" suppressHydrationWarning={true}> {/* Add suppressHydrationWarning */}
      <body className="bg-white">
        <SessionProvider> {/* Use SessionProvider directly */}
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
        </SessionProvider>
      </body>
    </html>
  )
}
