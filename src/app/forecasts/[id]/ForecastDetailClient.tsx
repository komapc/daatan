'use client'

import { useEffect, useRef, useState } from 'react'
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
  ChevronDown,
  ChevronUp,
  Edit2,
  EyeOff,
  Languages,
  Info,
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useTranslations, useLocale } from 'next-intl'
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
  source?: string | null
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
  isMounted: boolean
}

function ForecastInfoPanel({ prediction, variant = 'desktop', isMounted }: ForecastInfoPanelProps) {
  const t = useTranslations('forecast')
  return (
    <>
      <div className={variant === 'mobile' ? 'grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8' : 'grid grid-cols-1 gap-3'}>
        {/* Author */}
        <div className="p-4 border border-navy-600 rounded-xl bg-navy-700 shadow-sm">
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
                <span className="font-semibold text-white">{prediction.author.name}</span>
                {prediction.author.role && (
                  <RoleBadge role={prediction.author.role} size="sm" />
                )}
              </div>
              <div className="text-xs text-gray-500">RS: {prediction.author.rs.toFixed(0)}</div>
            </div>
          </UserLink>
        </div>

        {/* Deadline */}
        <div className="p-4 border border-navy-600 rounded-xl bg-navy-700 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">
            <Calendar className="w-3.5 h-3.5" />
            {t('deadline')}
          </div>
          <div className="text-white font-semibold truncate" suppressHydrationWarning>
            {isMounted && new Date(prediction.resolveByDatetime).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>
        </div>

        {/* Category/Tags */}
        <div className="p-4 border border-navy-600 rounded-xl bg-navy-700 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">
            <Target className="w-3.5 h-3.5" />
            Tags
          </div>
          <div className="flex flex-wrap gap-1">
            {prediction.extractedEntities?.slice(0, 3).map((tag, i) => (
              <span key={i} className="px-2 py-0.5 bg-navy-800 text-gray-600 text-[10px] font-bold uppercase tracking-wider rounded border border-navy-600">
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
  const tt = useTranslations('translate')
  const locale = useLocale()
  const [prediction, setPrediction] = useState<Prediction | null>(initialData || null)
  const [isLoading, setIsLoading] = useState(!initialData)
  // Capture initialData at mount only — used in the fetch effect so that
  // router.refresh() (which changes the initialData prop) does NOT re-trigger
  // a fetch that would overwrite freshly-set local state.
  const initialDataRef = useRef(initialData)
  const [error, setError] = useState<string | null>(null)
  const [isApproving, setIsApproving] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [showRules, setShowRules] = useState(false)

  // Translation state
  const [translatedFields, setTranslatedFields] = useState<Record<string, string> | null>(null)
  const [isTranslating, setIsTranslating] = useState(false)
  const [showTranslated, setShowTranslated] = useState(locale !== 'en')

  const canEdit = session?.user?.id === prediction?.author.id || session?.user?.role === 'ADMIN'
  const canApprove = (session?.user?.role === 'ADMIN' || session?.user?.role === 'APPROVER') && prediction?.status === 'PENDING_APPROVAL'

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    const initial = initialDataRef.current
    async function fetchPrediction() {
      if (initial && (initial.id === id || initial.slug === id)) return

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
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Automatic translation effect
  useEffect(() => {
    if (!prediction || locale === 'en' || translatedFields) return

    async function triggerTranslation() {
      setIsTranslating(true)
      try {
        const response = await fetch(`/api/forecasts/${prediction?.id}/translate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ language: locale }),
        })
        if (response.ok) {
          const data = await response.json()
          setTranslatedFields(data)
        }
      } catch (err) {
        log.error({ err }, 'Failed to translate prediction')
      } finally {
        setIsTranslating(false)
      }
    }

    triggerTranslation()
  }, [prediction, locale, translatedFields])
  const formatDate = (date: string | Date) => {
    if (!isMounted) return ''
    return new Date(date).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
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
        const updated = await fetch(`/api/forecasts/${id}`).then(r => r.json())
        setPrediction(updated)
        router.refresh()
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
      case 'DRAFT': return 'bg-navy-700 text-text-secondary'
      case 'ACTIVE': return 'bg-green-100 text-teal'
      case 'PENDING': return 'bg-yellow-100 text-yellow-700'
      case 'PENDING_APPROVAL': return 'bg-amber-100 text-amber-400'
      case 'RESOLVED_CORRECT': return 'bg-blue-100 text-cobalt-light'
      case 'RESOLVED_WRONG': return 'bg-red-100 text-red-400'
      case 'UNRESOLVABLE':
      case 'VOID': return 'bg-orange-100 text-orange-700'
      default: return 'bg-navy-700 text-text-secondary'
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
          <h2 className="text-xl font-semibold text-white mb-2">
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
        className="inline-flex items-center gap-1 text-gray-500 hover:text-text-secondary mb-6"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to Feed
      </button>

      <div className="xl:grid xl:grid-cols-[1fr_360px] xl:gap-8 xl:items-start">
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
              <span className="flex items-center gap-1 px-3 py-1 bg-navy-700 text-gray-600 text-sm font-medium rounded-full">
                <EyeOff className="w-4 h-4" />
                Unlisted
              </span>
            )}
            {!prediction.newsAnchor && prediction.source === 'manual' && (
              <span className="inline-flex items-center gap-1 px-3 py-1 text-sm font-medium text-purple-400 bg-purple-400/10 rounded-full border border-purple-400/20">
                Personal
              </span>
            )}
            {locale !== 'en' && (
              <button
                onClick={() => setShowTranslated(!showTranslated)}
                disabled={isTranslating}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  showTranslated 
                    ? 'bg-blue-100 text-cobalt-light hover:bg-blue-200' 
                    : 'bg-navy-700 text-gray-600 hover:bg-navy-600'
                }`}
              >
                {isTranslating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Languages className="w-3.5 h-3.5" />
                )}
                {showTranslated ? tt('showOriginal') : tt('translate')}
              </button>
            )}
          </div>
          {canEdit && (
            <div className="flex items-center gap-2">
              <Link
                href={`/forecasts/${prediction.slug || prediction.id}/edit`}
                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-cobalt/10 rounded-lg transition-colors"
                title="Edit forecast"
              >
                <Edit2 className="w-5 h-5" />
              </Link>
            </div>
          )}
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight leading-tight mb-4 break-words">
          {showTranslated && translatedFields?.claimText ? translatedFields.claimText : prediction.claimText}
        </h1>

        <div className="xl:hidden">
          <ForecastInfoPanel prediction={prediction} variant="mobile" isMounted={isMounted} />
        </div>

        {(showTranslated && translatedFields) && (
          <div className="flex items-start gap-2 p-3 mb-6 bg-cobalt/10/50 border border-cobalt/20 rounded-lg text-xs text-cobalt-light italic">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <p>{tt('disclaimer')}</p>
          </div>
        )}

        {(showTranslated && translatedFields?.detailsText ? translatedFields.detailsText : prediction.detailsText) && (
          <div className="prose prose-sm max-w-none text-text-secondary mb-8 whitespace-pre-wrap">
            {showTranslated && translatedFields?.detailsText ? translatedFields.detailsText : prediction.detailsText}
          </div>
        )}
      </div>

      {/* Resolution Rules */}
      {prediction.resolutionRules && (
        <div className="mb-6">
          <button
            type="button"
            onClick={() => setShowRules(v => !v)}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-400 hover:text-text-secondary transition-colors"
          >
            {showRules ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            Resolution Rules
          </button>
          {showRules && (
            <div className="mt-2 p-3 bg-navy-800 border border-navy-600 rounded-lg text-sm text-text-secondary whitespace-pre-wrap">
              {prediction.resolutionRules}
            </div>
          )}
        </div>
      )}

      {/* Context/Timeline */}
      <ContextTimeline
        predictionId={prediction.id} 
        canAnalyze={session?.user?.role === 'ADMIN' || session?.user?.role === 'RESOLVER'} 
      />

      {/* Probability Display (only for binary/MC) */}
      <div className="mb-8">
        {prediction.outcomeType === 'BINARY' && (() => {
          const yesTokens = prediction.commitments.filter(c => c.binaryChoice === true).reduce((sum, c) => sum + c.cuCommitted, 0)
          const totalTokens = prediction.commitments.reduce((sum, c) => sum + c.cuCommitted, 0)
          const prob = totalTokens > 0 ? Math.round((yesTokens / totalTokens) * 100) : 50
          
          return (
            <div className="flex flex-col items-center">
              <div className="w-full max-w-sm relative rounded-xl border border-navy-600 bg-navy-700 p-6 flex flex-col items-center justify-center hover:border-blue-300 transition-colors shadow-sm">
                <Speedometer
                  percentage={prob}
                  label={prob > 50 ? 'Likely' : prob < 50 ? 'Unlikely' : 'Toss-up'}
                  color={prob > 50 ? 'green' : 'red'}
                  size="lg"
                />
                <div className="w-full grid grid-cols-2 gap-4 mt-6">
                  <div className="text-center p-3 rounded-lg bg-teal/10/50 border border-teal/20/50">
                    <div className="text-xs font-bold text-green-600 uppercase tracking-wider mb-1">Yes</div>
                    <div className="text-xl font-bold text-white">{prob}%</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-red-900/20/50 border border-red-800/40/50">
                    <div className="text-xs font-bold text-red-600 uppercase tracking-wider mb-1">No</div>
                    <div className="text-xl font-bold text-white">{100 - prob}%</div>
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
              <div className="w-full max-w-sm relative rounded-xl border border-navy-600 bg-navy-700 p-6 flex flex-col items-center justify-center hover:border-blue-300 transition-colors shadow-sm mb-6">
                <Speedometer
                  percentage={leadingOption.pct}
                  label={`Leading: ${leadingOption.text}`}
                  color={leadingOption.isCorrect ? 'green' : 'green'} // Keep leading as green for "leading" context
                  size="lg"
                />
                <p className="mt-4 text-sm text-gray-500">
                  <span className="font-semibold text-white">{leadingOption.commitCount}</span> commitment{leadingOption.commitCount !== 1 ? 's' : ''} ({leadingOption.pct}%)
                </p>
              </div>

              {otherOptions.length > 0 && (
                <div className="w-full max-w-sm space-y-2">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest text-center mb-3">Other Options</h4>
                  <div className="bg-navy-800/50 rounded-xl border border-navy-600 p-3 divide-y divide-gray-100">
                    {otherOptions.map(option => (
                      <div key={option.id} className="flex items-center justify-between py-2 text-sm">
                        <span className="text-text-secondary font-medium truncate pr-4">{option.text}</span>
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
      <div className="xl:hidden mb-8 p-5 border border-navy-600 rounded-xl bg-navy-700 shadow-sm space-y-6">
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
        <div className="p-4 bg-cobalt/10 border border-cobalt/30 rounded-lg mb-8">
          <h3 className="font-semibold text-cobalt-light mb-2">Resolution</h3>
          <p className="text-cobalt-light mb-2">
            Resolved as <strong className={prediction.resolutionOutcome === 'wrong' ? 'text-red-600' : undefined}>{prediction.resolutionOutcome}</strong> on {formatDate(prediction.resolvedAt)}
          </p>
          {prediction.resolutionNote && (
            <p className="text-sm text-blue-600">{prediction.resolutionNote}</p>
          )}
          {prediction.evidenceLinks && prediction.evidenceLinks.length > 0 && (
            <div className="mt-3">
              <div className="text-sm font-medium text-cobalt-light mb-1">Evidence:</div>
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
        <div className="mb-8 p-5 bg-amber-900/20 border border-amber-700/40 rounded-xl">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            <h3 className="text-lg font-semibold text-amber-900">Pending Approval</h3>
          </div>
          <p className="text-sm text-amber-400 mb-4">
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
              className="flex items-center gap-1.5 px-4 py-2 bg-navy-700 border border-red-800/50 text-red-600 text-sm font-medium rounded-lg hover:bg-red-900/20 disabled:opacity-50 transition-colors"
            >
              Reject
            </button>
          </div>
          {(prediction.sentiment || prediction.confidence != null || prediction.consensusLine) && (
            <div className="mt-3 p-3 bg-cobalt/10 border border-indigo-100 rounded-lg space-y-1.5 text-sm">
              {prediction.sentiment && (
                <div className="flex items-center gap-2">
                  <span className="font-medium text-indigo-900">Sentiment:</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    prediction.sentiment === 'positive' ? 'bg-green-100 text-teal' :
                    prediction.sentiment === 'negative' ? 'bg-red-100 text-red-400' :
                    'bg-navy-700 text-text-secondary'
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
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" />
            All Commitments
          </h2>
          <div className="border border-navy-600 rounded-lg divide-y divide-gray-100">
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
                    <div className="font-medium text-white">{commitment.user.name}</div>
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
      <div className="border-t border-navy-600 pt-8">
        <CommentThread predictionId={prediction.id} />
      </div>

        </div>{/* end left column */}

        {/* Right column — sticky on desktop */}
        <div className="hidden xl:block xl:sticky xl:top-8 space-y-4">
          <ForecastInfoPanel
            prediction={prediction}
            isMounted={isMounted}
          />
          
          <div className="p-5 border border-navy-600 rounded-xl bg-navy-700 shadow-sm space-y-6">
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
