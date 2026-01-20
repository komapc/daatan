import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/Sidebar'
import { StagingBanner } from '@/components/StagingBanner'
import { Providers } from '@/components/Providers'

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
    <html lang="en">
      <body className="bg-white">
        <Providers>
          <StagingBanner />
          <div className="flex min-h-screen">
            <Sidebar />
            {/* Main content with responsive margin */}
            <main className="flex-1 lg:ml-64 mt-16 lg:mt-0">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  )
}
