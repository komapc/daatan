import { notFound, redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { UserProfileView } from '@/components/profile/UserProfileView'

export const dynamic = 'force-dynamic'

interface ProfilePageProps {
  params: Promise<{ id: string }>
}

export default async function PublicProfilePage({ params }: ProfilePageProps) {
  const { id } = await params
  
  try {
    const session = await getServerSession(authOptions)

    // If it's the current user's ID, redirect to their private profile
    if (session?.user?.id === id) {
      redirect('/profile')
    }

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

    // Fetch Brier score stats
    const brierStats = await prisma.commitment.aggregate({
      where: { userId: user.id, brierScore: { not: null } },
      _avg: { brierScore: true },
      _count: { brierScore: true },
    })
    const avgBrierScore = brierStats._count.brierScore > 0 && brierStats._avg.brierScore != null
      ? Math.round(brierStats._avg.brierScore * 1000) / 1000
      : null

    // Fetch recent commitments (stakes) - only public ones
    const commitments = await prisma.commitment.findMany({
      where: { 
        userId: user.id,
        prediction: { isPublic: true }
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

    return (
      <UserProfileView
        user={user}
        commitments={commitments}
        myPredictions={myPredictions}
        avgBrierScore={avgBrierScore}
        brierCount={brierStats._count.brierScore}
        isOwnProfile={false}
      />
    )
  } catch (error) {
    createLogger('public-profile').error({ err: error, userId: id }, 'Public profile page error')
    notFound()
  }
}
