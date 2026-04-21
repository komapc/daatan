'use client'
import { useState } from 'react'
import { Loader2, Check, X } from 'lucide-react'
import { STANDARD_TAGS } from '@/lib/constants'
import { slugify } from '@/lib/utils/slugify'
import type { Bot } from './types'

interface Props {
  bot: Bot
  allTags: { id: string; name: string; slug: string }[]
  onSave: (updates: Partial<Bot>) => void
  onClose: () => void
}

export function EditBotModal({ bot, allTags, onSave, onClose }: Props) {
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
    activeHoursStart: bot.activeHoursStart,
    activeHoursEnd: bot.activeHoursEnd,
    tagFilter: bot.tagFilter ?? [],
    voteBias: bot.voteBias ?? 50,
    cuRefillAt: bot.cuRefillAt ?? 0,
    cuRefillAmount: bot.cuRefillAmount ?? 50,
    canCreateForecasts: bot.canCreateForecasts ?? true,
    canVote: bot.canVote ?? true,
    autoApprove: bot.autoApprove ?? false,
    requireApprovalForForecasts: bot.requireApprovalForForecasts ?? false,
    enableSentimentExtraction: bot.enableSentimentExtraction ?? false,
    enableRejectionTracking: bot.enableRejectionTracking ?? false,
    showMetadataOnForecast: bot.showMetadataOnForecast ?? false,
    maxForecastsPerHour: bot.maxForecastsPerHour ?? 0,
  })
  const [saving, setSaving] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [showTagSuggestions, setShowTagSuggestions] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const sources = form.newsSources
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    const updates: Partial<Bot> = {
      personaPrompt: form.personaPrompt,
      forecastPrompt: form.forecastPrompt,
      votePrompt: form.votePrompt,
      newsSources: sources,
      intervalMinutes: form.intervalMinutes,
      maxForecastsPerDay: form.maxForecastsPerDay,
      maxVotesPerDay: form.maxVotesPerDay,
      stakeMin: form.stakeMin,
      stakeMax: form.stakeMax,
      modelPreference: form.modelPreference,
      hotnessMinSources: form.hotnessMinSources,
      hotnessWindowHours: form.hotnessWindowHours,
      activeHoursStart: form.activeHoursStart,
      activeHoursEnd: form.activeHoursEnd,
      tagFilter: form.tagFilter,
      voteBias: form.voteBias,
      cuRefillAt: form.cuRefillAt,
      cuRefillAmount: form.cuRefillAmount,
      canCreateForecasts: form.canCreateForecasts,
      canVote: form.canVote,
      autoApprove: form.autoApprove,
      requireApprovalForForecasts: form.requireApprovalForForecasts,
      enableSentimentExtraction: form.enableSentimentExtraction,
      enableRejectionTracking: form.enableRejectionTracking,
      showMetadataOnForecast: form.showMetadataOnForecast,
      maxForecastsPerHour: form.maxForecastsPerHour,
    }
    onSave(updates)
    setSaving(false)
  }

  const toggleTag = (slug: string) => {
    setForm(prev => {
      const tags = prev.tagFilter.includes(slug)
        ? prev.tagFilter.filter(t => t !== slug)
        : [...prev.tagFilter, slug]
      return { ...prev, tagFilter: tags }
    })
  }

  const suggestions = [
    ...allTags,
    ...STANDARD_TAGS
      .filter(name => !allTags.some(t => t.name.toLowerCase() === name.toLowerCase()))
      .map(name => ({ id: `std-${name}`, name, slug: slugify(name) }))
  ]

  const filteredTags = suggestions.filter(t =>
    t.name.toLowerCase().includes(tagInput.toLowerCase()) ||
    t.slug.toLowerCase().includes(tagInput.toLowerCase())
  ).filter(t => !form.tagFilter.includes(t.slug)).slice(0, 5)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-navy-700 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-navy-700 z-10">
          <h3 className="font-semibold text-white">Edit bot: {bot.user.name}</h3>
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

          <Field label="News sources" hint="One URL per line. RSS preferred, but standard news URLs also supported via scraping.">
            <div className="text-[10px] text-blue-600 mb-1 font-medium">
              Tip: Use &quot;Search: bitcoin&quot; to fetch from Google News search.
            </div>
            <textarea
              value={form.newsSources}
              onChange={(e) => setForm({ ...form, newsSources: e.target.value })}
              rows={4}
              placeholder="https://feeds.bbci.co.uk/news/world/rss.xml"
              className="w-full border rounded px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </Field>

          <Field label="LLM model" hint="OpenRouter model ID (e.g. google/gemini-2.5-flash-preview:free)">
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
            <NumberField label="Stake min (Confidence)" value={form.stakeMin} min={1}
              onChange={(v) => setForm({ ...form, stakeMin: v })} />
            <NumberField label="Stake max (Confidence)" value={form.stakeMax} min={1}
              onChange={(v) => setForm({ ...form, stakeMax: v })} />
            <NumberField label="Min sources (hotness)" value={form.hotnessMinSources} min={1}
              onChange={(v) => setForm({ ...form, hotnessMinSources: v })} />
            <NumberField label="Hotness window (h)" value={form.hotnessWindowHours} min={1}
              onChange={(v) => setForm({ ...form, hotnessWindowHours: v })} />
            <NumberField label="Max forecasts/hour" value={form.maxForecastsPerHour} min={0}
              onChange={(v) => setForm({ ...form, maxForecastsPerHour: v })} />
          </div>

          <div className="border rounded-lg p-3 space-y-3 bg-navy-800">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions &amp; Bias</p>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input type="checkbox" checked={form.canCreateForecasts}
                  onChange={(e) => setForm({ ...form, canCreateForecasts: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                Create forecasts
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input type="checkbox" checked={form.canVote}
                  onChange={(e) => setForm({ ...form, canVote: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                Vote on forecasts
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input type="checkbox" checked={form.autoApprove}
                  onChange={(e) => setForm({ ...form, autoApprove: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
                Auto-approve forecasts
                <span className="text-xs text-gray-400 font-normal">(skip approval queue)</span>
              </label>
            </div>
            <div className="flex flex-wrap gap-4 pt-2 border-t border-navy-600">
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input type="checkbox" checked={form.requireApprovalForForecasts}
                  onChange={(e) => setForm({ ...form, requireApprovalForForecasts: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                Require approval for forecasts
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input type="checkbox" checked={form.enableSentimentExtraction}
                  onChange={(e) => setForm({ ...form, enableSentimentExtraction: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                Enable sentiment extraction
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input type="checkbox" checked={form.enableRejectionTracking}
                  onChange={(e) => setForm({ ...form, enableRejectionTracking: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                Enable rejection tracking
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input type="checkbox" checked={form.showMetadataOnForecast}
                  onChange={(e) => setForm({ ...form, showMetadataOnForecast: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                Show metadata on forecast
              </label>
            </div>
            <div className="max-w-xs">
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Vote bias: {form.voteBias} / 100
                <span className="ml-2 text-gray-400 font-normal">
                  ({form.voteBias < 40 ? 'leans NO' : form.voteBias > 60 ? 'leans YES' : 'neutral'})
                </span>
              </label>
              <input type="range" min={0} max={100} value={form.voteBias}
                onChange={(e) => setForm({ ...form, voteBias: parseInt(e.target.value) })}
                className="w-full accent-blue-600" />
              <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                <span>0 NO</span>
                <span>50 neutral</span>
                <span>100 YES</span>
              </div>
            </div>
          </div>

          <div className="border rounded-lg p-3 space-y-3 bg-navy-800">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Active Window (UTC)</p>
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input type="checkbox" checked={form.activeHoursStart == null}
                onChange={(e) => setForm({
                  ...form,
                  activeHoursStart: e.target.checked ? null : 8,
                  activeHoursEnd: e.target.checked ? null : 22,
                })}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              Always active (no time restriction)
            </label>
            {form.activeHoursStart != null && (
              <div className="grid grid-cols-2 gap-4">
                <NumberField label="Start hour (0–23 UTC)" value={form.activeHoursStart} min={0} max={23}
                  onChange={(v) => setForm({ ...form, activeHoursStart: v })} />
                <NumberField label="End hour (0–23 UTC, exclusive)" value={form.activeHoursEnd ?? 22} min={0} max={23}
                  onChange={(v) => setForm({ ...form, activeHoursEnd: v })} />
                <p className="col-span-2 text-xs text-gray-400">
                  Overnight ranges work — e.g. start&nbsp;22 &rarr; end&nbsp;06 means 10&nbsp;pm–6&nbsp;am UTC.
                </p>
              </div>
            )}
          </div>

          <div className="border rounded-lg p-3 space-y-3 bg-navy-800">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Confidence Auto-Refill</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <NumberField label="Refill threshold" value={form.cuRefillAt} min={0}
                  onChange={(v) => setForm({ ...form, cuRefillAt: v })} />
                {form.cuRefillAt === 0 && <p className="text-xs text-gray-400 mt-1">0 = disabled</p>}
              </div>
              <NumberField label="Refill amount" value={form.cuRefillAmount} min={1}
                onChange={(v) => setForm({ ...form, cuRefillAmount: v })} />
            </div>
            <p className="text-xs text-gray-400">
              When bot&apos;s Confidence points drop to or below the threshold, grant the refill amount automatically before the next stake.
            </p>
          </div>

          <Field label="Tag filter" hint="Bot only acts on forecasts with these tags. Leave empty for all tags.">
            <div className="mt-2 space-y-2">
              <div className="flex flex-wrap gap-1.5 min-h-8 p-2 border rounded bg-navy-700">
                {form.tagFilter.map(slug => (
                  <span key={slug} className="inline-flex items-center gap-1 bg-blue-100 text-cobalt-light px-2 py-0.5 rounded text-xs font-medium">
                    {allTags.find(t => t.slug === slug)?.name ?? slug}
                    <button type="button" onClick={() => toggleTag(slug)} className="hover:text-blue-900">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {form.tagFilter.length === 0 && <span className="text-gray-400 text-xs italic">All tags enabled</span>}
              </div>
              <div className="relative">
                <input type="text" value={tagInput}
                  onChange={(e) => { setTagInput(e.target.value); setShowTagSuggestions(true) }}
                  onFocus={() => setShowTagSuggestions(true)}
                  placeholder="Search tags to add..."
                  className="w-full border rounded px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      if (tagInput.trim()) {
                        const slug = tagInput.toLowerCase().replace(/\s+/g, '-')
                        if (!form.tagFilter.includes(slug)) toggleTag(slug)
                        setTagInput('')
                      }
                    }
                  }}
                />
                {showTagSuggestions && tagInput && (
                  <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-navy-700 border rounded shadow-lg max-h-40 overflow-y-auto">
                    {filteredTags.map(tag => (
                      <button key={tag.id} type="button"
                        onClick={() => { toggleTag(tag.slug); setTagInput(''); setShowTagSuggestions(false) }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-cobalt/10 transition-colors border-b last:border-0">
                        <span className="font-medium">{tag.name}</span>
                        <span className="ml-2 text-[10px] text-gray-400">#{tag.slug}</span>
                      </button>
                    ))}
                    {filteredTags.length === 0 && (
                      <div className="px-3 py-2 text-xs text-gray-500">
                        No matches. Press Enter to add &quot;{tagInput}&quot;
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Field>

          <div className="flex justify-end gap-2 pt-2 pb-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded hover:bg-navy-800">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
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
      <label className="block text-sm font-medium text-text-secondary mb-1">{label}</label>
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
      <label className="block text-xs font-medium text-gray-400 mb-1">{label}</label>
      <input type="number" value={value} min={min} max={max}
        onChange={(e) => onChange(parseInt(e.target.value) || min)}
        className="w-full border rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
    </div>
  )
}
