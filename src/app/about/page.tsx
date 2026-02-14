import { Info, Target, Users, TrendingUp, Shield, Mail } from 'lucide-react'
import { VERSION } from '@/lib/version'

export default function AboutPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6 lg:mb-8">
        <Info className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" />
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">About DAATAN</h1>
      </div>

      {/* Tagline */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-6 mb-6">
        <p className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
          Prove you were right — without shouting into the void.
        </p>
        <p className="text-sm text-gray-600">
          DAATAN is a prediction market platform where you can make forecasts, track your accuracy, and build your credibility over time.
        </p>
      </div>

      {/* How It Works */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-6">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">How It Works</h2>
        </div>
        <div className="p-6 space-y-5">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg shrink-0">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Make Predictions</p>
              <p className="text-sm text-gray-500">
                Create forecasts about future events with specific deadlines and resolution criteria.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="p-2 bg-green-50 text-green-600 rounded-lg shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Community Engagement</p>
              <p className="text-sm text-gray-500">
                Browse the feed, vote on predictions, and see what others think will happen.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Track Your Accuracy</p>
              <p className="text-sm text-gray-500">
                Build your track record. Earn Credibility Units (CU) for accurate predictions and climb the leaderboard.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Fair Resolution</p>
              <p className="text-sm text-gray-500">
                Predictions are resolved by trusted resolvers based on transparent criteria you define upfront.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Contact & Version */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Contact & Info</h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-50 text-gray-600 rounded-lg">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Get in Touch</p>
              <a
                href="mailto:support@daatan.com"
                className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
              >
                support@daatan.com
              </a>
            </div>
          </div>
          <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
            <p className="text-sm text-gray-400">
              Version <span className="font-mono">{VERSION}</span>
            </p>
            <p className="text-sm text-gray-400">
              &copy; {new Date().getFullYear()} DAATAN
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
