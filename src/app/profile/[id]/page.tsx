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

    // Fetch Brier score stats (filtered by tag if selected)
    const brierStats = await prisma.commitment.aggregate({
      where: { userId: user.id, brierScore: { not: null as null }, ...tagFilter },
      _avg: { brierScore: true },
      _count: { brierScore: true },
    })
    const avgBrierScore = brierStats._count.brierScore > 0 && brierStats._avg.brierScore != null
      ? Math.round(brierStats._avg.brierScore * 1000) / 1000
      : null

    // Fetch per-tag RS delta (sum of rsChange for commitments in selected tag)
    const rsTagStats = await prisma.commitment.aggregate({
      where: { userId: user.id, rsChange: { not: null as null }, ...tagFilter },
      _sum: { rsChange: true },
    })
    const rsTagDelta = selectedTag ? (rsTagStats._sum.rsChange ?? null) : null

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
        />
      </>
    )
  } catch (error) {
    createLogger('public-profile').error({ err: error, userId: id }, 'Public profile page error')
    notFound()
  }
}
