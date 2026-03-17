'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { createClientLogger } from '@/lib/client-logger'
import {
  User,
  Calendar,
  Target,
  Users,
  ExternalLink,
  Loader2,
  AlertCircle,
  ChevronLeft,
  Edit2,
  EyeOff,
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useTranslations } from 'next-intl'
import { ModeratorResolutionSection } from './ModeratorResolutionSection'
import CommentThread from '@/components/comments/CommentThread'
import CommitmentForm from '@/components/forecasts/CommitmentForm'
import CommitmentDisplay from '@/components/forecasts/CommitmentDisplay'
import CUBalanceIndicator from '@/components/forecasts/CUBalanceIndicator'
import Speedometer from '@/components/forecasts/Speedometer'
import ContextTimeline from '@/components/forecasts/ContextTimeline'
import { RoleBadge } from '@/components/RoleBadge'
import { UserLink } from '@/components/UserLink'

const log = createClientLogger('ForecastDetail')

type Prediction = {
  id: string
  slug?: string
  isPublic: boolean
  shareToken: string
  claimText: string
  detailsText?: string
  outcomeType: 'BINARY' | 'MULTIPLE_CHOICE' | 'NUMERIC_THRESHOLD'
  outcomePayload?: Record<string, unknown>
  status: string
  lockedAt?: string | null
  resolveByDatetime: string
  contextUpdatedAt?: string
  publishedAt?: string
  resolvedAt?: string
  resolutionOutcome?: string
  resolutionNote?: string
  evidenceLinks?: string[]
  resolutionRules?: string | null
  sentiment?: string | null
  confidence?: number | null
  extractedEntities?: string[]
  consensusLine?: string | null
  sourceSummary?: string | null
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
  userCommitment?: {
    id: string
    cuCommitted: number
    binaryChoice?: boolean
    optionId?: string
  }
}

interface ForecastInfoPanelProps {
  prediction: Prediction
  variant?: 'desktop' | 'mobile'
}

