'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Home, Loader2, TrendingUp, Plus, Filter, Tag, X, ArrowDownUp } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import ForecastCard, { Prediction } from '@/components/forecasts/ForecastCard'
import { createClientLogger } from '@/lib/client-logger'

const log = createClientLogger('FeedClient')

type FilterStatus = 'ACTIVE' | 'PENDING' | 'RESOLVED' | 'CLOSING_SOON' | 'NEEDS_REVIEW' | 'ALL'
type SortBy = 'newest' | 'deadline' | 'cu'

const VALID_STATUSES: FilterStatus[] = ['ACTIVE', 'PENDING', 'RESOLVED', 'CLOSING_SOON', 'NEEDS_REVIEW', 'ALL']

import { STANDARD_TAGS } from '@/lib/constants'

interface FeedClientProps {
  initialPredictions?: Prediction[]
}

export default function FeedClient({ initialPredictions }: FeedClientProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { data: session } = useSession()
  const isAdminOrApprover = session?.user?.role === 'ADMIN' || session?.user?.role === 'APPROVER'
  const t = useTranslations('feed')
  const tf = useTranslations('forecast')

  // Initialize state from URL search params
  const initialStatus = searchParams.get('status') as FilterStatus | null
  const initialTags = searchParams.get('tags')?.split(',').filter(Boolean) || []
  const initialSort = (searchParams.get('sortBy') as SortBy | null) || 'newest'

  const [predictions, setPredictions] = useState<Prediction[]>(initialPredictions ?? [])
  const [isLoading, setIsLoading] = useState(!initialPredictions?.length)
  // Track whether the SSR initial data has already been used so the first
  // effect run doesn't replace it with an identical client-side fetch.
  const ssrConsumed = useRef(!!(initialPredictions?.length))
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterStatus>(
    initialStatus && VALID_STATUSES.includes(initialStatus) ? initialStatus : 'ACTIVE'
  )
  const [selectedTags, setSelectedTags] = useState<string[]>(initialTags)
  const [sortBy, setSortBy] = useState<SortBy>(initialSort)

  // Sync state to URL search params
  const syncToUrl = useCallback((status: FilterStatus, tags: string[], sort: SortBy) => {
    const params = new URLSearchParams()
    if (status !== 'ACTIVE') params.set('status', status)
    if (tags.length > 0) params.set('tags', tags.join(','))
    if (sort !== 'newest') params.set('sortBy', sort)
    const qs = params.toString()
    router.replace(qs ? `?${qs}` : '/', { scroll: false })
  }, [router])

  const handleSetFilter = (newFilter: FilterStatus) => {
    setFilter(newFilter)
    syncToUrl(newFilter, selectedTags, sortBy)
  }

  const handleSetSort = (newSort: SortBy) => {
    setSortBy(newSort)
    syncToUrl(filter, selectedTags, newSort)
  }

  const handleToggleTag = (tag: string) => {
    const newTags = selectedTags.includes(tag)
      ? selectedTags.filter(t => t !== tag)
      : [...selectedTags, tag]
    setSelectedTags(newTags)
    syncToUrl(filter, newTags, sortBy)
  }

  const handleClearTags = () => {
    setSelectedTags([])
    syncToUrl(filter, [], sortBy)
  }

  useEffect(() => {
    // Skip the first fetch cycle when SSR data was already provided.
    // Subsequent filter/sort/tag changes clear this flag and fetch normally.
    if (ssrConsumed.current) {
      ssrConsumed.current = false
      return
    }

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
        } else if (filter === 'NEEDS_REVIEW') {
          url += '&status=PENDING_APPROVAL'
        }

        if (selectedTags.length > 0) {
          url += `&tags=${encodeURIComponent(selectedTags.join(','))}`
        }

        // Don't send sortBy for CLOSING_SOON — that filter has its own implicit ordering
        if (filter !== 'CLOSING_SOON' && sortBy !== 'newest') {
          url += `&sortBy=${sortBy}`
        }

        const response = await fetch(url, {
          credentials: 'include',
          cache: 'no-store',
        })
        if (response.ok) {
          const data = await response.json()
          const preds = data.predictions || []
          setPredictions(preds)
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
  }, [filter, selectedTags, sortBy])

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Welcome Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <Home className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">{t('title')}</h1>
            <p className="text-sm text-gray-500">{t('discover')}</p>
          </div>
        </div>
        <Link
          href="/create"
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-semibold shadow-sm hover:bg-blue-700 transition-all active:scale-95"
        >
          <Plus className="w-5 h-5" />
          <span>{t('newForecast')}</span>
        </Link>
      </div>

      {/* Filters */}
      <div className="mb-6 space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-5 h-5 text-gray-400" />
          <button
            onClick={() => handleSetFilter('ACTIVE')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${filter === 'ACTIVE'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            {t('filters.open')}
          </button>
          <button
            onClick={() => handleSetFilter('CLOSING_SOON')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${filter === 'CLOSING_SOON'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            {t('filters.closingSoon')}
          </button>
          <button
            onClick={() => handleSetFilter('PENDING')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${filter === 'PENDING'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            {t('filters.awaitingResolution')}
          </button>
          {isAdminOrApprover && (
            <button
              onClick={() => handleSetFilter('NEEDS_REVIEW')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${filter === 'NEEDS_REVIEW'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-100'
                }`}
            >
              {t('filters.needsReview')}
            </button>
          )}
          <button
            onClick={() => handleSetFilter('RESOLVED')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${filter === 'RESOLVED'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            {t('filters.resolved')}
          </button>
          <button
            onClick={() => handleSetFilter('ALL')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${filter === 'ALL'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            {t('filters.all')}
          </button>
        </div>

        {/* Sort Row — hidden for Closing Soon (has its own implicit ordering) */}
        {filter !== 'CLOSING_SOON' && (
          <div className="flex items-center gap-2 flex-wrap">
            <ArrowDownUp className="w-4 h-4 text-gray-400" />
            {([
              { value: 'newest', label: t('sort.newest') },
              { value: 'deadline', label: t('sort.byDeadline') },
              { value: 'cu', label: t('sort.mostStaked') },
            ] as { value: SortBy; label: string }[]).map(({ value, label }) => (
              <button
                key={value}
                onClick={() => handleSetSort(value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${sortBy === value
                  ? 'bg-gray-800 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Tag Multi-Select Filter */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Tags:</span>
            {selectedTags.length > 0 && (
              <button
                onClick={handleClearTags}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-500 transition-colors ml-1"
                aria-label="Clear all selected tags"
              >
                <X className="w-3 h-3" />
                Clear
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {STANDARD_TAGS.map((tag) => {
              const isSelected = selectedTags.includes(tag)
              return (
                <button
                  key={tag}
                  onClick={() => handleToggleTag(tag)}
                  aria-pressed={isSelected}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-150 ${isSelected
                    ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-600'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800'
                    }`}
                >
                  {tag}
                </button>
              )
            })}
          </div>
        </div>
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
          <p className="text-gray-500 font-medium">{t('loading')}</p>
        </div>
      ) : predictions.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center shadow-sm">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <TrendingUp className="w-10 h-10 text-blue-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">{t('empty')}</h2>
          <p className="text-gray-500 mb-8 max-w-md mx-auto text-lg">
            {t('emptyDesc')}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-lg font-bold text-gray-800 uppercase tracking-wider">
              {filter === 'ACTIVE' && t('openForecasts')}
              {filter === 'CLOSING_SOON' && t('closingSoon')}
              {filter === 'PENDING' && t('awaitingResolution')}
              {filter === 'NEEDS_REVIEW' && t('needsReview')}
              {filter === 'RESOLVED' && t('resolvedForecasts')}
              {filter === 'ALL' && t('allForecasts')}
            </h2>
            <span className="text-sm text-gray-500">{t('results', { count: predictions.length })}</span>
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
