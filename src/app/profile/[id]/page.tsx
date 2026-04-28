import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { UserProfileView } from '@/components/profile/UserProfileView'

export const dynamic = 'force-dynamic'

interface ProfilePageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tag?: string }>
}

export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
  const { id } = await params
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { id: id },
        { username: id }
      ]
    },
    select: {
      name: true,
      username: true,
    }
  })

  if (!user) {
    return {
      title: 'User Not Found - DAATAN',
    }
  }

  const title = `${user.name} (@${user.username}) - DAATAN Profile`
  const description = `Check out ${user.name}'s prediction track record on DAATAN.`

  return {
    title,
    description,
    alternates: {
      canonical: `https://daatan.com/profile/${user.username}`,
    },
    openGraph: {
      title,
      description,
      type: 'profile',
      url: `https://daatan.com/profile/${user.username}`,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

export default async function PublicProfilePage({ params, searchParams }: ProfilePageProps) {
  const { id } = await params
  const { tag: selectedTag = null } = await searchParams

  // Check session before try/catch — redirect() throws internally and would be
  // caught by the catch block, causing a spurious 404.
  const session = await auth()
  if (session?.user?.id === id) {
    redirect('/profile')
  }

  try {
    // Try to find by ID or Username
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { id: id },
          { username: id }
        ]
      },
      select: {
        id: true,
        name: true,
        image: true,
        username: true,
        role: true,
        website: true,
        twitterHandle: true,
        rs: true,
        mu: true,
        sigma: true,
        eloRating: true,
        totalPredictions: true,
        correctPredictions: true,
        createdAt: true,
        _count: {
          select: {
            predictions: true,
            commitments: true,
          }
        }
      }
    })

    if (!user) {
      notFound()
    }

    // Fetch tags this user has committed on (for tag filter pills)
    const userTags = await prisma.tag.findMany({
      where: {
        predictions: {
          some: { commitments: { some: { userId: user.id } } },
        },
      },
      select: { name: true, slug: true },
      orderBy: { name: 'asc' },
    })

    const tagFilter = selectedTag ? { prediction: { tags: { some: { slug: selectedTag } } } } : {}

    // Fetch Brier, peer, AI, and RS-net stats (all filtered by tag if selected)
    const [brierStats, rsTagStats, peerScoreStats, aiScoreStats, rsNetStats, topicStats] = await Promise.all([
      prisma.commitment.aggregate({
        where: { userId: user.id, brierScore: { not: null as null }, ...tagFilter },
        _avg: { brierScore: true },
        _count: { brierScore: true },
      }),
      prisma.commitment.aggregate({
        where: { userId: user.id, rsChange: { not: null as null }, ...tagFilter },
        _sum: { rsChange: true },
      }),
      prisma.commitment.aggregate({
        where: { userId: user.id, peerScore: { not: null as null }, ...tagFilter },
        _sum: { peerScore: true },
        _count: { peerScore: true },
      }),
      prisma.commitment.aggregate({
        where: { userId: user.id, aiScore: { not: null as null }, ...tagFilter },
        _sum: { aiScore: true },
        _count: { aiScore: true },
      }),
      // For ROI: net RS change across all resolved predictions
      prisma.commitment.aggregate({
        where: { userId: user.id, rsChange: { not: null as null }, ...tagFilter },
        _sum: { rsChange: true },
        _count: { rsChange: true },
      }),
      // Per-topic breakdown: peer score per tag (top 8 tags by prediction count)
      prisma.tag.findMany({
        where: { predictions: { some: { commitments: { some: { userId: user.id, peerScore: { not: null } } } } } },
        select: {
          name: true,
          slug: true,
          predictions: {
            where: { commitments: { some: { userId: user.id, peerScore: { not: null } } } },
            select: {
              commitments: {
                where: { userId: user.id, peerScore: { not: null } },
                select: { peerScore: true },
              },
            },
          },
        },
        take: 8,
      }),
    ])

    const avgBrierScore = brierStats._count.brierScore > 0 && brierStats._avg.brierScore != null
      ? Math.round(brierStats._avg.brierScore * 1000) / 1000
      : null

    // Fetch per-tag RS delta (sum of rsChange for commitments in selected tag)
    const rsTagDelta = selectedTag ? (rsTagStats._sum.rsChange ?? null) : null

    const peerScoreSum = peerScoreStats._count.peerScore > 0 ? (peerScoreStats._sum.peerScore ?? null) : null
    const aiScoreSum = aiScoreStats._count.aiScore > 0 ? (aiScoreStats._sum.aiScore ?? null) : null

    // truthScore: average peer score per prediction (min 3)
    const truthScore = peerScoreStats._count.peerScore >= 3 && peerScoreSum !== null
      ? Math.round((peerScoreSum / peerScoreStats._count.peerScore) * 10000) / 10000
      : null

    // ROI: average net RS change per resolved prediction (min 3)
    const roi = rsNetStats._count.rsChange >= 3
      ? Math.round(((rsNetStats._sum.rsChange ?? 0) / rsNetStats._count.rsChange) * 100) / 100
      : null

    // Per-topic peer score summary
    const topicBreakdown = topicStats.map(tag => {
      const allScores = tag.predictions.flatMap(p => p.commitments.map(c => c.peerScore!))
      const sum = allScores.reduce((a, b) => a + b, 0)
      return {
        name: tag.name,
        slug: tag.slug,
        count: allScores.length,
        peerScoreAvg: allScores.length > 0 ? Math.round((sum / allScores.length) * 10000) / 10000 : 0,
      }
    }).sort((a, b) => b.count - a.count)

    // Fetch recent commitments (stakes) - only public ones, filtered by tag if selected
    const commitments = await prisma.commitment.findMany({
      where: {
        userId: user.id,
        prediction: { isPublic: true, ...(selectedTag ? { tags: { some: { slug: selectedTag } } } : {}) },
      },
      include: {
        prediction: {
          include: {
            author: {
              select: {
                id: true,
                name: true,
                username: true,
                image: true,
                rs: true,
                role: true,
              },
            },
            _count: {
              select: { commitments: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })

    // Fetch predictions created by user - only public ones
    const myPredictions = await prisma.prediction.findMany({
      where: { 
        authorId: user.id,
        isPublic: true
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true,
            rs: true,
            role: true,
          },
        },
        _count: {
          select: { commitments: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })

    const personJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: user.name,
      identifier: `@${user.username}`,
      url: `https://daatan.com/profile/${user.username}`,
      ...(user.image && { image: user.image }),
      ...(user.website && { sameAs: [user.website] }),
    }

    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }}
        />
        <UserProfileView
          user={user}
          commitments={commitments}
          myPredictions={myPredictions}
          avgBrierScore={avgBrierScore}
          brierCount={brierStats._count.brierScore}
          isOwnProfile={false}
          userTags={userTags}
          selectedTag={selectedTag}
          rsTagDelta={rsTagDelta}
          peerScoreSum={peerScoreSum}
          peerScoreCount={peerScoreStats._count.peerScore}
          aiScoreSum={aiScoreSum}
          aiScoreCount={aiScoreStats._count.aiScore}
          eloRating={user.eloRating}
          truthScore={truthScore}
          roi={roi}
          topicBreakdown={topicBreakdown}
        />
      </>
    )
  } catch (error) {
    createLogger('public-profile').error({ err: error, userId: id }, 'Public profile page error')
    notFound()
  }
}
