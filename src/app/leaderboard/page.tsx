import { Trophy } from 'lucide-react'

export default function LeaderboardPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex items-center gap-3 mb-6 lg:mb-8">
        <Trophy className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" />
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Leaderboard</h1>
      </div>
      <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-8 sm:p-12 text-center">
        <p className="text-gray-400 text-base sm:text-lg">Top predictors will appear here</p>
      </div>
    </div>
  )
}
