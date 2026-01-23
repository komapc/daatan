'use client'

import { useEffect, useState } from 'react'
import { Trophy, Loader2, Medal, TrendingUp, Wallet } from 'lucide-react'

type LeaderboardUser = {
  id: string
  name: string | null
  username: string | null
  image: string | null
  rs: number
  cuAvailable: number
  _count: {
    predictions: number
    commitments: number
  }
}

export default function LeaderboardPage() {
  const [users, setUsers] = useState<LeaderboardUser[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const response = await fetch('/api/top-reputation?limit=50')
        if (!response.ok) throw new Error('Failed to fetch leaderboard')
      } catch (error) {
        console.error('Error fetching leaderboard:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchLeaderboard()
  }, [])

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

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col items-center text-center mb-12">
        <div className="p-4 bg-yellow-50 rounded-2xl mb-4">
          <Trophy className="w-10 h-10 sm:w-12 sm:h-12 text-yellow-500" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-gray-900 mb-2 tracking-tight">Leaderboard</h1>
        <p className="text-gray-500 max-w-md">Top predictors ranked by Reputation Score (RS). Prove your accuracy and climb the ranks.</p>
      </div>

      {/* Leaderboard Table/List */}
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
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-20">Rank</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Predictor</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Predictions</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">CU</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">RS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((user, index) => (
                  <tr key={user.id} className={`hover:bg-blue-50/30 transition-colors ${index < 3 ? 'bg-yellow-50/10' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="flex justify-center">
                        {getRankIcon(index)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {user.image ? (
                          <img src={user.image} alt="" className="w-10 h-10 rounded-full border border-gray-200" />
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
                            {user.username ? `@${user.username}` : 'Private Profile'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col items-center">
                        <span className="font-bold text-gray-700">{user._count.commitments}</span>
                        <span className="text-[10px] text-gray-400 uppercase font-medium">Stakes</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-col items-end">
                        <div className="flex items-center gap-1 text-blue-600 font-bold">
                          <Wallet className="w-3.5 h-3.5" />
                          <span>{user.cuAvailable}</span>
                        </div>
                        <span className="text-[10px] text-gray-400 uppercase font-medium">Available</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-col items-end">
                        <div className="flex items-center gap-1 text-gray-900 font-black text-lg">
                          <TrendingUp className="w-4 h-4 text-green-500" />
                          <span>{user.rs.toFixed(1)}</span>
                        </div>
                        <span className="text-[10px] text-gray-400 uppercase font-medium tracking-tight">Reputation</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Legend / Info */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
          <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-500" />
            What is RS?
          </h3>
          <p className="text-xs text-gray-500 leading-relaxed">
            Reputation Score (RS) measures your prediction accuracy over time. It increases when you're right and decreases when you're wrong. Higher stakes mean bigger RS changes.
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
