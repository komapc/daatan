import type { Metadata } from 'next'
import { Info, Target, Users, TrendingUp, Shield, Mail, GitCommit, Zap, Github, BookOpen, Lightbulb } from 'lucide-react'
import { VERSION } from '@/lib/version'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'About',
  description: 'Learn how DAATAN works — a forecast tracking platform where you make predictions, track your accuracy, and build your credibility over time.',
  alternates: { canonical: '/about' },
  openGraph: { url: '/about', type: 'website' },
}

export default function AboutPage() {
  const gitCommit = process.env.GIT_COMMIT || null
  const commitShort = gitCommit ? gitCommit.substring(0, 7) : null
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6 lg:mb-8">
        <Info className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" />
        <h1 className="text-2xl sm:text-3xl font-bold text-white">About DAATAN</h1>
      </div>

      {/* Tagline */}
      <div className="bg-navy-800 border border-cobalt/30 rounded-xl p-6 mb-6">
        <p className="text-lg sm:text-xl font-semibold text-white mb-2">
          Prove you were right — without shouting into the void.
        </p>
        <p className="text-sm text-text-secondary">
          DAATAN is a forecast tracking platform where you can make forecasts, track your accuracy, and build your credibility over time.
        </p>
      </div>

      {/* Why DAATAN? */}
      <div className="bg-navy-700 border border-navy-600 rounded-xl shadow-sm overflow-hidden mb-6">
        <div className="p-6 border-b border-navy-600">
          <h2 className="text-lg font-semibold text-white">Why DAATAN?</h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-amber-900/20 text-amber-600 rounded-lg shrink-0">
              <Lightbulb className="w-5 h-5" />
            </div>
            <div>
              <p className="font-medium text-white">Turn Predictions Into Accountability</p>
              <p className="text-sm text-text-secondary">
                Gut feelings are cheap. Real predictions force you to think deeply, quantify uncertainty, and get specific about timelines. DAATAN holds you accountable.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="p-2 bg-cobalt/10 text-cobalt-light rounded-lg shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <p className="font-medium text-white">Build Real Credibility</p>
              <p className="text-sm text-text-secondary">
                Track your accuracy in real-time. A strong prediction track record speaks louder than credentials in many domains.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="p-2 bg-teal/10 text-teal rounded-lg shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="font-medium text-white">Learn From a Community</p>
              <p className="text-sm text-text-secondary">
                See how others think about the same questions. Discover blind spots, sharpen your judgment, and grow with a community of forecasters.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="bg-navy-700 border border-navy-600 rounded-xl shadow-sm overflow-hidden mb-6">
        <div className="p-6 border-b border-navy-600">
          <h2 className="text-lg font-semibold text-white">How It Works</h2>
        </div>
        <div className="p-6 space-y-5">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-cobalt/10 text-cobalt-light rounded-lg shrink-0">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <p className="font-medium text-white">Make Predictions</p>
              <p className="text-sm text-text-secondary">
                Create forecasts about future events with specific deadlines and resolution criteria.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="p-2 bg-teal/10 text-teal rounded-lg shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="font-medium text-white">Community Engagement</p>
              <p className="text-sm text-text-secondary">
                Browse the feed, vote on predictions, and see what others think will happen.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="p-2 bg-amber-900/20 text-amber-600 rounded-lg shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="font-medium text-white">Track Your Accuracy</p>
              <p className="text-sm text-text-secondary">
                Build your track record with a verifiable history of predictions. Your Reputation Score and Brier Skill Score update automatically after each resolution.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="p-2 bg-purple-900/20 text-cobalt-light rounded-lg shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <p className="font-medium text-white">Fair Resolution</p>
              <p className="text-sm text-text-secondary">
                Predictions are resolved by trusted resolvers based on transparent criteria you define upfront.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Scoring System */}
      <div className="bg-navy-700 border border-navy-600 rounded-xl shadow-sm overflow-hidden mb-6">
        <div className="p-6 border-b border-navy-600">
          <h2 className="text-lg font-semibold text-white">How Scoring Works</h2>
        </div>
        <div className="p-6 space-y-5">
          <div>
            <h3 className="font-medium text-white mb-2 flex items-center gap-2">
              <Shield className="w-4 h-4 text-green-500" />
              Reputation Score (RS)
            </h3>
            <p className="text-sm text-text-secondary mb-3">
              Your Reputation Score is your long-term credibility metric. It updates after each resolved prediction using an ELO-like system that weighs expected vs. actual outcomes.
            </p>
            <ul className="text-sm text-text-secondary space-y-1 ml-4">
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-1">•</span>
                <span><strong>Earned through accuracy:</strong> RS rises with correct calls, falls with wrong ones</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-1">•</span>
                <span><strong>Can be negative:</strong> A poor track record results in negative RS</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-1">•</span>
                <span><strong>Domain-specific:</strong> Build reputation separately in politics, economy, tech, and more</span>
              </li>
            </ul>
          </div>

          <div className="pt-4 border-t border-navy-600">
            <h3 className="font-medium text-white mb-2 flex items-center gap-2">
              <Target className="w-4 h-4 text-amber-500" />
              Brier Skill Score (BSS)
            </h3>
            <p className="text-sm text-text-secondary mb-3">
              The BSS measures calibration — how well your stated confidence matches reality across all your forecasts. A perfectly calibrated forecaster scores 1.0; random guessing scores 0.
            </p>
            <ul className="text-sm text-text-secondary space-y-1 ml-4">
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-1">•</span>
                <span><strong>Calibration over accuracy:</strong> Saying &quot;70% likely&quot; and being right 70% of the time is better than always saying 100%</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-1">•</span>
                <span><strong>Only on resolved forecasts:</strong> BSS updates automatically when a prediction is resolved</span>
              </li>
            </ul>
          </div>

          <div className="pt-4 border-t border-navy-600">
            <h3 className="font-medium text-white mb-2 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              Participation
            </h3>
            <p className="text-sm text-text-secondary mb-3">
              Every forecast you join — whether active or already resolved — counts towards your participation history. The leaderboard ranks forecasters by reputation, calibration, and depth of engagement.
            </p>
            <ul className="text-sm text-text-secondary space-y-1 ml-4">
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-1">•</span>
                <span><strong>Active forecasts:</strong> predictions you have joined that are still open</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-1">•</span>
                <span><strong>Resolved forecasts:</strong> predictions that have been settled and contributed to your score</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Key Features */}
      <div className="bg-navy-700 border border-navy-600 rounded-xl shadow-sm overflow-hidden mb-6">
        <div className="p-6 border-b border-navy-600">
          <h2 className="text-lg font-semibold text-white">Key Features</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3 bg-navy-800 rounded-lg">
              <p className="font-medium text-sm text-white mb-1">🎯 Create & Track</p>
              <p className="text-xs text-text-secondary">Define forecasts with specific resolution criteria and deadlines</p>
            </div>
            <div className="p-3 bg-navy-800 rounded-lg">
              <p className="font-medium text-sm text-white mb-1">📊 Live Odds</p>
              <p className="text-xs text-text-secondary">See real-time probability distributions based on community commitments</p>
            </div>
            <div className="p-3 bg-navy-800 rounded-lg">
              <p className="font-medium text-sm text-white mb-1">🤖 AI Assistance</p>
              <p className="text-xs text-text-secondary">Express forecasts from news articles and automated suggestions</p>
            </div>
            <div className="p-3 bg-navy-800 rounded-lg">
              <p className="font-medium text-sm text-white mb-1">🔗 Social Sharing</p>
              <p className="text-xs text-text-secondary">Share your forecasts with customizable cards and OG images</p>
            </div>
            <div className="p-3 bg-navy-800 rounded-lg">
              <p className="font-medium text-sm text-white mb-1">📈 Leaderboards</p>
              <p className="text-xs text-text-secondary">Rank by accuracy and reputation across all predictions</p>
            </div>
            <div className="p-3 bg-navy-800 rounded-lg">
              <p className="font-medium text-sm text-white mb-1">🔔 Notifications</p>
              <p className="text-xs text-text-secondary">Email and push alerts for deadlines, comments, and resolutions</p>
            </div>
          </div>
        </div>
      </div>

      {/* Resources */}
      <div className="bg-navy-700 border border-navy-600 rounded-xl shadow-sm overflow-hidden mb-6">
        <div className="p-6 border-b border-navy-600">
          <h2 className="text-lg font-semibold text-white">Resources & Community</h2>
        </div>
        <div className="p-6 space-y-3">
          <a
            href="https://github.com/komapc/daatan"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 bg-navy-800 hover:bg-navy-700 rounded-lg transition-colors"
          >
            <Github className="w-5 h-5 text-text-secondary" />
            <div>
              <p className="font-medium text-white text-sm">GitHub Repository</p>
              <p className="text-xs text-text-secondary">View source code and contribute</p>
            </div>
          </a>
          <a
            href="https://x.com/daatan_dev"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 bg-navy-800 hover:bg-navy-700 rounded-lg transition-colors"
          >
            <BookOpen className="w-5 h-5 text-text-secondary" />
            <div>
              <p className="font-medium text-white text-sm">Twitter / X</p>
              <p className="text-xs text-text-secondary">Follow for updates and announcements</p>
            </div>
          </a>
        </div>
      </div>

      {/* Contact & Version */}
      <div className="bg-navy-700 border border-navy-600 rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-navy-600">
          <h2 className="text-lg font-semibold text-white">Contact & Info</h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-navy-800 text-text-secondary rounded-lg">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <p className="font-medium text-white">Get in Touch</p>
              <a
                href="mailto:office@daatan.com"
                className="text-sm text-cobalt-light hover:text-cobalt-light hover:underline"
              >
                office@daatan.com
              </a>
            </div>
          </div>
          <div className="pt-4 border-t border-navy-600 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-sm text-text-subtle">
              <span>Version <span className="font-mono">{VERSION}</span></span>
              {commitShort && (
                <span className="flex items-center gap-1">
                  <GitCommit className="w-3.5 h-3.5" />
                  <Link
                    href={`https://github.com/komapc/daatan/commit/${gitCommit}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono hover:text-cobalt-light hover:underline"
                  >
                    {commitShort}
                  </Link>
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-text-subtle">
              <Link href="/privacy" className="hover:text-white hover:underline">Privacy Policy</Link>
              <Link href="/terms" className="hover:text-white hover:underline">Terms of Service</Link>
              <p>
                &copy; {new Date().getFullYear()} DAATAN
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
