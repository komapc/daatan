'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { User, Globe, Twitter, Bell, Save, X } from 'lucide-react'
import Link from 'next/link'

interface ProfileEditFormProps {
  user: {
    id: string
    name: string | null
    email: string
    image: string | null
    username: string | null
    website: string | null
    twitterHandle: string | null
    emailNotifications: boolean
  }
}

export default function ProfileEditForm({ user }: ProfileEditFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const [formData, setFormData] = useState({
    username: user.username || '',
    website: user.website || '',
    twitterHandle: user.twitterHandle || '',
    emailNotifications: user.emailNotifications,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess(false)

    try {
      const response = await fetch('/api/profile/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update profile')
      }

      setSuccess(true)
      setTimeout(() => {
        router.push('/profile')
        router.refresh()
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-100 rounded-3xl p-6 sm:p-8 shadow-sm">
      <div className="space-y-6">
        {/* Username */}
        <div>
          <label htmlFor="username" className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
            <User className="w-4 h-4 text-gray-400" />
            Username (Nickname)
          </label>
          <input
            type="text"
            id="username"
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            placeholder="your_username"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            maxLength={30}
          />
          <p className="text-xs text-gray-500 mt-1">Your public display name (letters, numbers, underscore only)</p>
        </div>

        {/* Website */}
        <div>
          <label htmlFor="website" className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
            <Globe className="w-4 h-4 text-gray-400" />
            Website
          </label>
          <input
            type="url"
            id="website"
            value={formData.website}
            onChange={(e) => setFormData({ ...formData, website: e.target.value })}
            placeholder="https://yourwebsite.com"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-500 mt-1">Your personal website or blog</p>
        </div>

        {/* Twitter Handle */}
        <div>
          <label htmlFor="twitterHandle" className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
            <Twitter className="w-4 h-4 text-gray-400" />
            Twitter/X Handle
          </label>
          <div className="flex items-center">
            <span className="px-4 py-3 bg-gray-50 border border-r-0 border-gray-200 rounded-l-xl text-gray-500 font-medium">@</span>
            <input
              type="text"
              id="twitterHandle"
              value={formData.twitterHandle}
              onChange={(e) => setFormData({ ...formData, twitterHandle: e.target.value.replace('@', '') })}
              placeholder="username"
              className="flex-1 px-4 py-3 border border-gray-200 rounded-r-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              maxLength={15}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">Your Twitter/X username (without @)</p>
        </div>

        {/* Email Notifications */}
        <div className="border-t border-gray-100 pt-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.emailNotifications}
              onChange={(e) => setFormData({ ...formData, emailNotifications: e.target.checked })}
              className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-bold text-gray-700">Email Notifications</span>
            </div>
          </label>
          <p className="text-xs text-gray-500 mt-2 ml-8">Receive updates about your predictions and stakes</p>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm">
            Profile updated successfully! Redirecting...
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Save className="w-4 h-4" />
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
          <Link
            href="/profile"
            className="flex items-center justify-center gap-2 bg-gray-100 text-gray-700 px-6 py-3 rounded-xl font-bold hover:bg-gray-200 transition-colors"
          >
            <X className="w-4 h-4" />
            Cancel
          </Link>
        </div>
      </div>
    </form>
  )
}
