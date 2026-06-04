'use client'
import { useState, useEffect, useCallback } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'

type Breakdown = {
  key: string
  callCount: number
  errorCount: number
  avgDurationMs: number | null
  lastSeenAt: string | null
}

type RecentCall = {
  id: string
  callType: string
  source: string
  status: string
  httpStatus: number | null
  searchEngine: string | null
  provider: string | null
  providerChain: string[]
  query: string | null
  resultCount: number | null
  durationMs: number
  createdAt: string
  user: { id: string; name: string | null; username: string | null } | null
  prediction: { id: string; slug: string | null; claimText: string } | null
}

type OracleStats = {
  windowDays: number
  totals: { totalCalls: number; errorCalls: number; errorRate: number; avgDurationMs: number | null }
  bySource: Breakdown[]
  byCallType: Breakdown[]
  byEngine: Breakdown[]
  byStatus: { key: string; callCount: number }[]
  recent: RecentCall[]
}

const WINDOW_OPTIONS = [1, 7, 30]

// Known workflows (OracleCallMeta source) and call types, for the filter dropdowns.
const SOURCE_OPTIONS = [
  'context-update', 'research', 'bot-voting', 'express-creation', 'express-guess',
  'multilingual-search', 'ibi-search', 'ibi-llm', 'ibi-fetch-url',
  'health-cron', 'leaderboard', 'other',
]
const CALLTYPE_OPTIONS = ['SEARCH', 'FORECAST', 'LEADERBOARD', 'HEALTH', 'SEARCH_HEALTH', 'LLM', 'FETCH_URL']

function statusClass(status: string): string {
  if (status === 'OK') return 'text-green-400'
  if (status === 'ERROR') return 'text-red-400'
  return 'text-amber-400' // EMPTY
}

