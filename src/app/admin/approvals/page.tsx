'use client'
import { useState, useEffect, useCallback } from 'react'
import { Loader2, CheckCircle, XCircle, ExternalLink, Bot } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

type PendingForecast = {
    id: string
    claimText: string
    slug: string | null
    status: string
    outcomeType: string
    resolveByDatetime: string
    createdAt: string
    publishedAt: string | null
    author: {
        name: string | null
        username: string | null
        email: string
        image: string | null
        isBot: boolean
    }
    _count: { commitments: number; comments: number }
}

export default function ApprovalsPage() {
    const [predictions, setPredictions] = useState<PendingForecast[]>([])
    const [total, setTotal] = useState(0)
    const [isLoading, setIsLoading] = useState(true)
    const [actioningId, setActioningId] = useState<string | null>(null)

    const fetchPending = useCallback(async () => {
        setIsLoading(true)
        try {
            const res = await fetch('/api/admin/approvals')
            if (res.ok) {
                const data = await res.json()
                setPredictions(data.predictions)
                setTotal(data.total)
            }
        } catch {
            // silent
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => { fetchPending() }, [fetchPending])

    const handleApprove = async (id: string) => {
        setActioningId(id)
        try {
            const res = await fetch(`/api/admin/forecasts/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'ACTIVE' }),
            })
            if (res.ok) {
                setPredictions((prev) => prev.filter((p) => p.id !== id))
                setTotal((prev) => prev - 1)
            }
        } catch {
            // silent
        } finally {
            setActioningId(null)
        }
    }

    const handleReject = async (id: string) => {
        if (!confirm('Reject this forecast? It will be moved to VOID status.')) return
        setActioningId(id)
        try {
            const res = await fetch(`/api/admin/forecasts/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'VOID' }),
            })
            if (res.ok) {
                setPredictions((prev) => prev.filter((p) => p.id !== id))
                setTotal((prev) => prev - 1)
            }
        } catch {
            // silent
        } finally {
            setActioningId(null)
        }
    }

    const handleApproveAll = async () => {
        if (!confirm(`Approve all ${predictions.length} pending forecasts?`)) return
        for (const p of predictions) {
            await handleApprove(p.id)
        }
    }

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Pending Approvals</h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Bot-generated forecasts awaiting human review before going live.
                    </p>
                </div>
                {predictions.length > 1 && (
                    <button
                        onClick={handleApproveAll}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                    >
                        <CheckCircle className="w-4 h-4" />
                        Approve All ({predictions.length})
                    </button>
                )}
            </div>

            {isLoading ? (
                <div className="flex justify-center py-16">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                </div>
            ) : predictions.length === 0 ? (
                <div className="text-center py-16">
                    <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">All clear!</p>
                    <p className="text-sm text-gray-400 mt-1">No forecasts pending approval.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {predictions.map((p) => (
                        <div
                            key={p.id}
                            className="bg-white border border-amber-200 rounded-xl p-4 hover:border-amber-300 transition-colors shadow-sm"
                        >
                            <div className="flex items-start justify-between gap-4">
                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        {p.author.image ? (
                                            <Image src={p.author.image} alt="" width={20} height={20} className="rounded-full" />
                                        ) : (
                                            <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-500">
                                                {p.author.name?.charAt(0) || '?'}
                                            </div>
                                        )}
                                        <span className="text-sm font-medium text-gray-700">
                                            {p.author.username || p.author.name || 'Anon'}
                                        </span>
                                        {p.author.isBot && (
                                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-indigo-100 text-indigo-700">
                                                <Bot className="w-3 h-3" /> Bot
                                            </span>
                                        )}
                                        <span className="text-xs text-gray-400">
                                            {new Date(p.createdAt).toLocaleDateString()} {new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>

                                    <Link
                                        href={`/forecasts/${p.slug || p.id}`}
                                        className="text-gray-900 font-medium hover:text-blue-600 transition-colors line-clamp-2"
                                    >
                                        {p.claimText}
                                    </Link>

                                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">
                                            ⏳ Pending Approval
                                        </span>
                                        <span>{p._count.commitments} stakes</span>
                                        <span>{p._count.comments} comments</span>
                                        <span>Resolves: {new Date(p.resolveByDatetime).toLocaleDateString()}</span>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2 shrink-0">
                                    <Link
                                        href={`/forecasts/${p.slug || p.id}`}
                                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        title="View forecast"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                    </Link>
                                    <button
                                        onClick={() => handleApprove(p.id)}
                                        disabled={actioningId === p.id}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                                        title="Approve — set to ACTIVE"
                                    >
                                        {actioningId === p.id ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <CheckCircle className="w-4 h-4" />
                                        )}
                                        Approve
                                    </button>
                                    <button
                                        onClick={() => handleReject(p.id)}
                                        disabled={actioningId === p.id}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-red-200 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                                        title="Reject — set to VOID"
                                    >
                                        <XCircle className="w-4 h-4" />
                                        Reject
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}

                    <p className="text-xs text-gray-400 text-center pt-2">
                        {total} forecast{total !== 1 ? 's' : ''} pending approval
                    </p>
                </div>
            )}
        </div>
    )
}
