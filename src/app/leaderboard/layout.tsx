import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Leaderboard',
  description: 'Top forecasters on DAATAN ranked by reputation score, accuracy, and staked Confidence Units.',
  alternates: { canonical: '/leaderboard' },
  openGraph: { url: '/leaderboard', type: 'website' },
}

export default function LeaderboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
