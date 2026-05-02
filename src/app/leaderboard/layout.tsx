import type { Metadata } from 'next'
import { getLeaderboard } from '@/lib/services/leaderboard'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'Leaderboard',
  description: 'Top forecasters on DAATAN ranked by reputation score, accuracy, and staked Confidence Units.',
  alternates: { canonical: '/leaderboard' },
  openGraph: { url: '/leaderboard', type: 'website' },
}

export default async function LeaderboardLayout({ children }: { children: React.ReactNode }) {
  let topUsers: Array<{ id: string; name: string | null; username: string | null }> = []
  try {
    topUsers = (await getLeaderboard(10, 'rs')) ?? []
  } catch {
    topUsers = []
  }

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'DAATAN Leaderboard',
    description: 'Top forecasters on DAATAN ranked by reputation score.',
    numberOfItems: topUsers.length,
    itemListElement: topUsers.map((u, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `https://daatan.com/profile/${u.username ?? u.id}`,
      name: u.name ?? u.username ?? 'Anonymous',
    })),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      {children}
    </>
  )
}
