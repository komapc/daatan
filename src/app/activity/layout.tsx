import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Activity',
  description: 'Live feed of recent forecast activity on DAATAN — new predictions, commitments, and resolutions.',
  alternates: { canonical: '/activity' },
  openGraph: { url: '/activity', type: 'website' },
}

export default function ActivityLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
