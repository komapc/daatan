'use client'

import { useState } from 'react'
import { toError } from '@/lib/utils/error'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Lock, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const email = searchParams.get('email') ?? ''

  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  if (!token || !email) {
    return (
      <div className="bg-red-900/20 border border-red-800/40 text-red-400 px-4 py-3 rounded-lg text-sm flex items-start gap-3">
        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">Invalid reset link</p>
          <p className="mt-1">This link is missing required parameters. Please request a new one.</p>
          <Link href="/auth/forgot-password" className="mt-2 inline-block text-blue-400 hover:text-blue-300">
            Request new link →
          </Link>
        </div>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong')
      setDone(true)
      setTimeout(() => router.push('/auth/signin'), 2500)
    } catch (err) {
      setError(toError(err).message)
    } finally {
      setIsLoading(false)
    }
  }

  if (done) {
    return (
      <div className="bg-teal/10 border border-teal/30 rounded-xl p-6 flex flex-col items-center gap-3 text-center">
        <CheckCircle2 className="w-8 h-8 text-teal" />
        <p className="text-white font-semibold">Password updated!</p>
        <p className="text-gray-400 text-sm">Redirecting you to sign in…</p>
      </div>
    )
  }

  return (
    <>
      {error && (
        <div className="bg-red-900/20 border border-red-800/40 text-red-400 px-4 py-3 rounded-lg text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5" htmlFor="password">
            New Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              id="password"
              type="password"
              required
              minLength={8}
              disabled={isLoading}
              className="w-full pl-10 pr-4 py-2.5 bg-navy-800 border border-navy-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all disabled:opacity-50"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-gray-500">Must be at least 8 characters.</p>
        </div>

        <Button
          type="submit"
          className="w-full py-3"
          disabled={isLoading}
          leftIcon={isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Lock className="w-5 h-5" />}
        >
          {isLoading ? 'Saving…' : 'Set new password'}
        </Button>
      </form>
    </>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-navy-800 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-navy-700 rounded-2xl shadow-sm border border-navy-600 p-8 space-y-8">
        <div className="flex flex-col items-center text-center">
          <Link href="/">
            <Image src="/logo-icon.svg" alt="DAATAN" width={64} height={64} className="mb-4" />
          </Link>
          <h1 className="text-2xl font-bold text-white">Set new password</h1>
          <p className="text-gray-500 mt-2">Choose a strong password for your account.</p>
        </div>

        <Suspense fallback={<div className="h-32 animate-pulse bg-navy-800 rounded-xl" />}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  )
}
