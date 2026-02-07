'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { 
  Newspaper, 
  User, 
  Calendar, 
  Target, 
  Users,
  ExternalLink,
  Loader2,
  AlertCircle,
  ChevronLeft,
} from 'lucide-react'
import { ModeratorResolutionSection } from './ModeratorResolutionSection'
import CommentThread from '@/components/comments/CommentThread'

type Prediction = {
  id: string
  claimText: string
  detailsText?: string
  domain?: string
  outcomeType: 'BINARY' | 'MULTIPLE_CHOICE' | 'NUMERIC_THRESHOLD'
  outcomePayload?: Record<string, unknown>
  status: string
  resolveByDatetime: string
  publishedAt?: string
  resolvedAt?: string
  resolutionOutcome?: string
  resolutionNote?: string
  evidenceLinks?: string[]
  author: {
    id: string
    name: string
    username?: string
    image?: string
    rs: number
  }
  newsAnchor?: {
    id: string
    title: string
    url: string
    source?: string
  }
  options: Array<{
    id: string
    text: string
    isCorrect?: boolean
  }>
  commitments: Array<{
    id: string
    cuCommitted: number
    binaryChoice?: boolean
    user: {
      id: string
      name: string
      username?: string
      image?: string
    }
    option?: {
      id: string
      text: string
    }
  }>
  totalCuCommitted: number
  _count: {
    commitments: number
  }
}

export default function PredictionDetailPage() {
  const params = useParams()
  const [prediction, setPrediction] = useState<Prediction | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchPrediction = async () => {
      try {
        const response = await fetch(`/api/predictions/${params.id}`)
        if (!response.ok) {
          throw new Error('Failed to load prediction')
        }
        const data = await response.json()
        setPrediction(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      } finally {
        setIsLoading(false)
      }
    }

    if (params.id) {
      fetchPrediction()
    }
  }, [params.id])

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    )
  }

  if (error || !prediction) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {error || 'Prediction not found'}
          </h2>
          <Link href="/" className="text-blue-600 hover:underline">
            Back to Feed
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      {/* Back Link */}
      <Link 
        href="/"
        className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-700 mb-6"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to Feed
      </Link>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-3">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge(prediction.status)}`}>
            {prediction.status.replace('_', ' ')}
          </span>
          {prediction.domain && (
            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full capitalize">
              {prediction.domain}
            </span>
          )}
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
          {prediction.claimText}
        </h1>
        {prediction.detailsText && (
          <p className="text-gray-600">{prediction.detailsText}</p>
        )}
      </div>

      {/* News Anchor */}
      {prediction.newsAnchor && (
        <div className="p-4 bg-gray-50 rounded-lg mb-6">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Newspaper className="w-4 h-4" />
            Related News
          </div>
          <a 
            href={prediction.newsAnchor.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-gray-900 hover:text-blue-600 flex items-center gap-1"
          >
            {prediction.newsAnchor.title}
            <ExternalLink className="w-4 h-4" />
          </a>
          <span className="text-sm text-gray-500">
            {prediction.newsAnchor.source || new URL(prediction.newsAnchor.url).hostname}
          </span>
        </div>
      )}

      {/* Info Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {/* Author */}
        <div className="p-4 border border-gray-200 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <User className="w-4 h-4" />
            Author
          </div>
          <div className="flex items-center gap-2">
            {prediction.author.image && (
              <img 
                src={prediction.author.image} 
                alt="" 
                className="w-8 h-8 rounded-full"
              />
            )}
            <div>
              <div className="font-medium">{prediction.author.name}</div>
              <div className="text-xs text-gray-500">RS: {prediction.author.rs.toFixed(0)}</div>
            </div>
          </div>
        </div>

        {/* Deadline */}
        <div className="p-4 border border-gray-200 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Calendar className="w-4 h-4" />
            Resolution Deadline
          </div>
          <div className="font-medium">
            {formatDate(prediction.resolveByDatetime)}
          </div>
        </div>

        {/* Commitments */}
        <div className="p-4 border border-gray-200 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Users className="w-4 h-4" />
            Commitments
          </div>
          <div className="font-medium">
            {prediction._count.commitments} users • {prediction.totalCuCommitted} CU
          </div>
        </div>
      </div>

      {/* Outcome Type */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Target className="w-5 h-5" />
          Outcome
        </h2>
        
        {prediction.outcomeType === 'BINARY' && (
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 border-2 border-green-200 bg-green-50 rounded-lg text-center">
              <div className="text-lg font-semibold text-green-700">Will Happen</div>
              <div className="text-sm text-green-600">
                {prediction.commitments.filter(c => c.binaryChoice === true).length} commitments
              </div>
            </div>
            <div className="p-4 border-2 border-red-200 bg-red-50 rounded-lg text-center">
              <div className="text-lg font-semibold text-red-700">Won&apos;t Happen</div>
              <div className="text-sm text-red-600">
                {prediction.commitments.filter(c => c.binaryChoice === false).length} commitments
              </div>
            </div>
          </div>
        )}

        {prediction.outcomeType === 'MULTIPLE_CHOICE' && prediction.options.length > 0 && (
          <div className="space-y-2">
            {prediction.options.map((option) => {
              const commitCount = prediction.commitments.filter(c => c.option?.id === option.id).length
              return (
                <div 
                  key={option.id}
                  className={`p-3 border rounded-lg flex justify-between items-center ${
                    option.isCorrect ? 'border-green-500 bg-green-50' : 'border-gray-200'
                  }`}
                >
                  <span className={option.isCorrect ? 'font-medium text-green-700' : ''}>
                    {option.text}
                  </span>
                  <span className="text-sm text-gray-500">
                    {commitCount} commitment{commitCount !== 1 ? 's' : ''}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Resolution Info (if resolved) */}
      {prediction.resolvedAt && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-8">
          <h3 className="font-semibold text-blue-800 mb-2">Resolution</h3>
          <p className="text-blue-700 mb-2">
            Resolved as <strong>{prediction.resolutionOutcome}</strong> on {formatDate(prediction.resolvedAt)}
          </p>
          {prediction.resolutionNote && (
            <p className="text-sm text-blue-600">{prediction.resolutionNote}</p>
          )}
          {prediction.evidenceLinks && prediction.evidenceLinks.length > 0 && (
            <div className="mt-3">
              <div className="text-sm font-medium text-blue-800 mb-1">Evidence:</div>
              <ul className="space-y-1">
                {prediction.evidenceLinks.map((link, i) => (
                  <li key={i}>
                    <a 
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                    >
                      {link}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Moderator Resolution Section */}
      <ModeratorResolutionSection 
        predictionId={prediction.id} 
        predictionStatus={prediction.status}
      />

      {/* Commitments List */}
      {prediction.commitments.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" />
            All Commitments
          </h2>
          <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
            {prediction.commitments.map((commitment) => (
              <div key={commitment.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {commitment.user.image && (
                    <img 
                      src={commitment.user.image} 
                      alt="" 
                      className="w-8 h-8 rounded-full"
                    />
                  )}
                  <div>
                    <div className="font-medium">{commitment.user.name}</div>
                    <div className="text-sm text-gray-500">
                      {prediction.outcomeType === 'BINARY' 
                        ? (commitment.binaryChoice ? 'Will happen' : 'Won\'t happen')
                        : commitment.option?.text
                      }
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-blue-600">{commitment.cuCommitted} CU</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comments Section */}
      <div className="border-t border-gray-200 pt-8">
        <CommentThread predictionId={prediction.id} />
      </div>
    </div>
  )
}

