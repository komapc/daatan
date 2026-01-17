import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/Sidebar'

export const metadata: Metadata = {
  title: 'DAATAN - Prediction Market',
  description: 'Prove you were right — without shouting into the void.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-white">
        <div className="flex min-h-screen">
          <Sidebar />
          {/* Main content with responsive margin */}
          <main className="flex-1 lg:ml-64 mt-16 lg:mt-0">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
