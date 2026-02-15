'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { 
  TrendingUp, 
  Plus, 
  Loader2,
  Filter
} from 'lucide-react'
import ForecastCard, { Prediction } from '@/components/forecasts/ForecastCard'

type FilterStatus = 'ACTIVE' | 'PENDING' | 'RESOLVED' | 'CLOSING_SOON' | 'ALL'

export default function PredictionsPage() {
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterStatus>('ACTIVE')
  const [domains, setDomains] = useState<string[]>([])
  const [selectedDomain, setSelectedDomain] = useState<string>('')

  useEffect(() => {
    const fetchPredictions = async () => {
      setIsLoading(true)
      setFetchError(null)
      try {
        let url = '/api/predictions?limit=50'
        
        // Apply status filter
        if (filter === 'ACTIVE') {
          url += '&status=ACTIVE'
        } else if (filter === 'PENDING') {
          url += '&status=PENDING'
        } else if (filter === 'RESOLVED') {
          url += '&resolvedOnly=true'
        } else if (filter === 'CLOSING_SOON') {
          url += '&status=ACTIVE&closingSoon=true'
        }
        
        // Apply domain filter
        if (selectedDomain) {
          url += `&domain=${encodeURIComponent(selectedDomain)}`
        }
        
        const response = await fetch(url)
        if (response.ok) {
          const data = await response.json()
          setPredictions(data.predictions)
          
          // Extract unique domains
          const uniqueDomains = Array.from(
            new Set(data.predictions.map((p: Prediction) => p.domain).filter(Boolean))
          ) as string[]
          setDomains(uniqueDomains.sort())
        } else {
          const errData = await response.json().catch(() => ({}))
          const errMsg = errData?.details?.[0]?.message || errData?.error || `Failed to load (${response.status})`
          setFetchError(errMsg)
          setPredictions([])
        }
      } catch (error) {
        // Error logged by error boundary
        setFetchError(error instanceof Error ? error.message : 'Failed to load predictions')
        setPredictions([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchPredictions()
  }, [filter, selectedDomain])

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 lg:mb-8">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" />
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Predictions</h1>
        </div>
        <Link
          href="/predictions/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span className="hidden sm:inline">New Prediction</span>
        </Link>
      </div>

      {fetchError && (
        <div className="mb-6 bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-lg text-sm">
          <strong>Error loading forecasts:</strong> {fetchError}
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 space-y-4">
        {/* Status Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-5 h-5 text-gray-400" />
          <button
            onClick={() => setFilter('ACTIVE')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              filter === 'ACTIVE'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Open
          </button>
          <button
            onClick={() => setFilter('CLOSING_SOON')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              filter === 'CLOSING_SOON'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Closing Soon
          </button>
          <button
            onClick={() => setFilter('PENDING')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              filter === 'PENDING'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Awaiting Resolution
          </button>
          <button
            onClick={() => setFilter('RESOLVED')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              filter === 'RESOLVED'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Resolved
          </button>
          <button
            onClick={() => setFilter('ALL')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              filter === 'ALL'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All
          </button>
        </div>

        {/* Domain Filter */}
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

      {/* Loading State */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      ) : predictions.length === 0 ? (
        /* Empty State */
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <TrendingUp className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No predictions yet</h2>
          <p className="text-gray-500 mb-6">Be the first to make a prediction!</p>
          <Link
            href="/predictions/new"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Create Prediction
          </Link>
        </div>
      ) : (
        /* Predictions List */
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-lg font-semibold text-gray-700">
              {filter === 'ACTIVE' && 'Open Predictions'}
              {filter === 'CLOSING_SOON' && 'Closing Soon'}
              {filter === 'PENDING' && 'Awaiting Resolution'}
              {filter === 'RESOLVED' && 'Resolved Predictions'}
              {filter === 'ALL' && 'All Predictions'}
            </h2>
            <span className="text-sm text-gray-500">{predictions.length} results</span>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {predictions.map((prediction) => (
              <ForecastCard key={prediction.id} prediction={prediction} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

