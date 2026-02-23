'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import {
  Shield,
  Users,
  TrendingUp,
  MessageSquare,
  Search,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  Crown,
  Trash2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────

type AdminUser = {
  id: string
  name: string | null
  email: string
  username: string | null
  image: string | null
  role: 'USER' | 'RESOLVER' | 'APPROVER' | 'ADMIN'
  rs: number
  cuAvailable: number
  cuLocked: number
  createdAt: string
  _count: { predictions: number; commitments: number; comments: number }
}

type AdminPrediction = {
  id: string
  claimText: string
  slug: string | null
  status: string
  outcomeType: string
  resolveByDatetime: string
  createdAt: string
  publishedAt: string | null
  resolvedAt: string | null
  author: { id: string; name: string | null; username: string | null; image: string | null }
  _count: { commitments: number; comments: number }
}

type AdminComment = {
  id: string
  text: string
  createdAt: string
  deletedAt: string | null
  author: { id: string; name: string | null; username: string | null; image: string | null }
  prediction: { id: string; slug?: string; claimText: string } | null
  _count: { replies: number; reactions: number }
}

type Tab = 'users' | 'forecasts' | 'comments'

// ─── Component ───────────────────────────────────────────────────────

export default function AdminClient() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('forecasts')

  // Redirect non-admin/moderator users
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role !== 'ADMIN' && session?.user?.role !== 'RESOLVER' && session?.user?.role !== 'APPROVER') {
      router.push('/')
    }
  }, [status, session, router])

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    )
  }

  if (session?.user?.role !== 'ADMIN' && session?.user?.role !== 'RESOLVER' && session?.user?.role !== 'APPROVER') {
    return null
  }

  const isAdmin = session.user.role === 'ADMIN'
  const tabs: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }>; adminOnly?: boolean }[] = [
    { key: 'forecasts', label: 'Forecasts', icon: TrendingUp },
    { key: 'comments', label: 'Comments', icon: MessageSquare },
    { key: 'users', label: 'Users', icon: Users, adminOnly: true },
  ]

  const visibleTabs = tabs.filter((t) => !t.adminOnly || isAdmin)

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-red-50 rounded-xl">
          <Shield className="w-8 h-8 text-red-600" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Admin Panel</h1>
          <p className="text-sm text-gray-500">
            {isAdmin ? 'Full admin access' : 'Moderator access'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'forecasts' && <ForecastsTab />}
      {activeTab === 'comments' && <CommentsTab />}
      {activeTab === 'users' && isAdmin && <UsersTab />}
    </div>
  )
}


// ─── Forecasts Tab ───────────────────────────────────────────────────

