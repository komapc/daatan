import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { getTranslations } from 'next-intl/server'
import Image from 'next/image'
import {
  User as UserIcon,
  TrendingUp,
  Wallet,
  History,
  Award,
  Calendar,
  Settings,
  Globe,
  Twitter,
  Sparkles,
} from 'lucide-react'
import ForecastCard, { type Prediction } from '@/components/forecasts/ForecastCard'
import Link from 'next/link'
import EmptyState from '@/components/ui/EmptyState'
import { RoleBadge } from '@/components/RoleBadge'
import { TagFilter } from '@/components/profile/TagFilter'
import { GlickoChart } from '@/components/profile/GlickoChart'

interface ProfilePageProps {
  searchParams: Promise<{ tag?: string }>
}

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const t = await getTranslations('profile')
  const { tag: selectedTag = null } = await searchParams

  try {
    const session = await auth()

    if (!session?.user?.id) {
      redirect('/auth/signin?callbackUrl=/profile')
    }

    // Fetch full user data including stats
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        username: true,
        role: true,
        website: true,
        twitterHandle: true,
        rs: true,
        cuAvailable: true,
        cuLocked: true,
        eloRating: true,
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
      redirect('/')
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
    const [brierStats, rsTagStats, peerScoreStats, aiScoreStats, rsNetStats, topicStats, createdCount, participatedCount] = await Promise.all([
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
      prisma.commitment.aggregate({
        where: { userId: user.id, rsChange: { not: null as null }, ...tagFilter },
        _sum: { rsChange: true },
        _count: { rsChange: true },
      }),
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
      prisma.prediction.count({
        where: { authorId: user.id, ...(selectedTag ? { tags: { some: { slug: selectedTag } } } : {}) },
      }),
      prisma.commitment.count({
        where: { userId: user.id, ...(selectedTag ? { prediction: { tags: { some: { slug: selectedTag } } } } : {}) },
      }),
    ])

    const avgBrierScore = brierStats._count.brierScore > 0 && brierStats._avg.brierScore != null
      ? Math.round(brierStats._avg.brierScore * 1000) / 1000
      : null

    const rsTagDelta = selectedTag ? (rsTagStats._sum.rsChange ?? null) : null
    const peerScoreSum = peerScoreStats._count.peerScore > 0 ? (peerScoreStats._sum.peerScore ?? null) : null
    const aiScoreSum = aiScoreStats._count.aiScore > 0 ? (aiScoreStats._sum.aiScore ?? null) : null

    const truthScore = peerScoreStats._count.peerScore >= 3 && peerScoreSum !== null
      ? Math.round((peerScoreSum / peerScoreStats._count.peerScore) * 10000) / 10000
      : null

    const roi = rsNetStats._count.rsChange >= 3
      ? Math.round(((rsNetStats._sum.rsChange ?? 0) / rsNetStats._count.rsChange) * 100) / 100
      : null

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

    // Fetch recent commitments (stakes), filtered by tag if selected
    const commitments = await prisma.commitment.findMany({
      where: {
        userId: user.id,
        ...(selectedTag ? { prediction: { tags: { some: { slug: selectedTag } } } } : {}),
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

    // Fetch predictions created by user
    const myPredictions = await prisma.prediction.findMany({
      where: { authorId: user.id },
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
      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
        {/* Profile Header */}
        <div className="bg-navy-700 border border-navy-600 rounded-3xl p-6 sm:p-10 shadow-sm mb-8">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="relative">
              {user.image ? (
                <Image
                  src={user.image}
                  alt={user.name || ''}
                  width={128}
                  height={128}
                  className="rounded-3xl object-cover ring-4 ring-blue-50"
                />
              ) : (
                <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-3xl bg-blue-100 flex items-center justify-center text-4xl font-black text-blue-600 ring-4 ring-blue-50">
                  {user.name?.charAt(0) || user.username?.charAt(0) || '?'}
                </div>
              )}
              <div className="absolute -bottom-2 -right-2 bg-navy-700 p-2 rounded-xl shadow-md border border-gray-50">
                <Award className="w-6 h-6 text-yellow-500" />
              </div>
            </div>

            <div className="flex-1 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                <h1 className="text-3xl sm:text-4xl font-black text-white">{user.name || 'Anonymous'}</h1>
                {user.role && (
                  <RoleBadge role={user.role as any} size="md" />
                )}
                <Link
                  href="/profile/edit"
                  className="p-2 hover:bg-navy-700 rounded-lg transition-colors"
                  title="Edit profile"
                >
                  <Settings className="w-5 h-5 text-gray-400 hover:text-gray-600" />
                </Link>
              </div>
              <p className="text-gray-500 font-medium mb-2">{user.username ? `@${user.username}` : user.email}</p>

              {/* Social Links */}
              {(user.website || user.twitterHandle) && (
                <div className="flex items-center justify-center md:justify-start gap-3 mb-4">
                  {user.website && (
                    <a
                      href={user.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-sm text-blue-600 hover:text-cobalt-light font-medium"
                    >
                      <Globe className="w-4 h-4" />
                      {t('website')}
                    </a>
                  )}
                  {user.twitterHandle && (
                    <a
                      href={`https://twitter.com/${user.twitterHandle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-sm text-blue-600 hover:text-cobalt-light font-medium"
                    >
                      <Twitter className="w-4 h-4" />
                      @{user.twitterHandle}
                    </a>
                  )}
                </div>
              )}

              <div className="flex flex-wrap justify-center md:justify-start gap-4">
                <div className="px-4 py-2 bg-navy-800 rounded-xl border border-navy-600">
                  <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block">{t('joined')}</span>
                  <span className="text-sm font-bold text-text-secondary">{new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                </div>
                <div className="px-4 py-2 bg-navy-800 rounded-xl border border-navy-600">
                  <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block">{t('predictions')}</span>
                  <span className="text-sm font-bold text-text-secondary">{createdCount} {t('created')}</span>
                  <span className="text-[10px] text-gray-400 block">{participatedCount} {t('participated')}</span>
                </div>
                {avgBrierScore !== null && (
                  <div className="px-4 py-2 bg-navy-800 rounded-xl border border-navy-600" title="Brier Score = (probability − outcome)². Lower is better. Only computed when you enter a % yes estimate at stake time.">
                    <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block">
                      {t('brierScore')}{selectedTag ? ` · ${userTags.find(tag => tag.slug === selectedTag)?.name ?? selectedTag}` : ''}
                    </span>
                    <span className="text-sm font-bold text-purple-700">{avgBrierScore.toFixed(3)}</span>
                    <span className="text-[10px] text-gray-400 block">{brierStats._count.brierScore} {t('scored')}</span>
                  </div>
                )}
                {rsTagDelta !== null && (
                  <div className="px-4 py-2 bg-navy-800 rounded-xl border border-navy-600">
                    <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block">RS · {userTags.find(tag => tag.slug === selectedTag)?.name ?? selectedTag}</span>
                    <span className={`text-sm font-bold ${rsTagDelta >= 0 ? 'text-teal' : 'text-red-400'}`}>{rsTagDelta >= 0 ? '+' : ''}{rsTagDelta.toFixed(1)}</span>
                  </div>
                )}
                {peerScoreSum !== null && (
                  <div className="px-4 py-2 bg-navy-800 rounded-xl border border-navy-600" title="Peer Score = how much better you were than the community consensus at commit time. Positive = beat the crowd.">
                    <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block">
                      Peer Score{selectedTag ? ` · ${userTags.find(tag => tag.slug === selectedTag)?.name ?? selectedTag}` : ''}
                    </span>
                    <span className={`text-sm font-bold ${peerScoreSum >= 0 ? 'text-teal' : 'text-red-400'}`}>{peerScoreSum >= 0 ? '+' : ''}{peerScoreSum.toFixed(2)}</span>
                    <span className="text-[10px] text-gray-400 block">{peerScoreStats._count.peerScore} scored</span>
                  </div>
                )}
                {aiScoreSum !== null && (
                  <div className="px-4 py-2 bg-navy-800 rounded-xl border border-navy-600" title="AI Score = how much better you were than the AI estimate at commit time. Positive = beat the AI.">
                    <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block">
                      AI Score{selectedTag ? ` · ${userTags.find(tag => tag.slug === selectedTag)?.name ?? selectedTag}` : ''}
                    </span>
                    <span className={`text-sm font-bold ${aiScoreSum >= 0 ? 'text-teal' : 'text-red-400'}`}>{aiScoreSum >= 0 ? '+' : ''}{aiScoreSum.toFixed(2)}</span>
                    <span className="text-[10px] text-gray-400 block">{aiScoreStats._count.aiScore} scored</span>
                  </div>
                )}
                <div className="px-4 py-2 bg-navy-800 rounded-xl border border-navy-600" title="ELO head-to-head rating. Updated each time a prediction resolves and you are compared against other committers.">
                  <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block">ELO Rating</span>
                  <span className="text-sm font-bold text-blue-400">{Math.round(user.eloRating)}</span>
                  <span className="text-[10px] text-gray-400 block">global</span>
                </div>
                {truthScore !== null && (
                  <div className="px-4 py-2 bg-navy-800 rounded-xl border border-navy-600" title="TruthScore = average peer score per prediction. How consistently you beat the community consensus.">
                    <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block">TruthScore</span>
                    <span className={`text-sm font-bold ${truthScore >= 0 ? 'text-teal' : 'text-red-400'}`}>{truthScore >= 0 ? '+' : ''}{truthScore.toFixed(4)}</span>
                    <span className="text-[10px] text-gray-400 block">avg / prediction</span>
                  </div>
                )}
                {roi !== null && (
                  <div className="px-4 py-2 bg-navy-800 rounded-xl border border-navy-600" title="ROI = average net RS change per resolved prediction.">
                    <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block">ROI</span>
                    <span className={`text-sm font-bold ${roi >= 0 ? 'text-teal' : 'text-red-400'}`}>{roi >= 0 ? '+' : ''}{roi.toFixed(2)}</span>
                    <span className="text-[10px] text-gray-400 block">RS / prediction</span>
                  </div>
                )}
              </div>

              {/* Per-topic breakdown */}
              {topicBreakdown.length > 0 && !selectedTag && (
                <div className="mt-4">
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-2">{t('topicBreakdown')}</p>
                  <div className="flex flex-wrap gap-2">
                    {topicBreakdown.map(topic => (
                      <div key={topic.slug} className="flex items-center gap-1.5 px-3 py-1.5 bg-navy-800 rounded-lg border border-navy-600 text-xs">
                        <span className="text-gray-300 font-medium">{topic.name}</span>
                        <span className={`font-bold ${topic.peerScoreAvg >= 0 ? 'text-teal' : 'text-red-400'}`}>
                          {topic.peerScoreAvg >= 0 ? '+' : ''}{topic.peerScoreAvg.toFixed(3)}
                        </span>
                        <span className="text-gray-500">({topic.count})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Glicko-2 skill history chart */}
              <div className="mt-4 bg-navy-800 rounded-xl border border-navy-600 p-3">
                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-2">
                  Skill Rating History{selectedTag ? ` · ${userTags.find(tag => tag.slug === selectedTag)?.name ?? selectedTag}` : ''}
                </p>
                <GlickoChart userId={user.id} selectedTag={selectedTag} />
              </div>

              <TagFilter tags={userTags} selectedTag={selectedTag} />
            </div>

            <div className="flex flex-row md:flex-col gap-4 w-full md:w-auto">
              <div className="flex-1 bg-gray-900 text-white p-6 rounded-3xl shadow-lg shadow-gray-200 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-green-400" />
                  <span className="text-xs font-bold uppercase tracking-widest text-gray-400">{t('reputation')}</span>
                </div>
                <p className="text-3xl font-black">{user.rs.toFixed(1)} <span className="text-xl font-medium">RS</span></p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Stakes */}
          <section>
            <div className="flex items-center justify-between mb-4 px-2">
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                <History className="w-5 h-5 text-blue-500" />
                {t('recentStakes')}
              </h2>
            </div>
            <div className="space-y-4">
              {commitments.length === 0 ? (
                <EmptyState
                  variant="dashed"
                  icon={<TrendingUp className="w-7 h-7 text-blue-400" />}
                  iconBgClass="bg-cobalt/10"
                  description={t('noStakes')}
                  action={{ label: t('browseForecasts'), href: '/' }}
                />
              ) : (
                commitments.map((commitment) => (
                  <div key={commitment.id} className="relative group">
                    <ForecastCard prediction={commitment.prediction as Prediction} />
                    <div className="absolute top-4 right-12 flex items-center gap-2 px-3 py-1 bg-blue-600 text-white text-[10px] font-black uppercase tracking-wider rounded-full shadow-md transform translate-x-4 -translate-y-2">
                      <Wallet className="w-3 h-3" />
                      {commitment.prediction._count.commitments} {t('participants')}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* My Predictions */}
          <section>
            <div className="flex items-center justify-between mb-4 px-2">
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                <Award className="w-5 h-5 text-purple-500" />
                {t('myForecasts')}
              </h2>
            </div>
            <div className="space-y-4">
              {myPredictions.length === 0 ? (
                <EmptyState
                  variant="dashed"
                  icon={<Sparkles className="w-7 h-7 text-purple-400" />}
                  iconBgClass="bg-purple-900/20"
                  description={t('noForecasts')}
                  action={{ label: t('createForecast'), href: '/create', variant: 'purple' }}
                />
              ) : (
                myPredictions.map((prediction) => (
                  <ForecastCard key={prediction.id} prediction={prediction as Prediction} />
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    )
  } catch (error) {
    createLogger('profile').error({ err: error }, 'Profile page error')
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
        <div className="bg-red-900/20 border border-red-800/50 rounded-3xl p-8 text-center">
          <h1 className="text-2xl font-bold text-red-900 mb-2">{t('errorTitle')}</h1>
          <p className="text-red-400 mb-6">
            {t('errorDesc')}
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/"
              className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors"
            >
              {t('goToFeed')}
            </Link>
            <Link
              href="/auth/signin"
              className="px-6 py-3 bg-navy-600 text-text-secondary font-bold rounded-xl hover:bg-gray-300 transition-colors"
            >
              {t('signOutAndBack')}
            </Link>
          </div>
        </div>
      </div>
    )
  }
}
