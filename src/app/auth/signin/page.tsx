import { Suspense } from 'react'
import SignInClient from './SignInClient'

// Force dynamic rendering to ensure page is always server-rendered
export const dynamic = 'force-dynamic'

function SignInLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense fallback={<SignInLoading />}>
      <SignInClient />
    </Suspense>
  )
}
