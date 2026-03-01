import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
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
import { RoleBadge } from '@/components/RoleBadge'

export default async function ProfilePage() {
  const t = await getTranslations('profile')

  try {
    const session = await getServerSession(authOptions)

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

    // Fetch Brier score stats
    const brierStats = await prisma.commitment.aggregate({
      where: { userId: user.id, brierScore: { not: null } },
      _avg: { brierScore: true },
      _count: { brierScore: true },
    })
    const avgBrierScore = brierStats._count.brierScore > 0 && brierStats._avg.brierScore != null
      ? Math.round(brierStats._avg.brierScore * 1000) / 1000
      : null

    // Fetch recent commitments (stakes)
    const commitments = await prisma.commitment.findMany({
      where: { userId: user.id },
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
        <div className="bg-white border border-gray-100 rounded-3xl p-6 sm:p-10 shadow-sm mb-8">
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
              <div className="absolute -bottom-2 -right-2 bg-white p-2 rounded-xl shadow-md border border-gray-50">
                <Award className="w-6 h-6 text-yellow-500" />
              </div>
            </div>

            <div className="flex-1 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                <h1 className="text-3xl sm:text-4xl font-black text-gray-900">{user.name || 'Anonymous'}</h1>
                {user.role && (
                  <RoleBadge role={user.role} size="md" />
                )}
                <Link
                  href="/profile/edit"
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
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
                      className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
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
                      className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      <Twitter className="w-4 h-4" />
                      @{user.twitterHandle}
                    </a>
                  )}
                </div>
              )}

              <div className="flex flex-wrap justify-center md:justify-start gap-4">
                <div className="px-4 py-2 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block">{t('joined')}</span>
                  <span className="text-sm font-bold text-gray-700">{new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                </div>
                <div className="px-4 py-2 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block">{t('predictions')}</span>
                  <span className="text-sm font-bold text-gray-700">{user._count.predictions} {t('created')}</span>
                </div>
                {avgBrierScore !== null && (
                  <div className="px-4 py-2 bg-gray-50 rounded-xl border border-gray-100" title="Brier Score = (probability − outcome)². Lower is better. Only computed when you enter a % yes estimate at stake time.">
                    <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block">{t('brierScore')}</span>
                    <span className="text-sm font-bold text-purple-700">{avgBrierScore.toFixed(3)}</span>
                    <span className="text-[10px] text-gray-400 block">{brierStats._count.brierScore} {t('scored')}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-row md:flex-col gap-4 w-full md:w-auto">
              <div className="flex-1 bg-blue-600 text-white p-6 rounded-3xl shadow-lg shadow-blue-100 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Wallet className="w-4 h-4 text-blue-200" />
                  <span className="text-xs font-bold uppercase tracking-widest text-blue-100">{t('balance')}</span>
                </div>
                <p className="text-3xl font-black">{user.cuAvailable} <span className="text-xl font-medium">CU</span></p>
              </div>
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
              <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
                <History className="w-5 h-5 text-blue-500" />
                {t('recentStakes')}
              </h2>
            </div>
            <div className="space-y-4">
              {commitments.length === 0 ? (
                <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center">
                  <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <TrendingUp className="w-7 h-7 text-blue-400" />
                  </div>
                  <p className="text-gray-500 font-medium mb-4">{t('noStakes')}</p>
                  <Link href="/" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-all">
                    {t('browseForecasts')}
                  </Link>
                </div>
              ) : (
                commitments.map((commitment) => (
                  <div key={commitment.id} className="relative group">
                    <ForecastCard prediction={commitment.prediction as Prediction} />
                    <div className="absolute top-4 right-12 flex items-center gap-2 px-3 py-1 bg-blue-600 text-white text-[10px] font-black uppercase tracking-wider rounded-full shadow-md transform translate-x-4 -translate-y-2">
                      <Wallet className="w-3 h-3" />
                      {t('staked')} {commitment.cuCommitted} CU
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* My Predictions */}
          <section>
            <div className="flex items-center justify-between mb-4 px-2">
              <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
                <Award className="w-5 h-5 text-purple-500" />
                {t('myForecasts')}
              </h2>
            </div>
            <div className="space-y-4">
              {myPredictions.length === 0 ? (
                <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center">
                  <div className="w-14 h-14 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="w-7 h-7 text-purple-400" />
                  </div>
                  <p className="text-gray-500 font-medium mb-4">{t('noForecasts')}</p>
                  <Link href="/create" className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 transition-all">
                    {t('createForecast')}
                  </Link>
                </div>
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
        <div className="bg-red-50 border border-red-200 rounded-3xl p-8 text-center">
          <h1 className="text-2xl font-bold text-red-900 mb-2">{t('errorTitle')}</h1>
          <p className="text-red-700 mb-6">
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
              className="px-6 py-3 bg-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-300 transition-colors"
            >
              {t('signOutAndBack')}
            </Link>
          </div>
        </div>
      </div>
    )
  }
}
