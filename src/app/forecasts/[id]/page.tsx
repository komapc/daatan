'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import Image from 'next/image'
import { createClientLogger } from '@/lib/client-logger'
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
  Edit2,
  Trash2,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { ModeratorResolutionSection } from './ModeratorResolutionSection'
import CommentThread from '@/components/comments/CommentThread'
import CommitmentForm from '@/components/forecasts/CommitmentForm'
import CommitmentDisplay from '@/components/forecasts/CommitmentDisplay'
import CUBalanceIndicator from '@/components/forecasts/CUBalanceIndicator'
import Speedometer from '@/components/forecasts/Speedometer'
import { RoleBadge } from '@/components/RoleBadge'

const log = createClientLogger('ForecastDetail')

type Prediction = {
  id: string
  slug?: string
  claimText: string
  detailsText?: string
  outcomeType: 'BINARY' | 'MULTIPLE_CHOICE' | 'NUMERIC_THRESHOLD'
  outcomePayload?: Record<string, unknown>
  status: string
  resolveByDatetime: string
  contextUpdatedAt?: string
  publishedAt?: string
  resolvedAt?: string
  resolutionOutcome?: string
  resolutionNote?: string
  evidenceLinks?: string[]
  resolutionRules?: string | null
  author: {
    id: string
    name: string
    username?: string
    image?: string
    rs: number
    role?: 'USER' | 'RESOLVER' | 'ADMIN'
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
    rsSnapshot: number
    createdAt: string
    cuReturned?: number | null
    rsChange?: number | null
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
  const router = useRouter()
  const { data: session, update: updateSession } = useSession()
  const [prediction, setPrediction] = useState<Prediction | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCommitmentForm, setShowCommitmentForm] = useState(false)

  useEffect(() => {
    const fetchPrediction = async () => {
      try {
        // Support both ID and slug
        const response = await fetch(`/api/forecasts/${params.id}`)
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

  const handleCommitmentSuccess = async () => {
    setShowCommitmentForm(false)
    // Update session to get fresh CU balance
    await updateSession()

    // Refetch prediction to get updated commitments
    const fetchPrediction = async () => {
      try {
        const response = await fetch(`/api/forecasts/${params.id}`)
        if (response.ok) {
          const data = await response.json()
          setPrediction(data)
        }
      } catch (err) {
        log.error({ err }, 'Failed to refetch prediction')
      }
    }
    fetchPrediction()
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this prediction? This action cannot be undone.')) return

    try {
      const response = await fetch(`/api/admin/forecasts/${prediction?.id}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        router.push('/')
        toast.success('Prediction deleted successfully')
      } else {
        toast.error('Failed to delete prediction')
      }
    } catch (error) {
      log.error({ err: error }, 'Error deleting prediction')
      toast.error('Error deleting prediction')
    }
  }

  const handleEdit = () => {
    if (!prediction?.id) return
    router.push(`/forecasts/${prediction.slug || prediction.id}/edit`)
  }

  const canAdminister = session?.user?.role === 'ADMIN'

  // Find user's commitment if exists
  const userCommitment = session?.user?.id
    ? prediction?.commitments.find(c => c.user.id === session.user.id)
    : undefined

  const canCommit = session?.user?.id &&
    prediction?.status === 'ACTIVE' &&
    !userCommitment

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
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge(prediction.status)}`}>
              {prediction.status.replace('_', ' ')}
            </span>
          </div>

          {canAdminister && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleEdit}
                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                title="Edit Prediction"
              >
                <Edit2 className="w-5 h-5" />
              </button>
              <button
                onClick={handleDelete}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                title="Delete Forecast"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
          {prediction.claimText}
        </h1>
        {prediction.detailsText && (
          <div className="mb-4">
            <p className="text-gray-600 whitespace-pre-wrap leading-relaxed">{prediction.detailsText}</p>
            {prediction.contextUpdatedAt && (
              <p className="text-xs text-gray-400 mt-2">
                Context last updated: {new Date(prediction.contextUpdatedAt).toLocaleString()}
              </p>
            )}
          </div>
        )}
        {(canAdminister || session?.user?.id === prediction.author.id) && prediction.status === 'ACTIVE' && (
          <div className="mb-4">
            <button
              onClick={async () => {
                const btn = document.getElementById('analyze-context-btn') as HTMLButtonElement
                if (btn) btn.disabled = true
                const orgText = btn ? btn.innerText : 'Analyze'
                if (btn) btn.innerText = 'Analyzing...'
                toast.loading('Analyzing latest news...', { id: 'analyze' })
                try {
                  const res = await fetch(`/api/forecasts/${prediction.id}/context`, {
                    method: 'POST',
                  })
                  if (!res.ok) {
                    const data = await res.json()
                    throw new Error(data.error || 'Failed to analyze context')
                  }
                  toast.success('Context updated!', { id: 'analyze' })
                  // Force a reload to get the new text
                  window.location.reload()
                } catch (e: any) {
                  toast.error(e.message, { id: 'analyze' })
                  if (btn) btn.disabled = false
                  if (btn) btn.innerText = orgText
                }
              }}
              id="analyze-context-btn"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
            >
              Analyze Context
            </button>
          </div>
        )}
        {prediction.resolutionRules && (
          <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-lg text-sm text-gray-700">
            <div className="font-semibold text-blue-900 mb-1 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" />
              Resolution Rules
            </div>
            {prediction.resolutionRules}
          </div>
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
        <div className="p-4 border border-gray-200 rounded-xl bg-white shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">
            <User className="w-3.5 h-3.5" />
            Author
          </div>
          <div className="flex items-center gap-2">
            {prediction.author.image && (
              <Image
                src={prediction.author.image}
                alt=""
                width={32}
                height={32}
                className="rounded-full"
              />
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900">{prediction.author.name}</span>
                {prediction.author.role && (
                  <RoleBadge role={prediction.author.role} size="sm" />
                )}
              </div>
              <div className="text-xs text-gray-500">RS: {prediction.author.rs.toFixed(0)}</div>
            </div>
          </div>
        </div>

        {/* Deadline */}
        <div className="p-4 border border-gray-200 rounded-xl bg-white shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">
            <Calendar className="w-3.5 h-3.5" />
            Resolution Deadline
          </div>
          <div className="font-semibold text-gray-900">
            {formatDate(prediction.resolveByDatetime)}
          </div>
        </div>

        {/* Commitments */}
        <div className="p-4 border border-gray-200 rounded-xl bg-white shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">
            <Users className="w-3.5 h-3.5" />
            Commitments
          </div>
          <div className="font-semibold text-gray-900">
            {prediction._count.commitments} users &middot; {prediction.totalCuCommitted} CU
          </div>
        </div>
      </div>

      {/* User's Commitment Section */}
      {session?.user && prediction.status === 'ACTIVE' && (
        <div className="mb-8 space-y-4">
          {/* CU Balance */}
          <CUBalanceIndicator
            cuAvailable={session.user.cuAvailable || 0}
            cuLocked={session.user.cuLocked || 0}
          />
          {userCommitment && !showCommitmentForm ? (
            <CommitmentDisplay
              commitment={userCommitment}
              prediction={prediction}
              onEdit={() => setShowCommitmentForm(true)}
              onRemove={handleCommitmentSuccess}
            />
          ) : userCommitment && showCommitmentForm ? (
            <CommitmentForm
              prediction={prediction}
              existingCommitment={userCommitment}
              userCuAvailable={session.user.cuAvailable || 0}
              onSuccess={handleCommitmentSuccess}
              onCancel={() => setShowCommitmentForm(false)}
            />
          ) : (
            <CommitmentForm
              prediction={prediction}
              userCuAvailable={session.user.cuAvailable || 0}
              onSuccess={handleCommitmentSuccess}
            />
          )}
        </div>
      )}

      {/* Sign in prompt for non-authenticated users */}
      {!session?.user && prediction.status === 'ACTIVE' && (
        <div className="mb-8 p-5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl text-center">
          <p className="text-gray-600 mb-3">Want to commit to this prediction?</p>
          <Link
            href="/auth/signin"
            className="inline-block py-2.5 px-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-sm hover:shadow-md"
          >
            Sign In to Commit
          </Link>
        </div>
      )}

      {/* Outcome Type */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Target className="w-5 h-5" />
          Outcome
        </h2>

        {prediction.outcomeType === 'BINARY' && (() => {
          const yesCount = prediction.commitments.filter(c => c.binaryChoice === true).length
          const noCount = prediction.commitments.filter(c => c.binaryChoice === false).length
          const total = yesCount + noCount
          const yesPct = total > 0 ? Math.round((yesCount / total) * 100) : 50
          const noPct = total > 0 ? 100 - yesPct : 50

          return (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* YES Speedometer */}
                <div className="relative rounded-xl border border-gray-200 bg-white p-4 flex flex-col items-center justify-center hover:border-green-300 transition-colors">
                  <Speedometer
                    percentage={yesPct}
                    label="Will Happen"
                    color="green"
                    size="sm"
                  />
                  <p className="mt-2 text-sm text-gray-500">
                    <span className="font-semibold text-gray-700">{yesCount}</span> commitment{yesCount !== 1 ? 's' : ''}
                  </p>
                </div>

                {/* NO Speedometer */}
                <div className="relative rounded-xl border border-gray-200 bg-white p-4 flex flex-col items-center justify-center hover:border-red-300 transition-colors">
                  <Speedometer
                    percentage={noPct}
                    label="Won't Happen"
                    color="red"
                    size="sm"
                  />
                  <p className="mt-2 text-sm text-gray-500">
                    <span className="font-semibold text-gray-700">{noCount}</span> commitment{noCount !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            </div>
          )
        })()}

        {prediction.outcomeType === 'MULTIPLE_CHOICE' && prediction.options.length > 0 && (() => {
          const totalCommits = prediction.commitments.length
          return (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {prediction.options.map((option) => {
                const commitCount = prediction.commitments.filter(c => c.option?.id === option.id).length
                const pct = totalCommits > 0 ? Math.round((commitCount / totalCommits) * 100) : 0
                return (
                  <div
                    key={option.id}
                    className={`relative rounded-xl border bg-white p-4 flex flex-col items-center justify-center overflow-hidden transition-colors ${option.isCorrect
                      ? 'border-green-400 ring-1 ring-green-200'
                      : 'border-gray-200 hover:border-gray-300'
                      }`}
                  >
                    <Speedometer
                      percentage={pct}
                      label={option.text}
                      color={option.isCorrect ? 'green' : 'red'}
                      size="sm"
                    />
                    <p className="mt-2 text-xs text-gray-500">
                      <span className="font-semibold text-gray-700">{commitCount}</span> commitment{commitCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                )
              })}
            </div>
          )
        })()}
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
        outcomeType={prediction.outcomeType}
        options={prediction.options}
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
                    <Image
                      src={commitment.user.image}
                      alt=""
                      width={32}
                      height={32}
                      className="rounded-full"
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

