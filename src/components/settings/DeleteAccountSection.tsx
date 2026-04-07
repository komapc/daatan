'use client'

import { useState } from 'react'
import { signOut } from 'next-auth/react'
import { Trash2 } from 'lucide-react'
import { toast } from 'react-hot-toast'

export default function DeleteAccountSection() {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/account', { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete account')
      toast.success('Account deleted')
      await signOut({ callbackUrl: '/' })
    } catch {
      toast.error('Failed to delete account. Please try again.')
      setLoading(false)
      setConfirming(false)
    }
  }

  return (
    <div className="p-6">
      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          className="flex items-center gap-2 px-4 py-2 bg-red-900/20 border border-red-800/50 text-red-400 rounded-xl text-sm font-semibold hover:bg-red-900/40 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Delete my account
        </button>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-red-400 font-semibold">
            This will permanently delete your account, all your forecasts, stakes, and personal data. This cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleDelete}
              disabled={loading}
              className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Deleting...' : 'Yes, delete everything'}
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={loading}
              className="px-4 py-2 bg-navy-600 text-text-secondary rounded-xl text-sm font-semibold hover:bg-navy-500 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
