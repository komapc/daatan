'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { 
  TrendingUp, 
  Plus, 
  Loader2
} from 'lucide-react'
import PredictionCard, { Prediction } from '@/components/predictions/PredictionCard'

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
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {predictions.map((prediction) => (
            <PredictionCard key={prediction.id} prediction={prediction} />
          ))}
        </div>
      )}
    </div>
  )
}