function ForecastInfoPanel({ prediction, variant = 'desktop' }: ForecastInfoPanelProps) {
  const t = useTranslations('forecast')
  return (
    <>
      <div className={variant === 'mobile' ? 'grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8' : 'grid grid-cols-1 gap-3'}>
        {/* Author */}
        <div className="p-4 border border-gray-200 rounded-xl bg-white shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">
            <User className="w-3.5 h-3.5" />
            {t('author')}
          </div>
          <UserLink
            userId={prediction.author.id}
            username={prediction.author.username}
            name={prediction.author.name}
            image={prediction.author.image}
            showAvatar={true}
            avatarSize={32}
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900">{prediction.author.name}</span>
                {prediction.author.role && (
                  <RoleBadge role={prediction.author.role} size="sm" />
                )}
              </div>
              <div className="text-xs text-gray-500">RS: {prediction.author.rs.toFixed(0)}</div>
            </div>
          </UserLink>
        </div>

        {/* Deadline */}
        <div className="p-4 border border-gray-200 rounded-xl bg-white shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">
            <Calendar className="w-3.5 h-3.5" />
            {t('deadline')}
          </div>
          <div className="text-gray-900 font-semibold truncate">
            {new Date(prediction.resolveByDatetime).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>
        </div>

        {/* Category/Tags */}
        <div className="p-4 border border-gray-200 rounded-xl bg-white shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">
            <Target className="w-3.5 h-3.5" />
            Tags
          </div>
          <div className="flex flex-wrap gap-1">
            {prediction.extractedEntities?.slice(0, 3).map((tag, i) => (
              <span key={i} className="px-2 py-0.5 bg-gray-50 text-gray-600 text-[10px] font-bold uppercase tracking-wider rounded border border-gray-100">
                {tag}
              </span>
            )) || <span className="text-gray-400 italic text-xs">None</span>}
          </div>
        </div>
      </div>
    </>
  )
}

export default function ForecastDetailClient({ initialData }: { initialData?: Prediction }) {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const { data: session } = useSession()
  const t = useTranslations('forecast')
  const [prediction, setPrediction] = useState<Prediction | null>(initialData || null)
  const [isLoading, setIsLoading] = useState(!initialData)
  const [error, setError] = useState<string | null>(null)
  const [isApproving, setIsApproving] = useState(false)

  const canEdit = session?.user?.id === prediction?.author.id || session?.user?.role === 'ADMIN'
  const canApprove = (session?.user?.role === 'ADMIN' || session?.user?.role === 'APPROVER') && prediction?.status === 'PENDING_APPROVAL'

  useEffect(() => {
    async function fetchPrediction() {
      if (initialData && (initialData.id === id || initialData.slug === id)) return
      
      try {
        const response = await fetch(`/api/forecasts/${id}`)
        if (!response.ok) {
          if (response.status === 404) throw new Error('Prediction not found')
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

    fetchPrediction()
  }, [id, initialData])

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleApproveAction = async (status: 'ACTIVE' | 'VOID') => {
    if (!prediction) return
    setIsApproving(true)
    try {
      const response = await fetch(`/api/admin/forecasts/${prediction.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (response.ok) {
        toast.success(status === 'ACTIVE' ? 'Approved successfully' : 'Rejected successfully')
        router.refresh()
        // Re-fetch local state
        const updated = await fetch(`/api/forecasts/${id}`).then(r => r.json())
        setPrediction(updated)
      } else {
        toast.error('Operation failed')
      }
    } catch (error) {
      log.error({ err: error }, 'Approval error')
      toast.error('An error occurred')
    } finally {
      setIsApproving(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'bg-gray-100 text-gray-700'
      case 'ACTIVE': return 'bg-green-100 text-green-700'
      case 'PENDING': return 'bg-yellow-100 text-yellow-700'
      case 'PENDING_APPROVAL': return 'bg-amber-100 text-amber-700'
      case 'RESOLVED_CORRECT': return 'bg-blue-100 text-blue-700'
      case 'RESOLVED_WRONG': return 'bg-red-100 text-red-700'
      case 'UNRESOLVABLE':
      case 'VOID': return 'bg-orange-100 text-orange-700'
      default: return 'bg-gray-100 text-gray-700'
    }
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
          <button 
            onClick={() => { router.push('/'); router.refresh(); }}
            className="text-blue-600 hover:underline"
          >
            Back to Feed
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Back Link */}
      <button
        onClick={() => { router.push('/'); router.refresh(); }}
        className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-700 mb-6"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to Feed
      </button>

      <div className="lg:grid lg:grid-cols-[1fr_360px] lg:gap-8 lg:items-start">
        {/* Left column */}
        <div className="min-w-0">

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge(prediction.status)}`}>
              {prediction.status.replace('_', ' ')}
            </span>
            {prediction.isPublic === false && (
              <span className="flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-600 text-sm font-medium rounded-full">
                <EyeOff className="w-4 h-4" />
                Unlisted
              </span>
            )}
          </div>
          {canEdit && (
            <div className="flex items-center gap-2">
              <Link
                href={`/forecasts/${prediction.slug || prediction.id}/edit`}
                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Edit forecast"
              >
                <Edit2 className="w-5 h-5" />
              </Link>
            </div>
          )}
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight leading-tight mb-4">
          {prediction.claimText}
        </h1>

        <div className="lg:hidden">
          <ForecastInfoPanel prediction={prediction} variant="mobile" />
        </div>

        {prediction.detailsText && (
          <div className="prose prose-sm max-w-none text-gray-700 mb-8 whitespace-pre-wrap">
            {prediction.detailsText}
          </div>
        )}
      </div>

      {/* Context/Timeline */}
      <ContextTimeline 
        predictionId={prediction.id} 
        canAnalyze={session?.user?.role === 'ADMIN' || session?.user?.role === 'RESOLVER'} 
      />

      {/* Probability Display (only for binary/MC) */}
      <div className="mb-8">
        {prediction.outcomeType === 'BINARY' && (() => {
          const yesVotes = prediction.commitments.filter(c => c.binaryChoice === true).length
          const totalVotes = prediction.commitments.length
          const prob = totalVotes > 0 ? Math.round((yesVotes / totalVotes) * 100) : 50
          
          return (
            <div className="flex flex-col items-center">
              <div className="w-full max-w-sm relative rounded-xl border border-gray-200 bg-white p-6 flex flex-col items-center justify-center hover:border-blue-300 transition-colors shadow-sm">
                <Speedometer
                  percentage={prob}
                  label={prob > 50 ? 'Likely' : prob < 50 ? 'Unlikely' : 'Toss-up'}
                  color={prob > 50 ? 'green' : 'red'}
                  size="lg"
                />
                <div className="w-full grid grid-cols-2 gap-4 mt-6">
                  <div className="text-center p-3 rounded-lg bg-green-50/50 border border-green-100/50">
                    <div className="text-xs font-bold text-green-600 uppercase tracking-wider mb-1">Yes</div>
                    <div className="text-xl font-bold text-gray-900">{prob}%</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-red-50/50 border border-red-100/50">
                    <div className="text-xs font-bold text-red-600 uppercase tracking-wider mb-1">No</div>
                    <div className="text-xl font-bold text-gray-900">{100 - prob}%</div>
                  </div>
                </div>
              </div>
            </div>
          )
        })()}

        {prediction.outcomeType === 'MULTIPLE_CHOICE' && prediction.options.length > 0 && (() => {
          const totalCommits = prediction.commitments.length
          const optionsWithStats = prediction.options.map(opt => ({
            ...opt,
            commitCount: prediction.commitments.filter(c => c.option?.id === opt.id).length,
            pct: totalCommits > 0 ? Math.round((prediction.commitments.filter(c => c.option?.id === opt.id).length / totalCommits) * 100) : 0
          })).sort((a, b) => b.commitCount - a.commitCount)

          const leadingOption = optionsWithStats[0]
          const otherOptions = optionsWithStats.slice(1)

          return (
            <div className="flex flex-col items-center">
              <div className="w-full max-w-sm relative rounded-xl border border-gray-200 bg-white p-6 flex flex-col items-center justify-center hover:border-blue-300 transition-colors shadow-sm mb-6">
                <Speedometer
                  percentage={leadingOption.pct}
                  label={`Leading: ${leadingOption.text}`}
                  color={leadingOption.isCorrect ? 'green' : 'green'} // Keep leading as green for "leading" context
                  size="lg"
                />
                <p className="mt-4 text-sm text-gray-500">
                  <span className="font-semibold text-gray-900">{leadingOption.commitCount}</span> commitment{leadingOption.commitCount !== 1 ? 's' : ''} ({leadingOption.pct}%)
                </p>
              </div>

              {otherOptions.length > 0 && (
                <div className="w-full max-w-sm space-y-2">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest text-center mb-3">Other Options</h4>
                  <div className="bg-gray-50/50 rounded-xl border border-gray-100 p-3 divide-y divide-gray-100">
                    {otherOptions.map(option => (
                      <div key={option.id} className="flex items-center justify-between py-2 text-sm">
                        <span className="text-gray-700 font-medium truncate pr-4">{option.text}</span>
                        <span className="text-gray-500 shrink-0 font-mono">{option.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })()}
      </div>

      {/* Commit Form — mobile only (desktop renders in right column) */}
      <div className="lg:hidden mb-8 p-5 border border-gray-200 rounded-xl bg-white shadow-sm space-y-6">
        <CUBalanceIndicator
          cuAvailable={session?.user?.cuAvailable ?? 0}
          cuLocked={session?.user?.cuLocked ?? 0}
        />
        <CommitmentForm
          prediction={prediction as any}
          existingCommitment={prediction.userCommitment}
          userCuAvailable={session?.user?.cuAvailable ?? 0}
          onSuccess={async () => {
            const updated = await fetch(`/api/forecasts/${id}`).then(r => r.json())
            setPrediction(updated)
            router.refresh()
          }}
        />
        {prediction.userCommitment && (
          <CommitmentDisplay
            commitment={prediction.userCommitment as any}
            prediction={prediction}
            onRemove={async () => {
              const updated = await fetch(`/api/forecasts/${id}`).then(r => r.json())
              setPrediction(updated)
              router.refresh()
            }}
          />
        )}
      </div>

      {/* Resolution Info (if resolved) */}
      {prediction.resolvedAt && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-8">
          <h3 className="font-semibold text-blue-800 mb-2">Resolution</h3>
          <p className="text-blue-700 mb-2">
            Resolved as <strong className={prediction.resolutionOutcome === 'wrong' ? 'text-red-600' : undefined}>{prediction.resolutionOutcome}</strong> on {formatDate(prediction.resolvedAt)}
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

      {/* Approval Section for PENDING_APPROVAL forecasts */}
      {canApprove && (
        <div className="mb-8 p-5 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            <h3 className="text-lg font-semibold text-amber-900">Pending Approval</h3>
          </div>
          <p className="text-sm text-amber-700 mb-4">
            This bot-generated forecast is awaiting human review before going live.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleApproveAction('ACTIVE')}
              disabled={isApproving}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {isApproving ? 'Approving…' : 'Approve'}
            </button>
            <button
              onClick={() => handleApproveAction('VOID')}
              disabled={isApproving}
              className="flex items-center gap-1.5 px-4 py-2 bg-white border border-red-200 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              Reject
            </button>
          </div>
          {(prediction.sentiment || prediction.confidence != null || prediction.consensusLine) && (
            <div className="mt-3 p-3 bg-indigo-50 border border-indigo-100 rounded-lg space-y-1.5 text-sm">
              {prediction.sentiment && (
                <div className="flex items-center gap-2">
                  <span className="font-medium text-indigo-900">Sentiment:</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    prediction.sentiment === 'positive' ? 'bg-green-100 text-green-700' :
                    prediction.sentiment === 'negative' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {prediction.sentiment}
                  </span>
                </div>
              )}
              {prediction.confidence != null && (
                <div className="text-indigo-900">Confidence: <span className="font-medium">{prediction.confidence}%</span></div>
              )}
              {prediction.consensusLine && (
                <p className="italic text-gray-600">&quot;{prediction.consensusLine}&quot;</p>
              )}
              {prediction.extractedEntities && prediction.extractedEntities.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {prediction.extractedEntities.map((entity, i) => (
                    <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                      {entity}
                    </span>
                  ))}
                </div>
              )}
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
                <UserLink
                  userId={commitment.user.id}
                  username={commitment.user.username}
                  name={commitment.user.name}
                  image={commitment.user.image}
                  showAvatar={true}
                  avatarSize={32}
                >
                  <div>
                    <div className="font-medium text-gray-900">{commitment.user.name}</div>
                    <div className="text-sm text-gray-500">
                      {prediction.outcomeType === 'BINARY'
                        ? (commitment.binaryChoice ? 'Will happen' : 'Won\'t happen')
                        : commitment.option?.text
                      }
                    </div>
                  </div>
                </UserLink>
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

        </div>{/* end left column */}

        {/* Right column — sticky on desktop */}
        <div className="hidden lg:block lg:sticky lg:top-8 space-y-4">
          <ForecastInfoPanel
            prediction={prediction}
          />
          
          <div className="p-5 border border-gray-200 rounded-xl bg-white shadow-sm space-y-6">
            <CUBalanceIndicator 
              cuAvailable={session?.user?.cuAvailable ?? 0} 
              cuLocked={session?.user?.cuLocked ?? 0} 
            />
            <CommitmentForm 
              prediction={prediction as any}
              existingCommitment={prediction.userCommitment}
              userCuAvailable={session?.user?.cuAvailable ?? 0}
              onSuccess={async () => {
                const updated = await fetch(`/api/forecasts/${id}`).then(r => r.json())
                setPrediction(updated)
                router.refresh()
              }}
            />
          </div>
          
          {prediction.userCommitment && (
            <CommitmentDisplay 
              commitment={prediction.userCommitment as any} 
              prediction={prediction}
              onRemove={async () => {
                const updated = await fetch(`/api/forecasts/${id}`).then(r => r.json())
                setPrediction(updated)
                router.refresh()
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
