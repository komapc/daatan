'use client'
import { useState, useEffect, useCallback } from 'react'
import { Loader2, Play, FlaskConical, Power, ChevronDown, ChevronUp, Plus, Pencil, X, Check } from 'lucide-react'

interface BotLog {
  id: string
  runAt: string
  action: string
  triggerNews: { title?: string; urls?: string[] } | null
  generatedText: string | null
  forecastId: string | null
  isDryRun: boolean
  error: string | null
}

interface Bot {
  id: string
  isActive: boolean
  intervalMinutes: number
  maxForecastsPerDay: number
  maxVotesPerDay: number
  stakeMin: number
  stakeMax: number
  modelPreference: string
  hotnessMinSources: number
  hotnessWindowHours: number
  personaPrompt: string
  forecastPrompt: string
  votePrompt: string
  newsSources: string[]
  // Extended params
  activeHoursStart: number | null
  activeHoursEnd: number | null
  tagFilter: string[]
  voteBias: number
  cuRefillAt: number
  cuRefillAmount: number
  canCreateForecasts: boolean
  canVote: boolean
  // Computed
  lastRunAt: string | null
  nextRunAt: string | null
  forecastsToday: number
  votesToday: number
  lastLog: { runAt: string; action: string; error: string | null } | null
  user: { id: string; name: string | null; username: string | null; cuAvailable: number }
}

