import { Suspense } from 'react'
import { headers } from 'next/headers'
import { Loader2 } from 'lucide-react'
import FeedClient from './FeedClient'
import type { Prediction } from '@/components/forecasts/ForecastCard'

export const dynamic = 'force-dynamic'

function FeedLoading() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
      <p className="text-gray-500 font-medium">Loading your feed...</p>
    </div>
  )
}

/**
 * Fetch the default ACTIVE feed server-side so crawlers see content on first
 * load. Uses an internal request to reuse all enrichment logic in the API.
 */
async function getInitialFeed(): Promise<Prediction[]> {
  try {
    const headersList = await headers()
    const host = headersList.get('host') ?? 'localhost:3000'
    const protocol = host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https'
    const res = await fetch(
      `${protocol}://${host}/api/forecasts?status=ACTIVE&limit=20`,
      { cache: 'no-store' },
    )
    if (!res.ok) return []
    const data = await res.json()
    return data.predictions ?? []
  } catch {
    return []
  }
}

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; tags?: string; sortBy?: string }>
}) {
  const params = await searchParams
  // Only SSR the default view (no filter params) — this is what crawlers hit.
  // Custom-filter URLs are less SEO-critical and the client handles them.
  const hasCustomParams = params.status || params.tags || params.sortBy
  const initialPredictions = hasCustomParams ? [] : await getInitialFeed()

  return (
    <Suspense fallback={<FeedLoading />}>
      <FeedClient initialPredictions={initialPredictions} />
    </Suspense>
  )
}
