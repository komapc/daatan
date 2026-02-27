'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Trophy, Loader2, Medal, TrendingUp, Wallet, Target, BarChart3 } from 'lucide-react'
import { createClientLogger } from '@/lib/client-logger'
import { useTranslations } from 'next-intl'

const log = createClientLogger('Leaderboard')

type SortBy = 'rs' | 'accuracy' | 'totalCorrect' | 'cuCommitted' | 'brierScore'

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
}

export default function LeaderboardPage() {
  const t = useTranslations('leaderboard')
  const [users, setUsers] = useState<LeaderboardUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [sortBy, setSortBy] = useState<SortBy>('rs')

  const SORT_OPTIONS: { value: SortBy; label: string; icon: typeof TrendingUp }[] = [
    { value: 'rs', label: t('sortBy.reputation'), icon: TrendingUp },
    { value: 'accuracy', label: t('sortBy.accuracy'), icon: Target },
    { value: 'totalCorrect', label: t('sortBy.mostCorrect'), icon: BarChart3 },
    { value: 'cuCommitted', label: t('sortBy.cuCommitted'), icon: Wallet },
    { value: 'brierScore', label: t('sortBy.brierScore'), icon: Target },
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
      case 0:
        return <Medal className="w-6 h-6 text-yellow-500" />
      case 1:
        return <Medal className="w-6 h-6 text-gray-400" />
      case 2:
        return <Medal className="w-6 h-6 text-amber-600" />
      default:
        return <span className="text-lg font-bold text-gray-400 w-6 text-center">{index + 1}</span>
    }
  }

  const getHighlightValue = (user: LeaderboardUser) => {
    switch (sortBy) {
      case 'accuracy':
        return user.accuracy !== null ? `${user.accuracy}%` : '—'
      case 'totalCorrect':
        return `${user.totalCorrect}`
      case 'cuCommitted':
        return `${user.totalCuCommitted}`
      case 'brierScore':
        return user.avgBrierScore !== null ? user.avgBrierScore.toFixed(3) : '—'
      default:
        return user.rs.toFixed(1)
    }
  }

  const getHighlightLabel = () => {
    switch (sortBy) {
      case 'accuracy': return t('sortBy.accuracy')
      case 'totalCorrect': return t('correct')
      case 'cuCommitted': return t('sortBy.cuCommitted')
      case 'brierScore': return `${t('sortBy.brierScore')} ↓`
      default: return t('sortBy.reputation')
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col items-center text-center mb-8">
        <div className="p-4 bg-yellow-50 rounded-2xl mb-4">
          <Trophy className="w-10 h-10 sm:w-12 sm:h-12 text-yellow-500" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-gray-900 mb-2 tracking-tight">{t('title')}</h1>
        <p className="text-gray-500 max-w-md">{t('subtitle')}</p>
      </div>

      {/* Sort Tabs */}
      <div className="flex items-center justify-center gap-2 mb-8 flex-wrap">
        {SORT_OPTIONS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setSortBy(value)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              sortBy === value
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            aria-label={`Sort by ${label}`}
          >
            <Icon className="w-4 h-4" />
            {label}
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
        <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center shadow-sm">
          <p className="text-gray-400 text-lg">{t('noUsers')}</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-4 sm:px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-16">{t('rank')}</th>
                  <th className="px-4 sm:px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">{t('predictor')}</th>
                  <th className="px-4 sm:px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center hidden sm:table-cell">{t('sortBy.accuracy')}</th>
                  <th className="px-4 sm:px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center hidden sm:table-cell">{t('correct')}</th>
                  <th className="px-4 sm:px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">
                    {getHighlightLabel()}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((user, index) => (
                  <tr key={user.id} className={`hover:bg-blue-50/30 transition-colors ${index < 3 ? 'bg-yellow-50/10' : ''}`}>
                    <td className="px-4 sm:px-6 py-4">
                      <div className="flex justify-center">
                        {getRankIcon(index)}
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      <div className="flex items-center gap-3">
                        {user.image ? (
                          <Image src={user.image} alt="" width={40} height={40} className="rounded-full border border-gray-200" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                            {user.name?.charAt(0) || user.username?.charAt(0) || '?'}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-bold text-gray-900 truncate">
                            {user.name || user.username || 'Anonymous'}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {user.username ? `@${user.username}` : `${user.totalCommitments} ${t('resolvedLabel')}`}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-center hidden sm:table-cell">
                      <div className="flex flex-col items-center">
                        <span className="font-bold text-gray-700">
                          {user.accuracy !== null ? `${user.accuracy}%` : '—'}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {user.totalResolved > 0 ? `${user.totalResolved} ${t('resolvedLabel')}` : 'N/A'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-center hidden sm:table-cell">
                      <div className="flex flex-col items-center">
                        <span className="font-bold text-green-600">{user.totalCorrect}</span>
                        <span className="text-[10px] text-gray-400">of {user.totalResolved}</span>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-right">
                      <span className="font-black text-lg text-gray-900">
                        {getHighlightValue(user)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
          <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-500" />
            {t('legend.rsTitle')}
          </h3>
          <p className="text-xs text-gray-500 leading-relaxed">
            {t('legend.rsDesc')}
          </p>
        </div>
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
          <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-blue-500" />
            {t('legend.cuTitle')}
          </h3>
          <p className="text-xs text-gray-500 leading-relaxed">
            {t('legend.cuDesc')}
          </p>
        </div>
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
          <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
            <Target className="w-4 h-4 text-purple-500" />
            {t('legend.brierTitle')}
          </h3>
          <p className="text-xs text-gray-500 leading-relaxed">
            {t('legend.brierDesc')}
          </p>
        </div>
      </div>
    </div>
  )
}
