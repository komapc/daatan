'use client'
import { useState, useEffect } from 'react'
import { Loader2, Search, Trash2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'

export default function ForecastsTable() {
  const [predictions, setPredictions] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    fetchPredictions()
  }, [page]) // Refetch on page change

  const fetchPredictions = async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/admin/predictions?page=${page}&limit=20&search=${encodeURIComponent(search)}`)
      if (res.ok) {
        const data = await res.json()
        setPredictions(data.predictions)
        setTotalPages(data.pages)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    fetchPredictions()
  }

  const updateStatus = async (id: string, newStatus: string) => {
    if (!confirm(`Are you sure you want to change status to ${newStatus}?`)) return

    try {
      const res = await fetch(`/api/admin/predictions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        setPredictions(predictions.map(p => p.id === id ? { ...p, status: newStatus } : p))
      } else {
        alert('Failed to update status')
      }
    } catch (err) {
      console.error(err)
      alert('Error updating status')
    }
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
              placeholder="Search by claim, author, or email..." 
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
                  <th className="p-3 border-b text-left">Details</th>
                  <th className="p-3 border-b text-left">Author</th>
                  <th className="p-3 border-b text-left">Status</th>
                  <th className="p-3 border-b text-center">Stats</th>
                  <th className="p-3 border-b text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {predictions.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-3 max-w-md">
                      <div className="font-medium text-gray-900 mb-1">{p.claimText}</div>
                      <div className="text-xs text-gray-500 font-mono">{p.id}</div>
                    </td>
                    <td className="p-3">
                      <div className="text-sm font-medium text-gray-900">{p.author.name}</div>
                      <div className="text-xs text-gray-500">{p.author.email}</div>
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        p.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                        p.status === 'RESOLVED_CORRECT' ? 'bg-blue-100 text-blue-800' :
                        p.status === 'RESOLVED_WRONG' ? 'bg-orange-100 text-orange-800' :
                        p.status === 'VOID' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="p-3 text-center text-sm text-gray-600">
                      <div title="Commitments">{p._count.commitments} commits</div>
                      <div title="Comments" className="text-xs text-gray-400 mt-0.5">{p._count.comments} comments</div>
                    </td>
                    <td className="p-3 text-right space-x-2">
                      {p.status !== 'VOID' && (
                        <button 
                          onClick={() => updateStatus(p.id, 'VOID')}
                          className="text-red-600 hover:text-red-900 text-sm font-medium"
                          title="Void Prediction"
                        >
                          Void
                        </button>
                      )}
                      {p.status === 'VOID' && (
                         <button 
                          onClick={() => updateStatus(p.id, 'DRAFT')}
                          className="text-gray-600 hover:text-gray-900 text-sm font-medium"
                          title="Restore to Draft"
                        >
                          Restore
                        </button>
                      )}
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
