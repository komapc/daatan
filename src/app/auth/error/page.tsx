'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { AlertCircle, ArrowLeft } from 'lucide-react'

const AuthErrorPage = () => {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center space-y-6">
        <div className="flex justify-center">
          <div className="p-3 bg-red-50 rounded-full">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-gray-900">Authentication Error</h1>
          <p className="text-gray-500">
            {error === 'Configuration' && 'There is a problem with the server configuration.'}
            {error === 'AccessDenied' && 'Access has been denied.'}
            {error === 'Verification' && 'The verification link has expired or has already been used.'}
            {error || 'An unexpected error occurred during authentication.'}
          </p>
        </div>

        <div className="pt-4">
          <Link
            href="/auth/signin"
            className="inline-flex items-center gap-2 text-blue-600 font-medium hover:text-blue-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Sign In
          </Link>
        </div>

        <div className="pt-8 border-t border-gray-100">
          <Link href="/" className="flex items-center justify-center gap-2 grayscale hover:grayscale-0 transition-all opacity-50 hover:opacity-100">
            <Image src="/logo-icon.svg" alt="DAATAN" width={24} height={24} />
            <span className="text-sm font-bold text-gray-900">DAATAN</span>
          </Link>
        </div>
      </div>
    </div>
  )
}

export default AuthErrorPage

