import { NextResponse } from 'next/server'
import { notifySearchCreditsLow } from '@/lib/services/telegram'
import { SEARCH_LOW_CREDITS_THRESHOLD, getOracleSearchHealth, getLastOracleSearchError } from '@/lib/services/oracleSearch'
import { getStagingDataForSEOCallCount } from '@/lib/utils/webSearch'
import { env } from '@/env'

export const dynamic = 'force-dynamic'

interface ProviderStatus {
  configured: boolean
  status: 'ok' | 'error' | 'not_configured'
  credits?: number
  error?: string
}

async function checkDataForSEO(): Promise<ProviderStatus & { stagingCallRate?: ReturnType<typeof getStagingDataForSEOCallCount> }> {
  const login = env.DATAFORSEO_LOGIN
  const password = env.DATAFORSEO_PASSWORD
  if (!login || !password) return { configured: false, status: 'not_configured' }

  try {
    const credentials = Buffer.from(`${login}:${password}`).toString('base64')
    const res = await fetch('https://api.dataforseo.com/v3/appendix/user_data', {
      headers: { Authorization: `Basic ${credentials}` },
      signal: AbortSignal.timeout(5_000),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { configured: true, status: 'error', error: `HTTP ${res.status}: ${body.slice(0, 200)}` }
    }
    const data = await res.json() as { tasks?: Array<{ result?: Array<{ money_balance?: number }> }> }
    const balance = data.tasks?.[0]?.result?.[0]?.money_balance
    const stagingCallRate = process.env.APP_ENV === 'staging' ? getStagingDataForSEOCallCount() : undefined
    return { configured: true, status: 'ok', credits: balance, stagingCallRate }
  } catch (e) {
    return { configured: true, status: 'error', error: e instanceof Error ? e.message : 'unknown' }
  }
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
    if (credits !== undefined && credits < SEARCH_LOW_CREDITS_THRESHOLD) {
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
    if (credits !== undefined && credits < SEARCH_LOW_CREDITS_THRESHOLD) {
      notifySearchCreditsLow('SerpAPI', credits)
    }
    return { configured: true, status: 'ok', credits }
  } catch (e) {
    return { configured: true, status: 'error', error: e instanceof Error ? e.message : 'unknown' }
  }
}

async function checkScrapingBee(): Promise<ProviderStatus> {
  const apiKey = process.env.SCRAPINGBEE_API_KEY
  if (!apiKey) return { configured: false, status: 'not_configured' }

  try {
    const res = await fetch(`https://app.scrapingbee.com/api/v1/usage?api_key=${apiKey}`)
    if (!res.ok) {
      return { configured: true, status: 'error', error: `HTTP ${res.status}` }
    }
    const data = await res.json() as { max_api_credit?: number; used_api_credit?: number }
    const credits = data.max_api_credit !== undefined && data.used_api_credit !== undefined
      ? data.max_api_credit - data.used_api_credit
      : undefined
    if (credits !== undefined && credits < SEARCH_LOW_CREDITS_THRESHOLD) {
      notifySearchCreditsLow('ScrapingBee', credits)
    }
    return { configured: true, status: 'ok', credits }
  } catch (e) {
    return { configured: true, status: 'error', error: e instanceof Error ? e.message : 'unknown' }
  }
}

export async function GET() {
  const [dataforseo, serper, serpapi, scrapingbee, oracleHealth] = await Promise.all([
    checkDataForSEO(),
    checkSerper(),
    checkSerpApi(),
    checkScrapingBee(),
    getOracleSearchHealth(),
  ])

  const oracle = {
    configured: oracleHealth !== null || (!!env.ORACLE_URL && !!env.ORACLE_API_KEY),
    status: oracleHealth ? (oracleHealth.overall === 'healthy' ? 'ok' : 'degraded') : (env.ORACLE_URL ? 'error' : 'not_configured'),
    providers: oracleHealth?.providers,
    usableProviders: oracleHealth?.usable_count,
    lastSearchError: getLastOracleSearchError(),
  }

  const anyOk = dataforseo.status === 'ok' || serper.status === 'ok' || serpapi.status === 'ok' ||
    scrapingbee.status === 'ok' || oracle.status === 'ok' ||
    (!dataforseo.configured && !serper.configured && !serpapi.configured && !scrapingbee.configured)

  return NextResponse.json(
    {
      oracle,
      dataforseo,
      serper,
      serpapi,
      scrapingbee,
      ddg: { configured: true, status: 'ok', credits: 'unlimited' },
      overall: anyOk ? 'ok' : 'degraded',
    },
    { status: anyOk ? 200 : 503 },
  )
}
