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
  TrendingUp,
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
import ConfidenceSlider from '@/components/forecasts/ConfidenceSlider'
import CommitmentDisplay from '@/components/forecasts/CommitmentDisplay'
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
      <div className={variant === 'mobile' ? 'grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8' : 'grid grid-cols-1 gap-3'}>
        {/* Deadline */}
        <div className="p-4 border border-navy-600 rounded-xl bg-navy-700 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">
            <Calendar className="w-3.5 h-3.5" />
            {t('deadline')}
          </div>
          <div className="text-white font-semibold truncate" suppressHydrationWarning>
            {isMounted && new Date(prediction.resolveByDatetime).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              timeZoneName: 'short',
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
              <span key={i} className="px-2 py-0.5 bg-navy-800 text-gray-400 text-[10px] font-bold uppercase tracking-wider rounded border border-navy-600">
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
  const [error, setError] = useState<string | null>(null)
  const [isApproving, setIsApproving] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [showRules, setShowRules] = useState(false)

  // Confidence state (-100 to 100 for BINARY, 0 to 100 for MC)
  const [userConfidence, setUserConfidence] = useState<number>(0)
  const [initialUserConfidence, setInitialUserConfidence] = useState<number | null>(null)
  const [mcConfidence, setMcConfidence] = useState<number>(70)
  const [aiEstimate, setAiEstimate] = useState<number | null>(null)
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Translation state
  const [translatedFields, setTranslatedFields] = useState<Record<string, string> | null>(null)
  const [isTranslating, setIsTranslating] = useState(false)
  const [showTranslated, setShowTranslated] = useState(locale !== 'en')

  const canEdit = session?.user?.id === prediction?.author.id || session?.user?.role === 'ADMIN'
  const canApprove = (session?.user?.role === 'ADMIN' || session?.user?.role === 'APPROVER') && prediction?.status === 'PENDING_APPROVAL'

  useEffect(() => {
    setIsMounted(true)
    if (prediction?.userCommitment) {
      // cuCommitted now stores confidence directly (-100..100 for BINARY, 0..100 for MC)
      const val = prediction.userCommitment.cuCommitted ?? (prediction.userCommitment.binaryChoice ? 70 : -70)
      if (prediction.userCommitment.optionId) {
        setMcConfidence(Math.max(1, Math.abs(val)))
      } else {
        setUserConfidence(val)
        setInitialUserConfidence(val)
      }
      setSelectedOptionId(prediction.userCommitment.optionId || null)
    }
  }, [prediction?.userCommitment])

  useEffect(() => {
    async function fetchPrediction() {
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

  const handleCommitConfidence = async () => {
    if (userConfidence === 0 || !prediction) return

    setIsSubmitting(true)
    try {
      const body: Record<string, unknown> = { confidence: userConfidence }
      if (prediction.outcomeType === 'MULTIPLE_CHOICE' && selectedOptionId) {
        body.optionId = selectedOptionId
        body.confidence = Math.abs(userConfidence)
      }

      const response = await fetch(`/api/forecasts/${prediction.id}/commit`, {
        method: prediction.userCommitment ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) throw new Error('Failed to save forecast')
      
      toast.success('Forecast recorded!')
      const updated = await fetch(`/api/forecasts/${id}`).then(r => r.json())
      setPrediction(updated)
      router.refresh()
    } catch (err) {
      toast.error('Failed to commit forecast')
    } finally {
      setIsSubmitting(false)
    }
  }

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

      <div className="xl:grid xl:grid-cols-[1fr_420px] xl:gap-8 xl:items-start">
        {/* Left column */}
        <div className="min-w-0">

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge(prediction.status)}`}>
              {prediction.status.replace('_', ' ')}
            </span>

            {/* Deadline - Moved to top */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-navy-700 text-gray-400 text-sm font-medium">
              <Calendar className="w-4 h-4" />
              <span suppressHydrationWarning>
                {isMounted && new Date(prediction.resolveByDatetime).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </span>
            </div>

            {/* Confidence/Probability - Moved to top */}
            {prediction.status === 'ACTIVE' && prediction.outcomeType === 'BINARY' && (() => {
              const yesTokens = prediction.commitments.filter(c => c.binaryChoice === true).reduce((sum, c) => sum + c.cuCommitted, 0)
              const noTokens = prediction.commitments.filter(c => c.binaryChoice === false).reduce((sum, c) => sum + Math.abs(c.cuCommitted), 0)
              const prob = (yesTokens + noTokens) > 0 ? Math.round((yesTokens / (yesTokens + noTokens)) * 100) : 50
              return (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-navy-700 text-teal text-sm font-medium border border-teal/20">
                  <TrendingUp className="w-4 h-4" />
                  <span>{prob}%</span>
                </div>
              )
            })()}

            {prediction.isPublic === false && (
              <span className="flex items-center gap-1 px-3 py-1 bg-navy-700 text-gray-400 text-sm font-medium rounded-full">
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
                    : 'bg-navy-700 text-gray-400 hover:bg-navy-600'
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
      <div className="mb-8">
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
            {prediction.resolutionRules ?? 'No resolution rules specified.'}
          </div>
        )}
      </div>

      {/* Situation Context / Timeline */}
      <ContextTimeline
        predictionId={prediction.id}
        initialContext={prediction.detailsText}
        initialContextUpdatedAt={prediction.contextUpdatedAt}
        canAnalyze={!!session?.user && prediction.status === 'ACTIVE'}
        newsAnchor={prediction.newsAnchor}
        onAiEstimate={setAiEstimate}
      />

      {/* Probability Display (Interactive Gauge) */}
      <div className="mb-12">
        {prediction.outcomeType === 'BINARY' && (() => {
          const yesTokens = prediction.commitments.filter(c => c.binaryChoice === true).reduce((sum, c) => sum + c.cuCommitted, 0)
          const noTokens = prediction.commitments.filter(c => c.binaryChoice === false).reduce((sum, c) => sum + Math.abs(c.cuCommitted), 0)
          const marketProb = (yesTokens + noTokens) > 0 ? Math.round((yesTokens / (yesTokens + noTokens)) * 100) : 50
          
          // Map user slider (-100 to 100) to 0-100 for gauge
          const userProb = (userConfidence + 100) / 2
          
          return (
            <div className="flex flex-col items-center">
              <div className="w-full max-w-lg relative rounded-3xl border border-navy-600 bg-navy-700 p-8 sm:p-12 flex flex-col items-center justify-center shadow-2xl overflow-hidden">
                {/* Background glow */}
                <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent pointer-events-none" />
                
                <Speedometer
                  percentage={marketProb}
                  userPercentage={userProb}
                  aiPercentage={aiEstimate ?? prediction.confidence ?? undefined}
                  size="xl"
                  onUserPercentageChange={prediction.status === 'ACTIVE'
                    ? (pct) => setUserConfidence(Math.round(pct * 2 - 100))
                    : undefined}
                />

                {/* Legend */}
                <div className="flex justify-center gap-6 mt-10 text-[10px] font-bold uppercase tracking-widest border-t border-navy-600 pt-8 w-full">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-1 bg-[#A0AEC0] rounded-full" />
                    <span className="text-gray-400">Market</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-1.5 bg-[#3B82F6] rounded-full" />
                    <span className="text-blue-400">You</span>
                  </div>
                  {(aiEstimate ?? prediction.confidence) != null && (
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-1 bg-[#FBBF24] rounded-full" />
                      <span className="text-amber-400">AI</span>
                    </div>
                  )}
                </div>

                {/* Confidence Slider Integration (Desktop & Mobile) */}
                <div className="w-full mt-10">
                  <ConfidenceSlider
                    value={userConfidence}
                    onChange={setUserConfidence}
                    onCommit={handleCommitConfidence}
                    isSubmitting={isSubmitting}
                    disabled={prediction.status !== 'ACTIVE'}
                    canCommit={userConfidence !== initialUserConfidence}
                    isCommitted={!!prediction.userCommitment}
                  />
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

          const userOptionId = prediction.userCommitment?.optionId

          const handleCommitMultipleChoice = async () => {
            if (!selectedOptionId || !prediction) return

            setIsSubmitting(true)
            try {
              const response = await fetch(`/api/forecasts/${prediction.id}/commit`, {
                method: prediction.userCommitment ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  confidence: Math.max(1, mcConfidence),
                  optionId: selectedOptionId,
                }),
              })

              if (!response.ok) throw new Error('Failed to save forecast')
              
              toast.success('Forecast recorded!')
              const updated = await fetch(`/api/forecasts/${id}`).then(r => r.json())
              setPrediction(updated)
              router.refresh()
            } catch (err) {
              toast.error('Failed to commit forecast')
            } finally {
              setIsSubmitting(false)
            }
          }

          return (
            <div className="w-full max-w-2xl mx-auto">
              <div className="bg-navy-700 border border-navy-600 rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
                {/* Background glow */}
                <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent pointer-events-none" />
                
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-8 text-center">Market Distribution</h3>
                
                <div className="space-y-4 mb-10">
                  {optionsWithStats.map((option) => {
                    const isSelected = selectedOptionId === option.id
                    const isActive = prediction.status === 'ACTIVE'
                    return (
                      <div key={option.id} className={`relative rounded-2xl border transition-all duration-200 ${
                        isSelected
                          ? 'bg-blue-600/10 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.15)]'
                          : 'bg-navy-800/50 border-navy-600'
                      }`}>
                        <button
                          onClick={() => isActive && setSelectedOptionId(option.id)}
                          disabled={!isActive || isSubmitting}
                          className="w-full group flex flex-col p-4"
                        >
                          <div className="flex justify-between items-center mb-2 relative z-10">
                            <div className="flex items-center gap-3">
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                                isSelected ? 'border-blue-400 bg-blue-500' : 'border-navy-500'
                              }`}>
                                {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                              </div>
                              <span className={`font-semibold transition-colors ${isSelected ? 'text-blue-400' : 'text-white group-hover:text-blue-300'}`}>
                                {option.text}
                              </span>
                            </div>
                            <span className="font-mono text-sm font-bold text-gray-400">{option.pct}%</span>
                          </div>

                          {/* Progress Bar */}
                          <div className="w-full h-2 bg-navy-900 rounded-full overflow-hidden relative z-10">
                            <div
                              className={`h-full transition-all duration-1000 ease-out rounded-full ${
                                isSelected ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'bg-navy-600'
                              }`}
                              style={{ width: `${option.pct}%` }}
                            />
                          </div>
                        </button>

                        {/* Inline confidence slider — only on selected option */}
                        {isSelected && isActive && (
                          <div className="px-4 pb-4 space-y-2">
                            <div className="flex justify-between text-[10px] uppercase tracking-widest font-bold text-gray-500">
                              <span>Low</span>
                              <span className="text-blue-400 font-bold">Confidence: {mcConfidence}%</span>
                              <span className="text-teal">High</span>
                            </div>
                            <input
                              type="range"
                              min="1"
                              max="100"
                              step="1"
                              value={mcConfidence}
                              onChange={(e) => setMcConfidence(parseInt(e.target.value))}
                              disabled={isSubmitting}
                              className="w-full h-3 bg-navy-900 rounded-lg appearance-none cursor-pointer accent-blue-500 border border-blue-500/30"
                            />
                          </div>
                        )}

                        {/* Your indicator */}
                        {userOptionId === option.id && (
                          <div className="absolute -right-2 -top-2 bg-blue-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg transform rotate-12 uppercase tracking-tighter z-20">
                            Your Choice
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {prediction.status === 'ACTIVE' && prediction.userCommitment && selectedOptionId === userOptionId && mcConfidence === Math.max(1, Math.abs(prediction.userCommitment.cuCommitted ?? 70)) ? (
                  <div className="flex items-center justify-center gap-2 py-4 px-4 bg-teal/10 border border-teal/30 rounded-xl">
                    <span className="text-sm font-bold text-teal uppercase tracking-widest">Your forecast is committed</span>
                  </div>
                ) : (
                  <button
                    onClick={handleCommitMultipleChoice}
                    disabled={!selectedOptionId || prediction.status !== 'ACTIVE' || isSubmitting}
                    className={`w-full py-4 rounded-xl font-bold text-sm uppercase tracking-widest transition-all duration-200 ${
                      !selectedOptionId || prediction.status !== 'ACTIVE' || isSubmitting
                        ? 'bg-navy-800 text-gray-400 cursor-not-allowed border border-navy-600'
                        : 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-900/20 active:scale-[0.98] border border-blue-400/30'
                    }`}
                  >
                    {isSubmitting ? 'Submitting...' : 'Commit Forecast'}
                  </button>
                )}
              </div>
            </div>
          )
        })()}
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
                <p className="italic text-gray-300">&quot;{prediction.consensusLine}&quot;</p>
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
        <div className="mt-12">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" />
            Forecasts History
          </h2>
          <div className="border border-navy-600 rounded-lg divide-y divide-navy-600">
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
                  <div className="font-semibold text-gray-400">
                    {(commitment as any).probability ? `${Math.round((commitment as any).probability * 100)}%` : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Author Section - Moved to bottom */}
      <div className="mt-12 p-6 border border-navy-600 rounded-xl bg-navy-700 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-4">
          <UserLink
            userId={prediction.author.id}
            username={prediction.author.username}
            name={prediction.author.name}
            image={prediction.author.image}
            showAvatar={true}
            avatarSize={48}
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold text-white">{prediction.author.name}</span>
                {prediction.author.role && (
                  <RoleBadge role={prediction.author.role} size="sm" />
                )}
              </div>
              <div className="text-sm text-gray-500">Forecaster · Reputation: {prediction.author.rs.toFixed(0)}</div>
            </div>
          </UserLink>
        </div>
        <div className="text-right text-xs text-gray-500 font-medium uppercase tracking-wide">
          {t('author')}
        </div>
      </div>

      {/* Comments Section */}
      <div className="border-t border-navy-600 mt-12 pt-8">
        <CommentThread predictionId={prediction.id} />
      </div>

        </div>{/* end left column */}

        {/* Right column — sticky on desktop */}
        <div className="hidden xl:block xl:sticky xl:top-8 space-y-4">
          <ForecastInfoPanel
            prediction={prediction}
            isMounted={isMounted}
          />
          
        </div>
      </div>
    </div>
  )
}
