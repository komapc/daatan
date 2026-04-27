import { prisma } from '@/lib/prisma'
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

interface UserProfileViewProps {
  user: any
  commitments: any[]
  myPredictions: any[]
  avgBrierScore: number | null
  brierCount: number
  isOwnProfile?: boolean
  userTags: { name: string; slug: string }[]
  selectedTag: string | null
  rsTagDelta?: number | null
}

export async function UserProfileView({
  user,
  commitments,
  myPredictions,
  avgBrierScore,
  brierCount,
  isOwnProfile = false,
  userTags,
  selectedTag,
  rsTagDelta = null,
}: UserProfileViewProps) {
  const t = await getTranslations('profile')

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
                <RoleBadge role={user.role} size="md" />
              )}
              {isOwnProfile && (
                <Link
                  href="/profile/edit"
                  className="p-2 hover:bg-navy-700 rounded-lg transition-colors"
                  title="Edit profile"
                >
                  <Settings className="w-5 h-5 text-gray-400 hover:text-gray-600" />
                </Link>
              )}
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
                <span className="text-sm font-bold text-text-secondary">{user._count.predictions} {t('created')}</span>
              </div>
              {avgBrierScore !== null && (
                <div className="px-4 py-2 bg-navy-800 rounded-xl border border-navy-600" title="Brier Score = (probability − outcome)². Lower is better. Only computed when you enter a % yes estimate at stake time.">
                  <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block">
                    {t('brierScore')}{selectedTag ? ` · ${userTags.find(tg => tg.slug === selectedTag)?.name ?? selectedTag}` : ''}
                  </span>
                  <span className="text-sm font-bold text-purple-700">{avgBrierScore.toFixed(3)}</span>
                  <span className="text-[10px] text-gray-400 block">{brierCount} {t('scored')}</span>
                </div>
              )}
              {rsTagDelta !== null && (
                <div className="px-4 py-2 bg-navy-800 rounded-xl border border-navy-600">
                  <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block">RS · {userTags.find(tg => tg.slug === selectedTag)?.name ?? selectedTag}</span>
                  <span className={`text-sm font-bold ${rsTagDelta >= 0 ? 'text-teal' : 'text-red-400'}`}>{rsTagDelta >= 0 ? '+' : ''}{rsTagDelta.toFixed(1)}</span>
                </div>
              )}
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
              {user.mu != null && user.sigma != null && (
                <p className="text-xs text-gray-400 mt-1" title="Glicko-2 skill estimate ± uncertainty. Rank = μ − 3σ (volume-adjusted).">
                  μ {Math.round(user.mu)} ± {Math.round(user.sigma)}
                </p>
              )}
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
                description={isOwnProfile ? t('noStakes') : 'No recent stakes found for this user.'}
                action={isOwnProfile ? { label: t('browseForecasts'), href: '/' } : undefined}
              />
            ) : (
              commitments.map((commitment) => (
                <div key={commitment.id} className="relative group">
                  <ForecastCard prediction={commitment.prediction as Prediction} />
                  <div className="absolute top-4 right-12 flex items-center gap-2 px-3 py-1 bg-blue-600 text-white text-[10px] font-black uppercase tracking-wider rounded-full shadow-md transform translate-x-4 -translate-y-2">
                    <TrendingUp className="w-3 h-3" />
                    {t('staked')}
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
              {isOwnProfile ? t('myForecasts') : 'Public Forecasts'}
            </h2>
          </div>
          <div className="space-y-4">
            {myPredictions.length === 0 ? (
              <EmptyState
                variant="dashed"
                icon={<Sparkles className="w-7 h-7 text-purple-400" />}
                iconBgClass="bg-purple-900/20"
                description={isOwnProfile ? t('noForecasts') : 'No public forecasts found.'}
                action={isOwnProfile ? { label: t('createForecast'), href: '/create', variant: 'purple' } : undefined}
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
}
