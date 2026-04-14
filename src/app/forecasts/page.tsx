'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  TrendingUp,
  Plus,
  Filter
} from 'lucide-react'
import ForecastCard, { Prediction } from '@/components/forecasts/ForecastCard'
import { ForecastCardSkeleton } from '@/components/forecasts/ForecastCardSkeleton'
import EmptyState from '@/components/ui/EmptyState'

type FilterStatus = 'ACTIVE' | 'PENDING' | 'RESOLVED' | 'CLOSING_SOON' | 'ALL'

export default function PredictionsPage() {
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterStatus>('ACTIVE')

  useEffect(() => {
    const fetchPredictions = async () => {
      setIsLoading(true)
      setFetchError(null)
      try {
        let url = '/api/forecasts?limit=50'

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

        const response = await fetch(url)
        if (response.ok) {
          const data = await response.json()
          setPredictions(data.predictions)

          setPredictions(data.predictions)
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
  }, [filter])

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 lg:mb-8">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" />
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Forecasts</h1>
        </div>
        <Link
          href="/predictions/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span className="hidden sm:inline">New Forecast</span>
        </Link>
      </div>

      {fetchError && (
        <div className="mb-6 bg-red-900/20 border border-red-800/40 text-red-400 px-4 py-3 rounded-lg text-sm">
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
            className={`px-4 py-2 rounded-lg font-medium transition-all ${filter === 'ACTIVE'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-navy-700 text-text-secondary hover:bg-navy-600'
              }`}
          >
            Open
          </button>
          <button
            onClick={() => setFilter('CLOSING_SOON')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${filter === 'CLOSING_SOON'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-navy-700 text-text-secondary hover:bg-navy-600'
              }`}
          >
            Closing Soon
          </button>
          <button
            onClick={() => setFilter('PENDING')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${filter === 'PENDING'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-navy-700 text-text-secondary hover:bg-navy-600'
              }`}
          >
            Awaiting Resolution
          </button>
          <button
            onClick={() => setFilter('RESOLVED')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${filter === 'RESOLVED'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-navy-700 text-text-secondary hover:bg-navy-600'
              }`}
          >
            Resolved
          </button>
          <button
            onClick={() => setFilter('ALL')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${filter === 'ALL'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-navy-700 text-text-secondary hover:bg-navy-600'
              }`}
          >
            All
          </button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => <ForecastCardSkeleton key={i} />)}
        </div>
      ) : predictions.length === 0 ? (
        <EmptyState
          variant="dashed"
          icon={<TrendingUp className="w-8 h-8 text-gray-400" />}
          iconBgClass="bg-navy-700"
          title="No forecasts yet"
          description="Be the first to make a forecast!"
          action={{ label: 'Create Forecast', href: '/predictions/new', icon: <Plus className="w-5 h-5" /> }}
        />
      ) : (
        /* Predictions List */
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-lg font-semibold text-text-secondary">
              {filter === 'ACTIVE' && 'Open Forecasts'}
              {filter === 'CLOSING_SOON' && 'Closing Soon'}
              {filter === 'PENDING' && 'Awaiting Resolution'}
              {filter === 'RESOLVED' && 'Resolved Forecasts'}
              {filter === 'ALL' && 'All Forecasts'}
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

