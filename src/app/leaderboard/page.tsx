'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Trophy, Loader2, Medal, TrendingUp, Wallet, Target, BarChart3, TrendingDown, Zap } from 'lucide-react'
import EmptyState from '@/components/ui/EmptyState'
import { createClientLogger } from '@/lib/client-logger'
import { useTranslations } from 'next-intl'

const log = createClientLogger('Leaderboard')

type SortBy = 'rs' | 'accuracy' | 'totalCorrect' | 'cuCommitted' | 'brierScore' | 'roi' | 'truthScore'

type LeaderboardUser = {
  id: string
  name: string | null
  username: string | null
  image: string | null
  rs: number
  cuAvailable: number
  totalCommitments: number
  totalPredictions: number
  totalCorrect: number
  totalResolved: number
  accuracy: number | null
  totalCuCommitted: number
  totalRsGained: number
  avgBrierScore: number | null
  brierCount: number
  roi: number | null
  truthScore: number | null
}

export default function LeaderboardPage() {
  const t = useTranslations('leaderboard')
  const router = useRouter()
  const [users, setUsers] = useState<LeaderboardUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [sortBy, setSortBy] = useState<SortBy>('rs')

  const SORT_OPTIONS: { value: SortBy; label: string; icon: typeof TrendingUp; soon?: boolean }[] = [
    { value: 'rs', label: t('sortBy.reputation'), icon: TrendingUp },
    { value: 'accuracy', label: t('sortBy.accuracy'), icon: Target },
    { value: 'totalCorrect', label: t('sortBy.mostCorrect'), icon: BarChart3 },
    { value: 'cuCommitted', label: t('sortBy.cuCommitted'), icon: Wallet },
    { value: 'brierScore', label: t('sortBy.brierScore'), icon: TrendingDown },
    { value: 'roi', label: t('sortBy.roi'), icon: Zap },
    { value: 'truthScore', label: t('sortBy.truthScore'), icon: Target, soon: true },
  ]

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setIsLoading(true)
      try {
        const response = await fetch(`/api/leaderboard?limit=50&sortBy=${sortBy}`)
        if (response.ok) {
          const data = await response.json()
          setUsers(data.leaderboard)
        }
      } catch (error) {
        log.error({ err: error }, 'Error fetching leaderboard')
      } finally {
        setIsLoading(false)
      }
    }

    fetchLeaderboard()
  }, [sortBy])

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0: return <Medal className="w-6 h-6 text-yellow-500" />
      case 1: return <Medal className="w-6 h-6 text-gray-400" />
      case 2: return <Medal className="w-6 h-6 text-amber-600" />
      default: return <span className="text-lg font-bold text-gray-400 w-6 text-center">{index + 1}</span>
    }
  }

  const getHighlightValue = (user: LeaderboardUser) => {
    switch (sortBy) {
      case 'accuracy':    return user.accuracy !== null ? `${user.accuracy}%` : '—'
      case 'totalCorrect': return `${user.totalCorrect}`
      case 'cuCommitted':  return `${user.totalCuCommitted}`
      case 'brierScore':   return user.avgBrierScore !== null ? user.avgBrierScore.toFixed(3) : '—'
      case 'roi':          return user.roi !== null ? `${user.roi > 0 ? '+' : ''}${user.roi.toFixed(1)}%` : '—'
      case 'truthScore':   return user.truthScore !== null ? user.truthScore.toFixed(3) : '—'
      default:             return user.rs.toFixed(1)
    }
  }

  const getHighlightLabel = () => {
    switch (sortBy) {
      case 'accuracy':    return t('sortBy.accuracy')
      case 'totalCorrect': return t('correct')
      case 'cuCommitted':  return t('sortBy.cuCommitted')
      case 'brierScore':   return `${t('sortBy.brierScore')} ↓`
      case 'roi':          return t('sortBy.roi')
      case 'truthScore':   return t('sortBy.truthScore')
      default:             return t('sortBy.reputation')
    }
  }

  const getHighlightColor = (user: LeaderboardUser) => {
    if (sortBy === 'roi' && user.roi !== null) {
      return user.roi > 0 ? 'text-green-400' : user.roi < 0 ? 'text-red-400' : 'text-white'
    }
    return 'text-white'
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col items-center text-center mb-8">
        <div className="p-4 bg-amber-900/20 rounded-2xl mb-4">
          <Trophy className="w-10 h-10 sm:w-12 sm:h-12 text-yellow-500" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-white mb-2 tracking-tight">{t('title')}</h1>
        <p className="text-gray-500 max-w-md">{t('subtitle')}</p>
      </div>

      {/* Sort Tabs — scrollable on mobile */}
      <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-1 scrollbar-hide">
        {SORT_OPTIONS.map(({ value, label, icon: Icon, soon }) => (
          <button
            key={value}
            onClick={() => !soon && setSortBy(value)}
            disabled={soon}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${
              soon
                ? 'bg-navy-800 text-gray-600 cursor-not-allowed'
                : sortBy === value
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-navy-700 text-text-secondary hover:bg-navy-600'
            }`}
            aria-label={`Sort by ${label}`}
          >
            <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            {label}
            {soon && (
              <span className="ml-1 text-[9px] font-bold uppercase tracking-wide text-gray-500 bg-navy-700 px-1 py-0.5 rounded">
                {t('soon')}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Leaderboard Table */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
          <p className="text-gray-500 font-medium">{t('calculating')}</p>
        </div>
      ) : users.length === 0 ? (
        <EmptyState
          variant="card"
          icon={<Trophy className="w-10 h-10 text-yellow-500" />}
          iconBgClass="bg-amber-900/20"
          title={t('noUsers')}
          description={t('noUsersDesc')}
          action={{ label: t('browseForecasts'), href: '/' }}
        />
      ) : (
        <div className="bg-navy-700 border border-navy-600 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-navy-800 border-b border-navy-600">
                <th className="px-3 sm:px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-12 sm:w-16">{t('rank')}</th>
                <th className="px-3 sm:px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">{t('predictor')}</th>
                <th className="px-3 sm:px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center hidden md:table-cell">{t('sortBy.accuracy')}</th>
                <th className="px-3 sm:px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center hidden md:table-cell">{t('correct')}</th>
                <th className="px-3 sm:px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">{getHighlightLabel()}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100/10">
              {users.map((user, index) => (
                <tr
                  key={user.id}
                  onClick={() => router.push(`/profile/${user.id}`)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(`/profile/${user.id}`) } }}
                  role="button"
                  tabIndex={0}
                  aria-label={`View profile of ${user.name || user.username || 'user'}`}
                  className={`cursor-pointer hover:bg-white/5 focus:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 transition-colors ${index < 3 ? 'bg-amber-400/5' : ''}`}
                >
                  <td className="px-3 sm:px-6 py-3 sm:py-4">
                    <div className="flex justify-center">
                      {getRankIcon(index)}
                    </div>
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4">
                    <div className="flex items-center gap-2 sm:gap-3">
                      {user.image ? (
                        <Image src={user.image} alt="" width={36} height={36} className="rounded-full border border-navy-600 w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0" />
                      ) : (
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm flex-shrink-0">
                          {user.name?.charAt(0) || user.username?.charAt(0) || '?'}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-bold text-white truncate text-sm sm:text-base">
                          {user.name || user.username || 'Anonymous'}
                        </p>
                        {/* On mobile: show key stats inline since table columns are hidden */}
                        <p className="text-xs text-gray-500 truncate">
                          {user.username ? `@${user.username}` : ''}
                          <span className="md:hidden">
                            {user.username ? ' · ' : ''}
                            {user.accuracy !== null ? `${user.accuracy}% · ` : ''}
                            {user.totalCorrect}✓
                          </span>
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 text-center hidden md:table-cell">
                    <div className="flex flex-col items-center">
                      <span className="font-bold text-text-secondary text-sm">
                        {user.accuracy !== null ? `${user.accuracy}%` : '—'}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {user.totalResolved > 0 ? `${user.totalResolved} ${t('resolvedLabel')}` : 'N/A'}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 text-center hidden md:table-cell">
                    <div className="flex flex-col items-center">
                      <span className="font-bold text-green-500 text-sm">{user.totalCorrect}</span>
                      <span className="text-[10px] text-gray-400">of {user.totalResolved}</span>
                    </div>
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 text-right">
                    <span className={`font-black text-base sm:text-lg ${getHighlightColor(user)}`}>
                      {getHighlightValue(user)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="p-4 bg-navy-800 rounded-xl border border-navy-600">
          <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-500" />
            {t('legend.rsTitle')}
          </h3>
          <p className="text-xs text-gray-500 leading-relaxed">{t('legend.rsDesc')}</p>
        </div>
        <div className="p-4 bg-navy-800 rounded-xl border border-navy-600">
          <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-blue-500" />
            {t('legend.cuTitle')}
          </h3>
          <p className="text-xs text-gray-500 leading-relaxed">{t('legend.cuDesc')}</p>
        </div>
        <div className="p-4 bg-navy-800 rounded-xl border border-navy-600">
          <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
            <Target className="w-4 h-4 text-purple-500" />
            {t('legend.brierTitle')}
          </h3>
          <p className="text-xs text-gray-500 leading-relaxed">{t('legend.brierDesc')}</p>
        </div>
        <div className="p-4 bg-navy-800 rounded-xl border border-navy-600">
          <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-500" />
            {t('legend.roiTitle')}
          </h3>
          <p className="text-xs text-gray-500 leading-relaxed">{t('legend.roiDesc')}</p>
        </div>
        <div className="p-4 bg-navy-800 rounded-xl border border-navy-600 opacity-60">
          <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
            <Target className="w-4 h-4 text-sky-400" />
            {t('legend.truthScoreTitle')}
          </h3>
          <p className="text-xs text-gray-500 leading-relaxed">{t('legend.truthScoreDesc')}</p>
        </div>
      </div>
    </div>
  )
}
