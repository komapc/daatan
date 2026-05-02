import { headers } from 'next/headers'
import { PredictionsPage } from './PredictionsClient'
import type { Prediction } from '@/components/forecasts/ForecastCard'

export const revalidate = 60

async function getInitialFeed(): Promise<Prediction[]> {
  try {
    const headersList = await headers()
    const host = headersList.get('host') ?? 'localhost:3000'
    const protocol = host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https'
    const res = await fetch(`${protocol}://${host}/api/forecasts?status=ACTIVE&limit=20`, {
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.predictions ?? []
  } catch {
    return []
  }
}

export default async function ForecastsPage() {
  const initialPredictions = await getInitialFeed()

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Forecasts on DAATAN',
    description: 'Open and resolved predictions tracked on DAATAN.',
    numberOfItems: initialPredictions.length,
    itemListElement: initialPredictions.slice(0, 20).map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `https://daatan.com/forecasts/${p.slug || p.id}`,
      name: p.claimText,
    })),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <PredictionsPage initialPredictions={initialPredictions} />
    </>
  )
}