function BreakdownTable({ title, label, rows }: { title: string; label: string; rows: Breakdown[] }) {
  return (
    <section>
      <h3 className="text-sm font-medium text-gray-700 mb-2">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-400">No calls recorded yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border-collapse">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-2 pr-6 font-medium">{label}</th>
                <th className="py-2 pr-6 font-medium text-right">Calls</th>
                <th className="py-2 pr-6 font-medium text-right">Errors</th>
                <th className="py-2 pr-6 font-medium text-right">Avg duration</th>
                <th className="py-2 font-medium">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.key} className="border-b last:border-0">
                  <td className="py-2 pr-6 font-mono">{row.key}</td>
                  <td className="py-2 pr-6 text-right tabular-nums">{row.callCount}</td>
                  <td className="py-2 pr-6 text-right tabular-nums">
                    {row.errorCount > 0 ? <span className="text-red-400">{row.errorCount}</span> : '0'}
                  </td>
                  <td className="py-2 pr-6 text-right tabular-nums">
                    {row.avgDurationMs != null ? `${row.avgDurationMs} ms` : '—'}
                  </td>
                  <td className="py-2 text-gray-500">
                    {row.lastSeenAt ? new Date(row.lastSeenAt).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default function OracleTab() {
  const [stats, setStats] = useState<OracleStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [windowDays, setWindowDays] = useState(30)
  const [source, setSource] = useState('')
  const [callType, setCallType] = useState('')

  const fetchStats = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ windowDays: String(windowDays) })
      if (source) params.set('source', source)
      if (callType) params.set('callType', callType)
      const res = await fetch(`/api/admin/oracle-stats?${params}`)
      if (res.ok) setStats(await res.json())
    } finally {
      setIsLoading(false)
    }
  }, [windowDays, source, callType])

  useEffect(() => { fetchStats() }, [fetchStats])

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold">Oracle Usage</h2>
        <div className="flex items-center gap-3">
          <select
            value={windowDays}
            onChange={e => setWindowDays(Number(e.target.value))}
            className="border border-navy-600 bg-navy-700 rounded p-1 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          >
            {WINDOW_OPTIONS.map(d => (
              <option key={d} value={d}>Last {d} {d === 1 ? 'day' : 'days'}</option>
            ))}
          </select>
          <select
            value={source}
            onChange={e => setSource(e.target.value)}
            className="border border-navy-600 bg-navy-700 rounded p-1 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            title="Filter by source workflow"
          >
            <option value="">All sources</option>
            {SOURCE_OPTIONS.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={callType}
            onChange={e => setCallType(e.target.value)}
            className="border border-navy-600 bg-navy-700 rounded p-1 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            title="Filter by call type"
          >
            <option value="">All types</option>
            {CALLTYPE_OPTIONS.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <button onClick={fetchStats} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-gray-400" size={24} />
        </div>
      ) : !stats ? (
        <p className="text-gray-500 text-sm">Failed to load Oracle stats.</p>
      ) : (
        <>
          {/* Totals */}
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 border border-navy-600 rounded-lg bg-navy-700">
              <div className="text-xs text-gray-400 uppercase tracking-wide">Total calls</div>
              <div className="text-xl font-bold tabular-nums">{stats.totals.totalCalls}</div>
            </div>
            <div className="p-3 border border-navy-600 rounded-lg bg-navy-700">
              <div className="text-xs text-gray-400 uppercase tracking-wide">Errors</div>
              <div className="text-xl font-bold tabular-nums text-red-400">{stats.totals.errorCalls}</div>
            </div>
            <div className="p-3 border border-navy-600 rounded-lg bg-navy-700">
              <div className="text-xs text-gray-400 uppercase tracking-wide">Error rate</div>
              <div className="text-xl font-bold tabular-nums">{stats.totals.errorRate}%</div>
            </div>
            <div className="p-3 border border-navy-600 rounded-lg bg-navy-700">
              <div className="text-xs text-gray-400 uppercase tracking-wide">Avg duration</div>
              <div className="text-xl font-bold tabular-nums">
                {stats.totals.avgDurationMs != null ? `${stats.totals.avgDurationMs} ms` : '—'}
              </div>
            </div>
          </section>

          <BreakdownTable title="By source" label="Source" rows={stats.bySource} />
          <BreakdownTable title="By call type" label="Call type" rows={stats.byCallType} />
          <BreakdownTable title="By search engine" label="Engine" rows={stats.byEngine} />

          {/* Recent call log */}
          <section>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Recent calls (last 50)</h3>
            {stats.recent.length === 0 ? (
              <p className="text-sm text-gray-400">No calls recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="py-2 pr-4 font-medium">Time</th>
                      <th className="py-2 pr-4 font-medium">Type</th>
                      <th className="py-2 pr-4 font-medium">Source</th>
                      <th className="py-2 pr-4 font-medium">Status</th>
                      <th className="py-2 pr-4 font-medium">Engine</th>
                      <th className="py-2 pr-4 font-medium">By</th>
                      <th className="py-2 pr-4 font-medium text-right">Results</th>
                      <th className="py-2 pr-4 font-medium text-right">Duration</th>
                      <th className="py-2 pr-4 font-medium">Query</th>
                      <th className="py-2 font-medium">Forecast</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recent.map(entry => (
                      <tr key={entry.id} className="border-b last:border-0 align-top">
                        <td className="py-2 pr-4 text-gray-500 whitespace-nowrap">{new Date(entry.createdAt).toLocaleString()}</td>
                        <td className="py-2 pr-4 font-mono whitespace-nowrap">{entry.callType}</td>
                        <td className="py-2 pr-4 font-mono whitespace-nowrap">{entry.source}</td>
                        <td className={`py-2 pr-4 font-mono whitespace-nowrap ${statusClass(entry.status)}`}>
                          {entry.status}{entry.httpStatus != null ? ` (${entry.httpStatus})` : ''}
                        </td>
                        <td className="py-2 pr-4 font-mono text-gray-400 whitespace-nowrap">{entry.searchEngine ?? '—'}</td>
                        <td className="py-2 pr-4 text-gray-500 whitespace-nowrap">
                          {entry.user ? (
                            <a href={`/profile/${entry.user.id}`} className="text-blue-500 hover:underline">
                              {entry.user.username ? `@${entry.user.username}` : entry.user.name || '—'}
                            </a>
                          ) : '—'}
                        </td>
                        <td className="py-2 pr-4 tabular-nums text-right">{entry.resultCount ?? '—'}</td>
                        <td className="py-2 pr-4 tabular-nums text-right whitespace-nowrap">{entry.durationMs} ms</td>
                        <td className="py-2 pr-4 text-gray-600 max-w-xs truncate" title={entry.query ?? ''}>{entry.query ?? '—'}</td>
                        <td className="py-2 whitespace-nowrap">
                          {entry.prediction ? (
                            <a
                              href={`/forecasts/${entry.prediction.slug ?? entry.prediction.id}`}
                              className="text-blue-500 hover:underline"
                              title={entry.prediction.claimText}
                            >
                              ↗ open
                            </a>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