function ForecastsTab() {
  const [predictions, setPredictions] = useState<AdminPrediction[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  const fetchPredictions = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)

      const res = await fetch(`/api/admin/forecasts?${params}`)
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
  }, [page, search, statusFilter])

  useEffect(() => { fetchPredictions() }, [fetchPredictions])

  const totalPages = Math.ceil(total / 20)

  const statusColors: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-700',
    ACTIVE: 'bg-green-100 text-green-700',
    PENDING: 'bg-yellow-100 text-yellow-700',
    PENDING_APPROVAL: 'bg-amber-100 text-amber-700',
    RESOLVED_CORRECT: 'bg-blue-100 text-blue-700',
    RESOLVED_WRONG: 'bg-red-100 text-red-700',
    VOID: 'bg-gray-100 text-gray-500',
    UNRESOLVABLE: 'bg-purple-100 text-purple-700',
  }

  return (
    <div>
      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search forecasts..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Filter by status"
        >
          <option value="">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="ACTIVE">Active</option>
          <option value="PENDING">Pending</option>
          <option value="PENDING_APPROVAL">Pending Approval</option>
          <option value="RESOLVED_CORRECT">Resolved (Correct)</option>
          <option value="RESOLVED_WRONG">Resolved (Wrong)</option>
          <option value="VOID">Void</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
        </div>
      ) : predictions.length === 0 ? (
        <p className="text-center text-gray-500 py-12">No forecasts found.</p>
      ) : (
        <>
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Forecast</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Author</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">Stakes</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">Comments</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">Resolve By</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {predictions.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 max-w-xs">
                        <p className="font-medium text-gray-900 truncate">{p.claimText}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {p.author.image ? (
                            <Image src={p.author.image} alt="" width={24} height={24} className="rounded-full" />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">
                              {p.author.name?.charAt(0) || '?'}
                            </div>
                          )}
                          <span className="text-gray-700 text-xs truncate max-w-[100px]">
                            {p.author.username || p.author.name || 'Anon'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[p.status] || 'bg-gray-100 text-gray-700'}`}>
                          {p.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">{p._count.commitments}</td>
                      <td className="px-4 py-3 text-center text-gray-600">{p._count.comments}</td>
                      <td className="px-4 py-3 text-right text-xs text-gray-500">
                        {new Date(p.resolveByDatetime).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Link
                          href={`/forecasts/${p.slug || p.id}`}
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium"
                        >
                          <ExternalLink className="w-3 h-3" />
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
        </>
      )}
    </div>
  )
}

// ─── Comments Tab ────────────────────────────────────────────────────

function CommentsTab() {
  const [comments, setComments] = useState<AdminComment[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [showDeleted, setShowDeleted] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchComments = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (search) params.set('search', search)
      if (showDeleted) params.set('showDeleted', 'true')

      const res = await fetch(`/api/admin/comments?${params}`)
      if (res.ok) {
        const data = await res.json()
        setComments(data.comments)
        setTotal(data.total)
      }
    } catch {
      // silent
    } finally {
      setIsLoading(false)
    }
  }, [page, search, showDeleted])

  useEffect(() => { fetchComments() }, [fetchComments])

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/comments/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setComments((prev) => prev.map((c) => c.id === id ? { ...c, deletedAt: new Date().toISOString() } : c))
      }
    } catch {
      // silent
    } finally {
      setDeletingId(null)
    }
  }

  const totalPages = Math.ceil(total / 20)

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search comments..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={showDeleted}
            onChange={(e) => { setShowDeleted(e.target.checked); setPage(1) }}
            className="rounded border-gray-300"
          />
          Show deleted
        </label>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-center text-gray-500 py-12">No comments found.</p>
      ) : (
        <>
          <div className="space-y-3">
            {comments.map((c) => {
              const target = c.prediction
                ? { label: c.prediction.claimText, href: `/forecasts/${c.prediction.slug || c.prediction.id}` }
                : null

              return (
                <div
                  key={c.id}
                  className={`bg-white border rounded-xl p-4 ${c.deletedAt ? 'border-red-200 bg-red-50/30 opacity-60' : 'border-gray-100'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {c.author.image ? (
                          <Image src={c.author.image} alt="" width={20} height={20} className="rounded-full" />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-500">
                            {c.author.name?.charAt(0) || '?'}
                          </div>
                        )}
                        <span className="text-sm font-medium text-gray-900">
                          {c.author.username || c.author.name || 'Anon'}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(c.createdAt).toLocaleDateString()}
                        </span>
                        {c.deletedAt && (
                          <span className="text-xs text-red-500 font-medium">Deleted</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-700 line-clamp-2">{c.text}</p>
                      {target && (
                        <Link href={target.href} className="text-xs text-blue-500 hover:underline mt-1 inline-block truncate max-w-xs">
                          on: {target.label}
                        </Link>
                      )}
                      <div className="flex gap-3 mt-1 text-xs text-gray-400">
                        <span>{c._count.replies} replies</span>
                        <span>{c._count.reactions} reactions</span>
                      </div>
                    </div>
                    {!c.deletedAt && (
                      <button
                        onClick={() => handleDelete(c.id)}
                        disabled={deletingId === c.id}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete comment"
                      >
                        {deletingId === c.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
        </>
      )}
    </div>
  )
}

// ─── Users Tab ───────────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (search) params.set('search', search)

      const res = await fetch(`/api/admin/users?${params}`)
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users)
        setTotal(data.total)
      }
    } catch {
      // silent
    } finally {
      setIsLoading(false)
    }
  }, [page, search])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const updateRole = async (userId: string, newRole: 'USER' | 'RESOLVER' | 'APPROVER' | 'ADMIN') => {
    setUpdatingId(userId)
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      if (res.ok) {
        const updated = await res.json()
        setUsers((prev) =>
          prev.map((u) => u.id === userId ? { ...u, role: updated.role } : u)
        )
      }
    } catch {
      // silent
    } finally {
      setUpdatingId(null)
    }
  }

  const totalPages = Math.ceil(total / 20)

  return (
    <div>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name, email, or username..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
        </div>
      ) : users.length === 0 ? (
        <p className="text-center text-gray-500 py-12">No users found.</p>
      ) : (
        <>
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">User</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">Roles</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">RS</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">CU</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">Activity</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">Joined</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {u.image ? (
                            <Image src={u.image} alt="" width={28} height={28} className="rounded-full" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">
                              {u.name?.charAt(0) || '?'}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate text-sm">{u.name || 'Anonymous'}</p>
                            <p className="text-xs text-gray-400 truncate">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {u.role === 'ADMIN' && (
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                              <Crown className="w-3 h-3" /> Admin
                            </span>
                          )}
                          {u.role === 'RESOLVER' && (
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                              <ShieldCheck className="w-3 h-3" /> Resolver
                            </span>
                          )}
                          {u.role === 'USER' && (
                            <span className="text-xs text-gray-400">User</span>
                          )}
                          {u.role === 'APPROVER' && (
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                              <ShieldCheck className="w-3 h-3" /> Approver
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center font-medium text-gray-700">{u.rs.toFixed(1)}</td>
                      <td className="px-4 py-3 text-center text-gray-600">
                        {u.cuAvailable} / {u.cuAvailable + u.cuLocked}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="text-xs text-gray-500">
                          {u._count.predictions}p · {u._count.commitments}c · {u._count.comments}m
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-gray-500">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <select
                          value={u.role}
                          onChange={(e) => updateRole(u.id, e.target.value as AdminUser['role'])}
                          disabled={updatingId === u.id}
                          className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                        >
                          <option value="USER">User</option>
                          <option value="RESOLVER">Resolver</option>
                          <option value="APPROVER">Approver</option>
                          <option value="ADMIN">Admin</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
        </>
      )}
    </div>
  )
}

// ─── Shared Pagination ───────────────────────────────────────────────

function Pagination({ page, totalPages, total, onPageChange }: {
  page: number
  totalPages: number
  total: number
  onPageChange: (p: number) => void
}) {
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between mt-4 px-1">
      <span className="text-xs text-gray-500">{total} total</span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm text-gray-600">
          {page} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
