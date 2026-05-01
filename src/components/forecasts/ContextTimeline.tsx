'use client'

import { useEffect, useState, useRef } from 'react'
import { FileText, RefreshCw, Loader2, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useTranslations } from 'next-intl'
import { createClientLogger } from '@/lib/client-logger'
import { toError } from '@/lib/utils/error'

const log = createClientLogger('ContextTimeline')

type Source = {
  title: string
  url: string
  source?: string | null
  publishedDate?: string | null
}

/** Single source entry within an Oracle forecast snapshot (camelCase variant used in UI). */
type OracleSnapshotSource = {
  sourceId: string
  sourceName: string
  url: string
  /** [-1, 1] — negative favours NO, positive favours YES. */
  stance: number
  /** [0, 1] — how confident this source is. */
  certainty: number
  /** Leaderboard credibility weight; ~1.0 is neutral. */
  credibilityWeight: number
  claims: string[]
}

/** Full Oracle payload persisted alongside a context snapshot when the Oracle path is taken. */
type OracleSnapshot = {
  mean: number
  std: number
  ciLow: number
  ciHigh: number
  articlesUsed: number
  sources: OracleSnapshotSource[]
}

export type AiEstimate = {
  probability: number
  ciLow?: number
  ciHigh?: number
}

type Snapshot = {
  id: string
  summary: string
  sources: Source[]
  createdAt: string
  externalProbability?: number | null
  externalReasoning?: string | null
  oracleSnapshot?: OracleSnapshot | null
}

type NewsAnchor = {
  title: string
  url: string
  source?: string | null
}

type Props = {
  predictionId: string
  initialContext?: string | null
  initialContextUpdatedAt?: string | null
  canAnalyze: boolean
  newsAnchor?: NewsAnchor | null
  onAiEstimate?: (value: AiEstimate | null) => void
}

/** Map a snapshot's persisted probability + Oracle CI (if any) into the callback shape. */
const toAiEstimate = (snap: Snapshot | undefined): AiEstimate | null => {
  if (!snap || snap.externalProbability == null) return null
  const oracle = snap.oracleSnapshot
  return {
    probability: snap.externalProbability,
    ciLow: oracle?.ciLow,
    ciHigh: oracle?.ciHigh,
  }
}

