'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Mail, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Something went wrong')
      }
      setSent(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-navy-800 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-navy-700 rounded-2xl shadow-sm border border-navy-600 p-8 space-y-8">
        <div className="flex flex-col items-center text-center">
          <Link href="/">
            <Image src="/logo-icon.svg" alt="DAATAN" width={64} height={64} className="mb-4" />
          </Link>
          <h1 className="text-2xl font-bold text-white">Forgot your password?</h1>
          <p className="text-gray-500 mt-2">
            Enter your email and we&apos;ll send you a reset link.
          </p>
        </div>

        {sent ? (
          <div className="bg-teal/10 border border-teal/30 rounded-xl p-6 flex flex-col items-center gap-3 text-center">
            <CheckCircle2 className="w-8 h-8 text-teal" />
            <p className="text-white font-semibold">Check your inbox</p>
            <p className="text-gray-400 text-sm">
              If an account exists for <span className="text-white">{email}</span>, you&apos;ll receive a reset link shortly.
            </p>
            <Link href="/auth/signin" className="mt-2 text-sm text-blue-500 hover:text-blue-400 transition-colors">
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            {error && (
              <div className="bg-red-900/20 border border-red-800/40 text-red-400 px-4 py-3 rounded-lg text-sm flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5" htmlFor="email">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    id="email"
                    type="email"
                    required
                    disabled={isLoading}
                    className="w-full pl-10 pr-4 py-2.5 bg-navy-800 border border-navy-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all disabled:opacity-50"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full py-3"
                disabled={isLoading}
                leftIcon={isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mail className="w-5 h-5" />}
              >
                {isLoading ? 'Sending…' : 'Send reset link'}
              </Button>
            </form>

            <div className="text-center text-sm">
              <Link href="/auth/signin" className="text-blue-500 hover:text-blue-400 transition-colors">
                Back to sign in
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