export default function BotsTable() {
  const [bots, setBots] = useState<Bot[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [runningBots, setRunningBots] = useState<Set<string>>(new Set())
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set())
  const [logs, setLogs] = useState<Record<string, BotLog[]>>({})
  const [loadingLogs, setLoadingLogs] = useState<Set<string>>(new Set())
  const [editingBot, setEditingBot] = useState<Bot | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [actionMsg, setActionMsg] = useState<string | null>(null)

  const fetchBots = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/admin/bots')
      if (res.ok) {
        const data = await res.json()
        setBots(data.bots)
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBots()
  }, [fetchBots])

  const flash = (msg: string) => {
    setActionMsg(msg)
    setTimeout(() => setActionMsg(null), 3000)
  }

  const runBot = async (botId: string, dryRun: boolean) => {
    setRunningBots((s) => new Set(s).add(botId))
    try {
      const res = await fetch(`/api/admin/bots/${botId}/run${dryRun ? '?dry=true' : ''}`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        const s = data.summary
        flash(
          dryRun
            ? `Dry run complete: ${s.forecastsCreated} simulated, ${s.skipped} skipped, ${s.errors} errors`
            : `Run complete: ${s.forecastsCreated} forecasts, ${s.votes} votes, ${s.errors} errors`,
        )
        fetchBots()
        if (expandedLogs.has(botId)) fetchLogs(botId)
      } else {
        const errorDetail = data.details?.[0]?.message ?? data.error
        flash(`Error: ${errorDetail}`)
      }
    } catch {
      flash('Request failed')
    } finally {
      setRunningBots((s) => { const n = new Set(s); n.delete(botId); return n })
    }
  }

  const toggleActive = async (bot: Bot) => {
    const res = await fetch(`/api/admin/bots/${bot.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !bot.isActive }),
    })
    if (res.ok) {
      setBots((bs) => bs.map((b) => b.id === bot.id ? { ...b, isActive: !b.isActive } : b))
    }
  }

  const fetchLogs = async (botId: string) => {
    setLoadingLogs((s) => new Set(s).add(botId))
    try {
      const res = await fetch(`/api/admin/bots/${botId}/logs?limit=10`)
      if (res.ok) {
        const data = await res.json()
        setLogs((l) => ({ ...l, [botId]: data.logs }))
      }
    } finally {
      setLoadingLogs((s) => { const n = new Set(s); n.delete(botId); return n })
    }
  }

  const toggleLogs = (botId: string) => {
    setExpandedLogs((s) => {
      const n = new Set(s)
      if (n.has(botId)) {
        n.delete(botId)
      } else {
        n.add(botId)
        fetchLogs(botId)
      }
      return n
    })
  }

  const saveBot = async (botId: string, updates: Partial<Bot>) => {
    const res = await fetch(`/api/admin/bots/${botId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (res.ok) {
      fetchBots()
      setEditingBot(null)
      flash('Bot updated')
    } else {
      const data = await res.json()
      flash(`Error: ${data.error}`)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Bots ({bots.length})</h2>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> New bot
        </button>
      </div>

      {actionMsg && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          {actionMsg}
        </div>
      )}

      {showCreateForm && (
        <CreateBotForm
          onCreated={() => { setShowCreateForm(false); fetchBots() }}
          onCancel={() => setShowCreateForm(false)}
        />
      )}

      {editingBot && (
        <EditBotModal
          bot={editingBot}
          onSave={(updates) => saveBot(editingBot.id, updates)}
          onClose={() => setEditingBot(null)}
        />
      )}

      <div className="space-y-4">
        {bots.map((bot) => {
          const isRunning = runningBots.has(bot.id)
          const logsExpanded = expandedLogs.has(bot.id)
          const botLogs = logs[bot.id] ?? []
          const logsLoading = loadingLogs.has(bot.id)

          return (
            <div key={bot.id} className="border rounded-lg shadow-sm bg-white overflow-hidden">
              <div className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{bot.user.name}</span>
                      <span className="text-xs font-mono text-gray-500">@{bot.user.username}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${bot.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                        {bot.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </div>

                    <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-gray-600">
                      <div>
                        <span className="text-gray-400">Interval</span>
                        <div className="font-medium">{formatInterval(bot.intervalMinutes)}</div>
                      </div>
                      <div>
                        <span className="text-gray-400">Today</span>
                        <div className="font-medium">
                          {bot.forecastsToday}/{bot.maxForecastsPerDay} forecasts · {bot.votesToday}/{bot.maxVotesPerDay} votes
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-400">Last run</span>
                        <div className="font-medium">{bot.lastRunAt ? relativeTime(bot.lastRunAt) : 'Never'}</div>
                      </div>
                      <div>
                        <span className="text-gray-400">Next run</span>
                        <div className="font-medium">{bot.nextRunAt ? relativeTime(bot.nextRunAt) : '—'}</div>
                      </div>
                    </div>

                    <div className="mt-1 text-xs text-gray-500">
                      CU: {bot.user.cuAvailable} available · Sources: {bot.newsSources.length} · Model: {bot.modelPreference}
                    </div>

                    {bot.lastLog?.error && (
                      <div className="mt-1 text-xs text-red-600">Last error: {bot.lastLog.error.slice(0, 100)}</div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setEditingBot(bot)}
                      title="Edit config"
                      className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => runBot(bot.id, true)}
                      disabled={isRunning}
                      title="Test (dry run)"
                      className="flex items-center gap-1 text-xs px-2 py-1.5 border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 rounded transition-colors disabled:opacity-50"
                    >
                      {isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <FlaskConical className="w-3 h-3" />}
                      Test
                    </button>
                    <button
                      onClick={() => runBot(bot.id, false)}
                      disabled={isRunning}
                      title="Run now"
                      className="flex items-center gap-1 text-xs px-2 py-1.5 border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 rounded transition-colors disabled:opacity-50"
                    >
                      {isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                      Run
                    </button>
                    <button
                      onClick={() => toggleActive(bot)}
                      title={bot.isActive ? 'Disable' : 'Enable'}
                      className={`p-1.5 rounded transition-colors ${bot.isActive
                          ? 'text-green-600 hover:bg-red-50 hover:text-red-600'
                          : 'text-gray-400 hover:bg-green-50 hover:text-green-600'
                        }`}
                    >
                      <Power className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Run log toggle */}
              <button
                onClick={() => toggleLogs(bot.id)}
                className="w-full flex items-center justify-between px-4 py-2 bg-gray-50 border-t text-xs text-gray-500 hover:bg-gray-100 transition-colors"
              >
                <span>Run log</span>
                {logsExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              {logsExpanded && (
                <div className="border-t">
                  {logsLoading ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                    </div>
                  ) : botLogs.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-gray-400">No log entries yet</div>
                  ) : (
                    <div className="divide-y">
                      {botLogs.map((log) => (
                        <div key={log.id} className="px-4 py-3">
                          <div className="flex items-center gap-2 text-xs">
                            <span className={`font-medium px-1.5 py-0.5 rounded ${actionBadge(log.action)}`}>
                              {log.isDryRun ? '(dry) ' : ''}{log.action}
                            </span>
                            <span className="text-gray-400">{relativeTime(log.runAt)}</span>
                          </div>
                          {log.triggerNews?.title && (
                            <div className="mt-1 text-xs text-gray-600">
                              News: {log.triggerNews.title}
                            </div>
                          )}
                          {log.generatedText && (
                            <details className="mt-1">
                              <summary className="text-xs text-blue-600 cursor-pointer">Generated text</summary>
                              <pre className="mt-1 text-xs text-gray-700 whitespace-pre-wrap bg-gray-50 p-2 rounded max-h-40 overflow-y-auto">
                                {log.generatedText}
                              </pre>
                            </details>
                          )}
                          {log.error && (
                            <div className="mt-1 text-xs text-red-600">{log.error}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {bots.length === 0 && !showCreateForm && (
          <div className="text-center py-12 text-gray-400">
            No bots yet. Create one to get started.
          </div>
        )}
      </div>
    </div>
  )
}

// ── Create Bot Form ────────────────────────────────────────────────────────────

function CreateBotForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/bots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const data = await res.json()
      if (res.ok) {
        onCreated()
      } else {
        setError(data.error ?? 'Failed to create bot')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border rounded-lg p-4 mb-4 bg-blue-50 border-blue-200">
      <h3 className="font-semibold text-gray-800 mb-3">New bot</h3>
      <form onSubmit={submit} className="flex gap-2 items-end flex-wrap">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Display name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Dave"
            className="border rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            required
            minLength={2}
          />
          <div className="text-xs text-gray-400 mt-0.5">Username will be: {name.toLowerCase().replace(/\s+/g, '_')}_b</div>
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            Create
          </button>
          <button type="button" onClick={onCancel} className="p-1.5 text-gray-500 hover:text-gray-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      </form>
      {error && <div className="mt-2 text-xs text-red-600">{error}</div>}
      <p className="mt-2 text-xs text-gray-500">
        After creating, open the edit dialog to configure prompts, RSS sources, and schedule.
      </p>
    </div>
  )
}

// ── Edit Bot Modal ─────────────────────────────────────────────────────────────

function EditBotModal({ bot, onSave, onClose }: {
  bot: Bot
  onSave: (updates: Partial<Bot>) => void
  onClose: () => void
}) {
  const [form, setForm] = useState({
    personaPrompt: bot.personaPrompt,
    forecastPrompt: bot.forecastPrompt,
    votePrompt: bot.votePrompt,
    newsSources: (bot.newsSources ?? []).join('\n'),
    intervalMinutes: bot.intervalMinutes,
    maxForecastsPerDay: bot.maxForecastsPerDay,
    maxVotesPerDay: bot.maxVotesPerDay,
    stakeMin: bot.stakeMin,
    stakeMax: bot.stakeMax,
    modelPreference: bot.modelPreference,
    hotnessMinSources: bot.hotnessMinSources,
    hotnessWindowHours: bot.hotnessWindowHours,
    // Extended params
    activeHoursStart: bot.activeHoursStart,
    activeHoursEnd: bot.activeHoursEnd,
    tagFilter: (bot.tagFilter ?? []).join('\n'),
    voteBias: bot.voteBias ?? 50,
    cuRefillAt: bot.cuRefillAt ?? 0,
    cuRefillAmount: bot.cuRefillAmount ?? 50,
    canCreateForecasts: bot.canCreateForecasts ?? true,
    canVote: bot.canVote ?? true,
  })
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const sources = form.newsSources
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    const tags = form.tagFilter
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    onSave({
      ...form,
      newsSources: sources,
      tagFilter: tags,
    } as unknown as Partial<Bot>)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h3 className="font-semibold text-gray-900">Edit bot: {bot.user.name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={submit} className="p-4 space-y-4">
          <Field label="Persona prompt" hint="Character description for the bot">
            <textarea
              value={form.personaPrompt}
              onChange={(e) => setForm({ ...form, personaPrompt: e.target.value })}
              rows={3}
              className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
          </Field>

          <Field label="Forecast creation prompt" hint="Instructions for generating a forecast from a news topic">
            <textarea
              value={form.forecastPrompt}
              onChange={(e) => setForm({ ...form, forecastPrompt: e.target.value })}
              rows={3}
              className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
          </Field>

          <Field label="Vote decision prompt" hint="Instructions for deciding whether/how to vote on existing forecasts">
            <textarea
              value={form.votePrompt}
              onChange={(e) => setForm({ ...form, votePrompt: e.target.value })}
              rows={3}
              className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
          </Field>

          <Field label="RSS sources" hint="One URL per line">
            <textarea
              value={form.newsSources}
              onChange={(e) => setForm({ ...form, newsSources: e.target.value })}
              rows={4}
              placeholder="https://feeds.bbci.co.uk/news/world/rss.xml"
              className="w-full border rounded px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </Field>

          <Field label="LLM model" hint="OpenRouter model ID (e.g. google/gemini-2.0-flash-exp:free)">
            <input
              value={form.modelPreference}
              onChange={(e) => setForm({ ...form, modelPreference: e.target.value })}
              className="w-full border rounded px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </Field>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <NumberField label="Interval (min)" value={form.intervalMinutes} min={5}
              onChange={(v) => setForm({ ...form, intervalMinutes: v })} />
            <NumberField label="Max forecasts/day" value={form.maxForecastsPerDay} min={0}
              onChange={(v) => setForm({ ...form, maxForecastsPerDay: v })} />
            <NumberField label="Max votes/day" value={form.maxVotesPerDay} min={0}
              onChange={(v) => setForm({ ...form, maxVotesPerDay: v })} />
            <NumberField label="Stake min (CU)" value={form.stakeMin} min={1}
              onChange={(v) => setForm({ ...form, stakeMin: v })} />
            <NumberField label="Stake max (CU)" value={form.stakeMax} min={1}
              onChange={(v) => setForm({ ...form, stakeMax: v })} />
            <NumberField label="Min sources (hotness)" value={form.hotnessMinSources} min={1}
              onChange={(v) => setForm({ ...form, hotnessMinSources: v })} />
            <NumberField label="Hotness window (h)" value={form.hotnessWindowHours} min={1}
              onChange={(v) => setForm({ ...form, hotnessWindowHours: v })} />
          </div>

          {/* ── Actions & Bias ─────────────────────────────────────── */}
          <div className="border rounded-lg p-3 space-y-3 bg-gray-50">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions &amp; Bias</p>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.canCreateForecasts}
                  onChange={(e) => setForm({ ...form, canCreateForecasts: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Create forecasts
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.canVote}
                  onChange={(e) => setForm({ ...form, canVote: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Vote on forecasts
              </label>
            </div>
            <div className="max-w-xs">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Vote bias: {form.voteBias} / 100
                <span className="ml-2 text-gray-400 font-normal">
                  ({form.voteBias < 40 ? 'leans NO' : form.voteBias > 60 ? 'leans YES' : 'neutral'})
                </span>
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={form.voteBias}
                onChange={(e) => setForm({ ...form, voteBias: parseInt(e.target.value) })}
                className="w-full accent-blue-600"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                <span>0 NO</span>
                <span>50 neutral</span>
                <span>100 YES</span>
              </div>
            </div>
          </div>

          {/* ── Active Window ──────────────────────────────────────── */}
          <div className="border rounded-lg p-3 space-y-3 bg-gray-50">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Active Window (UTC)</p>
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.activeHoursStart == null}
                onChange={(e) => setForm({
                  ...form,
                  activeHoursStart: e.target.checked ? null : 8,
                  activeHoursEnd: e.target.checked ? null : 22,
                })}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Always active (no time restriction)
            </label>
            {form.activeHoursStart != null && (
              <div className="grid grid-cols-2 gap-4">
                <NumberField
                  label="Start hour (0–23 UTC)"
                  value={form.activeHoursStart}
                  min={0}
                  max={23}
                  onChange={(v) => setForm({ ...form, activeHoursStart: v })}
                />
                <NumberField
                  label="End hour (0–23 UTC, exclusive)"
                  value={form.activeHoursEnd ?? 22}
                  min={0}
                  max={23}
                  onChange={(v) => setForm({ ...form, activeHoursEnd: v })}
                />
                <p className="col-span-2 text-xs text-gray-400">
                  Overnight ranges work — e.g. start&nbsp;22 &rarr; end&nbsp;06 means 10&nbsp;pm–6&nbsp;am UTC.
                </p>
              </div>
            )}
          </div>

          {/* ── CU Auto-Refill ─────────────────────────────────────── */}
          <div className="border rounded-lg p-3 space-y-3 bg-gray-50">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">CU Auto-Refill</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <NumberField
                  label="Refill threshold (CU)"
                  value={form.cuRefillAt}
                  min={0}
                  onChange={(v) => setForm({ ...form, cuRefillAt: v })}
                />
                {form.cuRefillAt === 0 && (
                  <p className="text-xs text-gray-400 mt-1">0 = disabled</p>
                )}
              </div>
              <NumberField
                label="Refill amount (CU)"
                value={form.cuRefillAmount}
                min={1}
                onChange={(v) => setForm({ ...form, cuRefillAmount: v })}
              />
            </div>
            <p className="text-xs text-gray-400">
              When bot&apos;s CU balance drops to or below the threshold, grant the refill amount automatically before the next stake.
            </p>
          </div>

          {/* ── Tag Filter ─────────────────────────────────────────── */}
          <Field label="Tag filter" hint="One tag per line. Leave empty to act on all tags.">
            <textarea
              value={form.tagFilter}
              onChange={(e) => setForm({ ...form, tagFilter: e.target.value })}
              rows={3}
              placeholder={'politics\ntechnology\nclimate'}
              className="w-full border rounded px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-400 mb-1">{hint}</p>}
      {children}
    </div>
  )
}

function NumberField({ label, value, min, max, onChange }: {
  label: string; value: number; min: number; max?: number; onChange: (v: number) => void
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(parseInt(e.target.value) || min)}
        className="w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
      />
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatInterval(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  if (minutes % 60 === 0) return `${minutes / 60}h`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const abs = Math.abs(diff)
  const future = diff < 0

  if (abs < 60_000) return future ? 'in <1m' : 'just now'
  if (abs < 3600_000) return `${future ? 'in ' : ''}${Math.round(abs / 60_000)}m${future ? '' : ' ago'}`
  if (abs < 86400_000) return `${future ? 'in ' : ''}${Math.round(abs / 3600_000)}h${future ? '' : ' ago'}`
  return `${future ? 'in ' : ''}${Math.round(abs / 86400_000)}d${future ? '' : ' ago'}`
}

function actionBadge(action: string): string {
  switch (action) {
    case 'CREATED_FORECAST': return 'bg-green-100 text-green-700'
    case 'VOTED': return 'bg-blue-100 text-blue-700'
    case 'SKIPPED': return 'bg-gray-100 text-gray-600'
    case 'ERROR': return 'bg-red-100 text-red-700'
    default: return 'bg-gray-100 text-gray-600'
  }
}
