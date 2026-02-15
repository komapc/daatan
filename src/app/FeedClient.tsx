'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Home, Loader2, TrendingUp, Plus, Filter } from 'lucide-react'
import ForecastCard, { Prediction } from '@/components/forecasts/ForecastCard'
import { createClientLogger } from '@/lib/client-logger'

const log = createClientLogger('FeedClient')

type FilterStatus = 'ACTIVE' | 'PENDING' | 'RESOLVED' | 'CLOSING_SOON' | 'ALL'

export default function FeedClient() {
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterStatus>('ACTIVE')
  const [domains, setDomains] = useState<string[]>([])
  const [selectedDomain, setSelectedDomain] = useState<string>('')

  useEffect(() => {
    const fetchFeed = async () => {
      setIsLoading(true)
      setFetchError(null)
      try {
        let url = '/api/forecasts?limit=50'

        if (filter === 'ACTIVE') {
          url += '&status=ACTIVE'
        } else if (filter === 'PENDING') {
          url += '&status=PENDING'
        } else if (filter === 'RESOLVED') {
          url += '&resolvedOnly=true'
        } else if (filter === 'CLOSING_SOON') {
          url += '&status=ACTIVE&closingSoon=true'
        }

        if (selectedDomain) {
          url += `&domain=${encodeURIComponent(selectedDomain)}`
        }

        const response = await fetch(url, {
          credentials: 'include',
          cache: 'no-store',
        })
        if (response.ok) {
          const data = await response.json()
          const preds = data.predictions || []
          setPredictions(preds)

          const uniqueDomains = Array.from(
            new Set(preds.map((p: Prediction) => p.domain).filter(Boolean))
          ) as string[]
          setDomains(uniqueDomains.sort())
        } else {
          const errData = await response.json().catch(() => ({}))
          const baseMsg = errData?.error || `Failed to load predictions (${response.status})`
          const detailMsg = errData?.details?.[0]?.message
          const errMsg = detailMsg ? `${baseMsg}: ${detailMsg}` : baseMsg
          setFetchError(errMsg)
          setPredictions([])
        }
      } catch (error) {
        log.error({ err: error }, 'Error fetching feed')
        setFetchError(error instanceof Error ? error.message : 'Failed to load predictions')
        setPredictions([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchFeed()
  }, [filter, selectedDomain])

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Welcome Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <Home className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Feed</h1>
            <p className="text-sm text-gray-500">Discover active predictions and commit your CU</p>
          </div>
        </div>
        <Link
          href="/create"
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-semibold shadow-sm hover:bg-blue-700 transition-all active:scale-95"
        >
          <Plus className="w-5 h-5" />
          <span>New Forecast</span>
        </Link>
      </div>

      {/* Filters */}
      <div className="mb-6 space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-5 h-5 text-gray-400" />
          <button
            onClick={() => setFilter('ACTIVE')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${filter === 'ACTIVE'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            Open
          </button>
          <button
            onClick={() => setFilter('CLOSING_SOON')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${filter === 'CLOSING_SOON'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            Closing Soon
          </button>
          <button
            onClick={() => setFilter('PENDING')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${filter === 'PENDING'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            Awaiting Resolution
          </button>
          <button
            onClick={() => setFilter('RESOLVED')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${filter === 'RESOLVED'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            Resolved
          </button>
          <button
            onClick={() => setFilter('ALL')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${filter === 'ALL'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            All
          </button>
        </div>

        {domains.length > 0 && (
          <div className="flex items-center gap-2">
            <label htmlFor="domain-filter" className="text-sm font-medium text-gray-700">
              Category:
            </label>
            <select
              id="domain-filter"
              value={selectedDomain}
              onChange={(e) => setSelectedDomain(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              {domains.map((domain) => (
                <option key={domain} value={domain}>
                  {domain}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Feed Content */}
      {fetchError && (
        <div className="mb-6 bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-lg text-sm">
          <strong>Error loading forecasts:</strong> {fetchError}
        </div>
      )}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
          <p className="text-gray-500 font-medium">Loading your feed...</p>
        </div>
      ) : predictions.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center shadow-sm">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <TrendingUp className="w-10 h-10 text-blue-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">No active forecasts</h2>
          <p className="text-gray-500 mb-8 max-w-md mx-auto text-lg">
            There are no active forecasts at the moment. Check back soon!
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-lg font-bold text-gray-800 uppercase tracking-wider">
              {filter === 'ACTIVE' && 'Open Forecasts'}
              {filter === 'CLOSING_SOON' && 'Closing Soon'}
              {filter === 'PENDING' && 'Awaiting Resolution'}
              {filter === 'RESOLVED' && 'Resolved Forecasts'}
              {filter === 'ALL' && 'All Forecasts'}
            </h2>
            <span className="text-sm text-gray-500">{predictions.length} results</span>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {predictions.map((prediction) => (
              <ForecastCard key={prediction.id} prediction={prediction} showModerationControls={true} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