export default function ContextTimeline({
  predictionId,
  initialContext,
  initialContextUpdatedAt,
  canAnalyze,
  newsAnchor,
  onAiEstimate,
}: Props) {
  const [currentContext, setCurrentContext] = useState(initialContext || null)
  const [contextUpdatedAt, setContextUpdatedAt] = useState(initialContextUpdatedAt || null)
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analyzeStep, setAnalyzeStep] = useState<'searching' | 'analyzing' | 'estimating' | null>(null)
  const stepTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  const [isContextOpen, setIsContextOpen] = useState(false)
  const [isTimelineOpen, setIsTimelineOpen] = useState(false)
  const [hasFetched, setHasFetched] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const t = useTranslations('context')

  const TIMING_KEY = 'daatan:context-timings'
  const TIMING_TTL_MS = 7 * 24 * 60 * 60 * 1000
  const DEFAULT_TIMINGS = { searchMs: 10_000, llmMs: 12_000, oracleMs: 8_000 }

  function loadTimings() {
    try {
      const raw = localStorage.getItem(TIMING_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        return {
          searchMs: parsed.searchMs ?? DEFAULT_TIMINGS.searchMs,
          llmMs: parsed.llmMs ?? DEFAULT_TIMINGS.llmMs,
          oracleMs: parsed.oracleMs ?? DEFAULT_TIMINGS.oracleMs,
        }
      }
    } catch { /* ignore */ }
    return DEFAULT_TIMINGS
  }

  function saveTimings(timings: { searchMs: number; llmMs: number; oracleMs: number }) {
    try {
      localStorage.setItem(TIMING_KEY, JSON.stringify({ ...timings, savedAt: Date.now() }))
    } catch { /* storage full or private mode */ }
  }

  // Fetch timeline on mount
  useEffect(() => {
    setIsMounted(true)
    const fetchTimeline = async () => {
      try {
        const res = await fetch(`/api/forecasts/${predictionId}/context`)
        if (res.ok) {
          const data = await res.json()
          setCurrentContext(data.currentContext)
          setContextUpdatedAt(data.contextUpdatedAt)
          const snaps: Snapshot[] = data.snapshots || []
          setSnapshots(snaps)
          onAiEstimate?.(toAiEstimate(snaps[0]))
        }
      } catch (err) {
        log.error({ err }, 'Failed to fetch context timeline')
      } finally {
        setHasFetched(true)
      }
    }
    fetchTimeline()
  }, [predictionId, onAiEstimate])

  // Seed localStorage from server averages when data is absent or stale
  useEffect(() => {
    const seedFromServer = async () => {
      try {
        const raw = localStorage.getItem(TIMING_KEY)
        const parsed = raw ? JSON.parse(raw) : null
        const isStale = !parsed?.savedAt || Date.now() - parsed.savedAt > TIMING_TTL_MS
        if (!isStale) return
        const res = await fetch('/api/meta/timings')
        if (!res.ok) return
        const data = await res.json()
        if (data.hasData) saveTimings(data.timings)
      } catch { /* non-critical */ }
    }
    seedFromServer()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleAnalyze = async () => {
    const timings = loadTimings()
    setIsAnalyzing(true)
    setAnalyzeStep('searching')
    toast.loading(t('stepSearching'), { id: 'analyze' })

    // Schedule step transitions based on stored/default timing estimates
    stepTimers.current = [
      setTimeout(() => {
        setAnalyzeStep('analyzing')
        toast.loading(t('stepAnalyzing'), { id: 'analyze' })
      }, timings.searchMs),
      setTimeout(() => {
        setAnalyzeStep('estimating')
        toast.loading(t('stepEstimating'), { id: 'analyze' })
      }, timings.searchMs + timings.llmMs),
    ]

    try {
      const res = await fetch(`/api/forecasts/${predictionId}/context`, {
        method: 'POST',
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || `${t('failed')} (${res.status})`)
      }
      const data = await res.json()

      // Calibrate future estimates with real measured durations
      if (data.timings) {
        saveTimings({
          searchMs: data.timings.searchMs,
          llmMs: data.timings.llmMs,
          oracleMs: data.timings.oracleMs,
        })
      }

      setCurrentContext(data.newContext)
      setContextUpdatedAt(data.contextUpdatedAt)
      const timeline: Snapshot[] = data.timeline || []
      setSnapshots(timeline)
      onAiEstimate?.(toAiEstimate(timeline[0]))
      setIsContextOpen(true)
      toast.success(t('updated'), { id: 'analyze', duration: 3000 })
    } catch (e) {
      log.error({ err: e }, 'Failed to analyze context')
      toast.error(toError(e).message || t('failed'), { id: 'analyze' })
    } finally {
      stepTimers.current.forEach(clearTimeout)
      stepTimers.current = []
      setIsAnalyzing(false)
      setAnalyzeStep(null)
    }
  }

  const formatDate = (dateStr: string) => {
    if (!isMounted) return ''
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const previousSnapshots = snapshots.slice(1)

  // Don't render section at all if no context and user can't analyze
  if (!currentContext && !canAnalyze && hasFetched) {
    return null
  }

  return (
    <div className="mb-8">
      {/* Header — clicking toggles the context body */}
      <button
        onClick={() => setIsContextOpen((o) => !o)}
        className="w-full flex items-center justify-between mb-3 group"
      >
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <FileText className="w-5 h-5" />
          {t('title')}
        </h2>
        <div className="flex items-center gap-2">
          {canAnalyze && (
            <span
              role="button"
              onClick={(e) => { e.stopPropagation(); handleAnalyze() }}
              aria-disabled={isAnalyzing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 bg-cobalt/10 hover:bg-blue-100 rounded-md transition-colors aria-disabled:opacity-50 aria-disabled:pointer-events-none"
            >
              <Loader2 className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : 'hidden'}`} />
              {!isAnalyzing && <RefreshCw className="w-4 h-4" />}
              {isAnalyzing && analyzeStep
                ? t(`step${analyzeStep.charAt(0).toUpperCase()}${analyzeStep.slice(1)}` as 'stepSearching' | 'stepAnalyzing' | 'stepEstimating')
                : t('analyze')}
            </span>
          )}
          {isContextOpen ? (
            <ChevronUp className="w-4 h-4 text-gray-400 group-hover:text-gray-300 transition-colors" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-gray-300 transition-colors" />
          )}
        </div>
      </button>

      {/* Current context card */}
      {currentContext && isContextOpen && (
        <div className="p-4 border border-navy-600 rounded-xl bg-navy-700 shadow-sm">
          <p className="text-gray-300 whitespace-pre-wrap leading-relaxed">{currentContext}</p>
          {contextUpdatedAt && (
            <p className="text-xs text-gray-400 mt-2" suppressHydrationWarning>
              {t('lastUpdated')}: {formatDate(contextUpdatedAt)}
            </p>
          )}
          {/* News anchor */}
          {newsAnchor && (
            <div className="mt-3 pt-3 border-t border-navy-600">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Based on</p>
              <a
                href={newsAnchor.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-cobalt-light hover:underline"
              >
                {newsAnchor.source || newsAnchor.title}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
          {/* Sources from latest snapshot.
              We hide entries whose URL matches the news anchor to avoid the
              "Based on: maariv / Sources: maariv" double-display when the
              search returned the same article (or only that article). */}
          {(() => {
            const allSources = (snapshots[0]?.sources as Source[] | undefined) ?? []
            const anchorUrl = newsAnchor?.url
            const dedupedSources = anchorUrl
              ? allSources.filter((s) => s.url !== anchorUrl)
              : allSources
            if (dedupedSources.length === 0) return null
            return (
              <div className="mt-3 pt-3 border-t border-navy-600">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">{t('sources')}</p>
                <div className="flex flex-wrap gap-2">
                  {dedupedSources.map((src, i) => (
                    <a
                      key={i}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-cobalt-light hover:underline"
                    >
                      {src.source || src.title}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ))}
                </div>
              </div>
            )
          })()}
          {/* AI probability estimate.
              Source badge ("Oracle" vs "LLM estimate") makes the provenance
              of the number explicit: when the Oracle is unreachable / has no
              usable predictions, daatan silently falls back to the legacy
              LLM `guessChances` path which returns only a point estimate.
              Without the badge the user sees a single number with no CI and
              has no way to know which path produced it. */}
          {snapshots[0]?.externalProbability != null && (() => {
            const latest = snapshots[0]
            const oracle = latest.oracleSnapshot ?? null
            const isOracle = oracle != null
            return (
              <div className="mt-3 pt-3 border-t border-navy-600">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">AI estimate</p>
                  <span
                    className={
                      isOracle
                        ? 'text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                        : 'text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-500/15 text-gray-400 border border-gray-500/30'
                    }
                    title={
                      isOracle
                        ? 'TruthMachine Oracle — calibrated multi-source estimate with confidence interval'
                        : 'LLM fallback — single point estimate, used when Oracle has no usable sources'
                    }
                  >
                    {isOracle ? 'Oracle' : 'LLM estimate'}
                  </span>
                </div>
                <p className="text-2xl font-black text-amber-400">
                  {latest.externalProbability}%
                  {oracle && oracle.ciHigh > oracle.ciLow && (
                    <span className="ml-2 text-xs font-normal text-gray-400">
                      ± {Math.round((oracle.ciHigh - oracle.ciLow) / 2)}%
                    </span>
                  )}
                </p>
                {latest.externalReasoning && (
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                    {latest.externalReasoning}
                    {oracle && ` · ${oracle.articlesUsed} article${oracle.articlesUsed === 1 ? '' : 's'}`}
                  </p>
                )}
                {oracle && oracle.sources.length > 0 && (
                  <OracleSources sources={oracle.sources} />
                )}
              </div>
            )
          })()}
        </div>
      )}

      {/* Previous updates toggle — only visible when context is expanded */}
      {isContextOpen && previousSnapshots.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setIsTimelineOpen(!isTimelineOpen)}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-text-secondary transition-colors"
          >
            {isTimelineOpen ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
            {previousSnapshots.length === 1 
              ? t('previousUpdates', { count: 1 }) 
              : t('previousUpdatesPlural', { count: previousSnapshots.length })}
          </button>

          {/* Collapsible timeline */}
          {isTimelineOpen && (
            <div className="mt-3 ml-2 border-l-2 border-navy-600 pl-4 space-y-4">
              {previousSnapshots.map((snap) => (
                <div key={snap.id} className="relative">
                  {/* Timeline dot */}
                  <div className="absolute -left-[1.3rem] top-1 w-2.5 h-2.5 rounded-full bg-gray-300 border-2 border-white" />
                  <div className="text-xs text-gray-400 mb-1" suppressHydrationWarning>
                    {formatDate(snap.createdAt)}
                  </div>
                  <p className="text-sm text-gray-300 leading-relaxed">{snap.summary}</p>
                  {/* Sources */}
                  {(snap.sources as Source[])?.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-2">
                      {(snap.sources as Source[]).map((src, i) => (
                        <a
                          key={i}
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 text-xs text-blue-500 hover:text-cobalt-light hover:underline"
                        >
                          {src.source || src.title}
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Renders Oracle per-source chips with a credibility dot and YES/NO/— stance badge. */
const OracleSources = ({ sources }: { sources: OracleSnapshotSource[] }) => {
  const getCredibilityColor = (w: number): string => {
    if (w >= 0.75) return 'bg-emerald-400'
    if (w >= 0.4) return 'bg-amber-400'
    return 'bg-gray-500'
  }

  const getStance = (stance: number): { label: string; className: string } => {
    if (stance > 0.15) return { label: 'YES', className: 'bg-emerald-500/20 text-emerald-300' }
    if (stance < -0.15) return { label: 'NO', className: 'bg-rose-500/20 text-rose-300' }
    return { label: '—', className: 'bg-gray-500/20 text-gray-400' }
  }

  return (
    <div className="mt-3" data-testid="oracle-sources">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Oracle sources</p>
      <div className="flex flex-wrap gap-1.5">
        {sources.map((src) => {
          const stance = getStance(src.stance)
          return (
            <a
              key={src.sourceId}
              href={src.url}
              target="_blank"
              rel="noopener noreferrer"
              title={`Credibility: ${src.credibilityWeight.toFixed(2)} · Certainty: ${(src.certainty * 100).toFixed(0)}%`}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-navy-600/60 border border-navy-500 hover:bg-navy-600 transition-colors"
            >
              <span
                aria-label={`credibility ${src.credibilityWeight.toFixed(2)}`}
                className={`w-1.5 h-1.5 rounded-full ${getCredibilityColor(src.credibilityWeight)}`}
              />
              <span className="text-xs text-gray-200">{src.sourceName}</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${stance.className}`}>
                {stance.label}
              </span>
            </a>
          )
        })}
      </div>
    </div>
  )
}
