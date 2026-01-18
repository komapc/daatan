'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { 
  TrendingUp, 
  Plus, 
  Loader2, 
  Calendar, 
  Users,
  ChevronRight,
} from 'lucide-react'

type Prediction = {
  id: string
  claimText: string
  domain?: string
  outcomeType: string
  status: string
  resolveByDatetime: string
  author: {
    id: string
    name: string
    username?: string
    image?: string
  }
  _count: {
    commitments: number
  }
}

export default function PredictionsPage() {
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchPredictions = async () => {
      try {
        const response = await fetch('/api/predictions?limit=50')
        if (response.ok) {
          const data = await response.json()
          setPredictions(data.predictions)
        }
      } catch (error) {
        console.error('Error fetching predictions:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchPredictions()
  }, [])

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      DRAFT: 'bg-gray-100 text-gray-700',
      ACTIVE: 'bg-green-100 text-green-700',
      PENDING: 'bg-yellow-100 text-yellow-700',
      RESOLVED_CORRECT: 'bg-blue-100 text-blue-700',
      RESOLVED_WRONG: 'bg-red-100 text-red-700',
      VOID: 'bg-gray-100 text-gray-700',
      UNRESOLVABLE: 'bg-orange-100 text-orange-700',
    }
    return styles[status] || 'bg-gray-100 text-gray-700'
  }

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
          {predictions.map((prediction) => (
            <Link
              key={prediction.id}
              href={`/predictions/${prediction.id}`}
              className="block p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-200 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* Status & Domain */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(prediction.status)}`}>
                      {prediction.status.replace('_', ' ')}
                    </span>
                    {prediction.domain && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full capitalize">
                        {prediction.domain}
                      </span>
                    )}
                  </div>

                  {/* Claim */}
                  <h2 className="text-lg font-medium text-gray-900 mb-2 line-clamp-2">
                    {prediction.claimText}
                  </h2>

                  {/* Meta */}
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {formatDate(prediction.resolveByDatetime)}
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {prediction._count.commitments} commitment{prediction._count.commitments !== 1 ? 's' : ''}
                    </div>
                    {prediction.author.image && (
                      <div className="flex items-center gap-1">
                        <img 
                          src={prediction.author.image} 
                          alt="" 
                          className="w-5 h-5 rounded-full"
                        />
                        <span>{prediction.author.name}</span>
                      </div>
                    )}
                  </div>
                </div>

                <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

