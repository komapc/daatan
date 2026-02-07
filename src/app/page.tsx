import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import FeedClient from './FeedClient'

export const dynamic = 'force-dynamic'

function FeedLoading() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
      <p className="text-gray-500 font-medium">Loading your feed...</p>
    </div>
  )
}

export default function FeedPage() {
  return (
    <Suspense fallback={<FeedLoading />}>
      <FeedClient />
    </Suspense>
  )
}
