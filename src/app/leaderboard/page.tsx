import { Trophy } from 'lucide-react'

export default function LeaderboardPage() {
  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-8">
        <Trophy className="w-8 h-8 text-blue-500" />
        <h1 className="text-3xl font-bold text-gray-900">Leaderboard</h1>
      </div>
      <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-12 text-center">
        <p className="text-gray-400 text-lg">Top predictors will appear here</p>
      </div>
    </div>
  )
}

