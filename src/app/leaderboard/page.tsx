'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Trophy, Loader2, Medal, TrendingUp, Wallet, Target, BarChart3 } from 'lucide-react'
import { createClientLogger } from '@/lib/client-logger'

const log = createClientLogger('Leaderboard')

type SortBy = 'rs' | 'accuracy' | 'totalCorrect' | 'cuCommitted'

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
}

const SORT_OPTIONS: { value: SortBy; label: string; icon: typeof TrendingUp }[] = [
  { value: 'rs', label: 'Reputation', icon: TrendingUp },
  { value: 'accuracy', label: 'Accuracy', icon: Target },
  { value: 'totalCorrect', label: 'Most Correct', icon: BarChart3 },
  { value: 'cuCommitted', label: 'Most CU Committed', icon: Wallet },
]

export default function LeaderboardPage() {
  const [users, setUsers] = useState<LeaderboardUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [sortBy, setSortBy] = useState<SortBy>('rs')

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
      default:
        return user.rs.toFixed(1)
    }
  }

  const getHighlightLabel = () => {
    switch (sortBy) {
      case 'accuracy': return 'Accuracy'
      case 'totalCorrect': return 'Correct'
      case 'cuCommitted': return 'CU Committed'
      default: return 'Reputation'
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col items-center text-center mb-8">
        <div className="p-4 bg-yellow-50 rounded-2xl mb-4">
          <Trophy className="w-10 h-10 sm:w-12 sm:h-12 text-yellow-500" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-gray-900 mb-2 tracking-tight">Leaderboard</h1>
        <p className="text-gray-500 max-w-md">Top predictors ranked by performance. Prove your accuracy and climb the ranks.</p>
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
          <p className="text-gray-500 font-medium">Calculating rankings...</p>
        </div>
      ) : users.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center shadow-sm">
          <p className="text-gray-400 text-lg">No predictors found yet.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-4 sm:px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-16">Rank</th>
                  <th className="px-4 sm:px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Predictor</th>
                  <th className="px-4 sm:px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center hidden sm:table-cell">Accuracy</th>
                  <th className="px-4 sm:px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center hidden sm:table-cell">Correct</th>
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
                            {user.username ? `@${user.username}` : `${user.totalCommitments} commitments`}
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
                          {user.totalResolved > 0 ? `${user.totalResolved} resolved` : 'N/A'}
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
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
          <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-500" />
            What is RS?
          </h3>
          <p className="text-xs text-gray-500 leading-relaxed">
            Reputation Score (RS) measures your prediction accuracy over time. It increases when you&apos;re right and decreases when you&apos;re wrong. Higher stakes mean bigger RS changes.
          </p>
        </div>
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
          <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-blue-500" />
            What is CU?
          </h3>
          <p className="text-xs text-gray-500 leading-relaxed">
            Confidence Units (CU) are the currency used to place stakes. You get 100 CU when you join. When you win a prediction, you get your CU back plus a bonus based on your performance.
          </p>
        </div>
      </div>
    </div>
  )
}
