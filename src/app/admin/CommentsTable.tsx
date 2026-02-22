'use client'
import { useState, useEffect, useCallback } from 'react'
import { Loader2, Search, Trash2 } from 'lucide-react'
import { createClientLogger } from '@/lib/client-logger'
import { toast } from 'react-hot-toast'

const log = createClientLogger('CommentsTable')

export default function CommentsTable() {
  const [comments, setComments] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const fetchComments = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/admin/comments?page=${page}&limit=20&search=${encodeURIComponent(search)}`)
      if (res.ok) {
        const data = await res.json()
        setComments(data.comments)
        setTotalPages(data.pages)
      }
    } finally {
      setIsLoading(false)
    }
  }, [page, search])

  useEffect(() => {
    fetchComments()
  }, [fetchComments])

  const deleteComment = async (id: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) return

    try {
      const res = await fetch(`/api/admin/comments/${id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setComments(comments.filter(c => c.id !== id))
        toast.success('Comment deleted successfully')
      } else {
        toast.error('Failed to delete comment')
      }
    } catch (err) {
      log.error({ err }, 'Error loading comments')
      toast.error('Error deleting comment')
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    fetchComments()
  }

  return (
    <div>
      <div className="mb-6 flex gap-2">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search comments..."
              className="pl-10 pr-4 py-2 border rounded-lg w-full focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            Search
          </button>
        </form>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto border rounded-lg shadow-sm">
            <table className="w-full border-collapse bg-white">
              <thead className="bg-gray-50 text-gray-700 text-sm font-semibold uppercase tracking-wider">
                <tr>
                  <th className="p-3 border-b text-left">Content</th>
                  <th className="p-3 border-b text-left">Author</th>
                  <th className="p-3 border-b text-left">Prediction</th>
                  <th className="p-3 border-b text-right">Created</th>
                  <th className="p-3 border-b text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {comments.map((c) => (
                  <tr key={c.id} className={`hover:bg-gray-50 transition-colors ${c.deletedAt ? 'opacity-50' : ''}`}>
                    <td className="p-3 max-w-md truncate">{c.text}</td>
                    <td className="p-3 text-sm">{c.author.name}</td>
                    <td className="p-3 text-sm max-w-xs truncate">{c.prediction?.claimText || 'N/A'}</td>
                    <td className="p-3 text-right text-xs text-gray-500">{new Date(c.createdAt).toLocaleDateString()}</td>
                    <td className="p-3 text-right">
                      {!c.deletedAt && (
                        <button
                          onClick={() => deleteComment(c.id)}
                          className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50"
                          title="Delete Comment"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      {c.deletedAt && <span className="text-xs text-red-500 italic">Deleted</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex justify-between items-center text-sm text-gray-600">
            <div>Page {page} of {totalPages}</div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-gray-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
