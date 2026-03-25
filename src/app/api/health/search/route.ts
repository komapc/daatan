import { NextResponse } from 'next/server'
import { notifySearchCreditsLow } from '@/lib/services/telegram'

export const dynamic = 'force-dynamic'

const LOW_CREDITS_THRESHOLD = 100

interface ProviderStatus {
  configured: boolean
  status: 'ok' | 'error' | 'not_configured'
  credits?: number
  error?: string
}

async function checkSerper(): Promise<ProviderStatus> {
  const apiKey = process.env.SERPER_API_KEY
  if (!apiKey) return { configured: false, status: 'not_configured' }

  try {
    const res = await fetch('https://google.serper.dev/account', {
      headers: { 'X-API-KEY': apiKey },
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { configured: true, status: 'error', error: `HTTP ${res.status}: ${body.slice(0, 200)}` }
    }
    const data = await res.json() as { balance?: number }
    const credits = data.balance ?? undefined
    if (credits !== undefined && credits < LOW_CREDITS_THRESHOLD) {
      notifySearchCreditsLow('Serper', credits)
    }
    return { configured: true, status: 'ok', credits }
  } catch (e) {
    return { configured: true, status: 'error', error: e instanceof Error ? e.message : 'unknown' }
  }
}

async function checkSerpApi(): Promise<ProviderStatus> {
  const apiKey = process.env.SERPAPI_API_KEY
  if (!apiKey) return { configured: false, status: 'not_configured' }

  try {
    const res = await fetch(`https://serpapi.com/account.json?api_key=${apiKey}`)
    if (!res.ok) {
      return { configured: true, status: 'error', error: `HTTP ${res.status}` }
    }
    const data = await res.json() as { searches_left?: number }
    const credits = data.searches_left ?? undefined
    if (credits !== undefined && credits < LOW_CREDITS_THRESHOLD) {
      notifySearchCreditsLow('SerpAPI', credits)
    }
    return { configured: true, status: 'ok', credits }
  } catch (e) {
    return { configured: true, status: 'error', error: e instanceof Error ? e.message : 'unknown' }
  }
}

export async function GET() {
  const [serper, serpapi] = await Promise.all([checkSerper(), checkSerpApi()])

  const allConfiguredProvidersFailed =
    (serper.configured && serper.status !== 'ok') &&
    (serpapi.configured && serpapi.status !== 'ok')

  const anyOk = serper.status === 'ok' || serpapi.status === 'ok' ||
    (!serper.configured && !serpapi.configured) // DDG fallback always available

  return NextResponse.json(
    {
      serper,
      serpapi,
      ddg: { configured: true, status: 'ok', credits: 'unlimited' },
      overall: anyOk ? 'ok' : 'degraded',
      allConfiguredProvidersFailed,
    },
    { status: anyOk ? 200 : 503 },
  )
}
