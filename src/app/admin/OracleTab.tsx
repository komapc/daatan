'use client'
import { useState, useEffect } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'

type ProviderSummary = {
  provider: string
  callCount: number
  avgDurationMs: number | null
  lastSeenAt: string | null
}

type CallLogEntry = {
  id: string
  provider: string
  providerChain: string[]
  query: string
  resultCount: number
  durationMs: number
  createdAt: string
}

type OracleStats = {
  windowDays: number
  summary: ProviderSummary[]
  recent: CallLogEntry[]
}

export default function OracleTab() {
  const [stats, setStats] = useState<OracleStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchStats = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/admin/oracle-stats')
      if (res.ok) setStats(await res.json())
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { fetchStats() }, [])

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin text-gray-400" size={24} />
      </div>
    )
  }

  if (!stats) {
    return <p className="text-gray-500 text-sm">Failed to load Oracle stats.</p>
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Oracle Search Stats <span className="text-sm font-normal text-gray-500">(last {stats.windowDays} days)</span></h2>
        <button
          onClick={fetchStats}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Provider summary */}
      <section>
        <h3 className="text-sm font-medium text-gray-700 mb-2">By provider</h3>
        {stats.summary.length === 0 ? (
          <p className="text-sm text-gray-400">No calls recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border-collapse">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="py-2 pr-6 font-medium">Provider</th>
                  <th className="py-2 pr-6 font-medium text-right">Calls</th>
                  <th className="py-2 pr-6 font-medium text-right">Avg duration</th>
                  <th className="py-2 font-medium">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {stats.summary.map(row => (
                  <tr key={row.provider} className="border-b last:border-0">
                    <td className="py-2 pr-6 font-mono">{row.provider}</td>
                    <td className="py-2 pr-6 text-right tabular-nums">{row.callCount}</td>
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
                  <th className="py-2 pr-4 font-medium">Provider</th>
                  <th className="py-2 pr-4 font-medium">Chain</th>
                  <th className="py-2 pr-4 font-medium">Results</th>
                  <th className="py-2 pr-4 font-medium text-right">Duration</th>
                  <th className="py-2 font-medium">Query</th>
                </tr>
              </thead>
              <tbody>
                {stats.recent.map(entry => (
                  <tr key={entry.id} className="border-b last:border-0 align-top">
                    <td className="py-2 pr-4 text-gray-500 whitespace-nowrap">
                      {new Date(entry.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2 pr-4 font-mono whitespace-nowrap">{entry.provider}</td>
                    <td className="py-2 pr-4 font-mono text-gray-400 whitespace-nowrap">
                      {entry.providerChain.length > 0 ? entry.providerChain.join(' → ') : '—'}
                    </td>
                    <td className="py-2 pr-4 tabular-nums text-right">{entry.resultCount}</td>
                    <td className="py-2 pr-4 tabular-nums text-right whitespace-nowrap">{entry.durationMs} ms</td>
                    <td className="py-2 text-gray-600 max-w-xs truncate" title={entry.query}>{entry.query}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
