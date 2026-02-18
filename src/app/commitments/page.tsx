'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  History,
  Loader2,
  TrendingUp,
  TrendingDown,
  Target,
  Wallet,
  CheckCircle2,
  XCircle,
  Clock,
  BarChart3,
  ChevronRight,
} from 'lucide-react'
import { createClientLogger } from '@/lib/client-logger'

const log = createClientLogger('CommitmentHistory')

interface CommitmentStats {
  total: number
  resolved: number
  correct: number
  wrong: number
  pending: number
  accuracy: number | null
  totalCuCommitted: number
  totalCuReturned: number
  netCu: number
  totalRsChange: number
}

interface Commitment {
  id: string
  cuCommitted: number
  cuReturned: number | null
  rsChange: number | null
  binaryChoice: boolean | null
  createdAt: string
  prediction: {
    id: string
    slug?: string
    claimText: string
    status: string
    resolveByDatetime: string
    outcomeType: string
  }
  option?: {
    id: string
    text: string
  } | null
}

type FilterTab = 'ALL' | 'ACTIVE' | 'RESOLVED'

export default function CommitmentHistoryPage() {
  const { status } = useSession()
  const router = useRouter()
  const [stats, setStats] = useState<CommitmentStats | null>(null)
  const [commitments, setCommitments] = useState<Commitment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<FilterTab>('ALL')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin?callbackUrl=/commitments')
      return
    }
    if (status !== 'authenticated') return

    const fetchData = async () => {
      setIsLoading(true)
      try {
        const [statsRes, commitmentsRes] = await Promise.all([
          fetch('/api/commitments/stats'),
          fetch(`/api/commitments?limit=100${filter === 'ACTIVE' ? '&status=ACTIVE' : filter === 'RESOLVED' ? '&status=RESOLVED_CORRECT' : ''}`),
        ])

        if (statsRes.ok) {
          setStats(await statsRes.json())
        }
        if (commitmentsRes.ok) {
          const data = await commitmentsRes.json()
          setCommitments(data.commitments)
        }
      } catch (error) {
        log.error({ err: error }, 'Failed to fetch commitment data')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [status, router, filter])

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
      </div>
    )
  }

  const getStatusColor = (predStatus: string) => {
    if (predStatus === 'RESOLVED_CORRECT' || predStatus === 'RESOLVED_WRONG') return 'text-gray-500'
    if (predStatus === 'ACTIVE') return 'text-green-600'
    if (predStatus === 'PENDING') return 'text-amber-600'
    return 'text-gray-400'
  }

  const getOutcomeLabel = (c: Commitment) => {
    if (c.cuReturned === null) return null
    if (c.cuReturned > c.cuCommitted) return { text: 'Correct', color: 'text-green-600 bg-green-50' }
    if (c.cuReturned === 0) return { text: 'Wrong', color: 'text-red-600 bg-red-50' }
    return { text: 'Refunded', color: 'text-gray-600 bg-gray-50' }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 lg:mb-8">
        <History className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" />
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Commitment History</h1>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8">
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
              <Target className="w-4 h-4" />
              <span>Accuracy</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {stats.accuracy !== null ? `${stats.accuracy}%` : '—'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {stats.correct}/{stats.resolved} correct
            </p>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
              <BarChart3 className="w-4 h-4" />
              <span>Total</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            <p className="text-xs text-gray-400 mt-1">
              {stats.pending} pending
            </p>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
              <Wallet className="w-4 h-4" />
              <span>Net CU</span>
            </div>
            <p className={`text-2xl font-bold ${stats.netCu >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {stats.netCu >= 0 ? '+' : ''}{stats.netCu}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {stats.totalCuCommitted} committed
            </p>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
              {stats.totalRsChange >= 0 ? (
                <TrendingUp className="w-4 h-4 text-green-500" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-500" />
              )}
              <span>RS Change</span>
            </div>
            <p className={`text-2xl font-bold ${stats.totalRsChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {stats.totalRsChange >= 0 ? '+' : ''}{stats.totalRsChange}
            </p>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mb-6">
        {(['ALL', 'ACTIVE', 'RESOLVED'] as FilterTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              filter === tab
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {tab === 'ALL' ? 'All' : tab === 'ACTIVE' ? 'Active' : 'Resolved'}
          </button>
        ))}
      </div>

      {/* Commitments List */}
      {commitments.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <History className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-lg font-medium">No commitments yet</p>
          <p className="text-gray-400 text-sm mt-1">
            Browse the <Link href="/" className="text-blue-600 hover:underline">feed</Link> to find forecasts to commit to
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {commitments.map((commitment) => {
            const outcome = getOutcomeLabel(commitment)
            const choiceLabel = commitment.option
              ? commitment.option.text
              : commitment.binaryChoice === true
                ? 'Will happen'
                : commitment.binaryChoice === false
                  ? 'Won\'t happen'
                  : '—'

            return (
              <Link
                key={commitment.id}
                href={`/forecasts/${commitment.prediction.slug || commitment.prediction.id}`}
                className="block bg-white rounded-xl border border-gray-100 p-4 hover:border-blue-200 hover:shadow-sm transition-all group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-900 font-medium line-clamp-2 group-hover:text-blue-600 transition-colors">
                      {commitment.prediction.claimText}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-sm text-gray-500 flex-wrap">
                      <span className={`font-medium ${getStatusColor(commitment.prediction.status)}`}>
                        {commitment.prediction.status === 'ACTIVE' && '● Active'}
                        {commitment.prediction.status === 'PENDING' && '● Pending'}
                        {commitment.prediction.status === 'RESOLVED_CORRECT' && 'Resolved ✓'}
                        {commitment.prediction.status === 'RESOLVED_WRONG' && 'Resolved ✗'}
                        {commitment.prediction.status === 'VOID' && 'Void'}
                      </span>
                      <span>·</span>
                      <span>Your pick: <strong>{choiceLabel}</strong></span>
                      <span>·</span>
                      <span>{commitment.cuCommitted} CU</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {outcome && (
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${outcome.color}`}>
                        {outcome.text}
                      </span>
                    )}
                    {commitment.cuReturned !== null && commitment.cuReturned > 0 && (
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-green-600 text-sm font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          +{commitment.cuReturned} CU
                        </div>
                        {commitment.rsChange !== null && commitment.rsChange !== 0 && (
                          <p className={`text-xs ${commitment.rsChange > 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {commitment.rsChange > 0 ? '+' : ''}{commitment.rsChange.toFixed(1)} RS
                          </p>
                        )}
                      </div>
                    )}
                    {commitment.cuReturned === 0 && (
                      <div className="flex items-center gap-1 text-red-500 text-sm font-semibold">
                        <XCircle className="w-3.5 h-3.5" />
                        -{commitment.cuCommitted} CU
                      </div>
                    )}
                    {commitment.cuReturned === null && (
                      <Clock className="w-4 h-4 text-gray-300" />
                    )}
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-400 transition-colors" />
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
