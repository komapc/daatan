import { env } from '@/env'
import { createLogger } from '@/lib/logger'

const log = createLogger('news-indexer')

type LedgerOutcome = 'YES' | 'NO' | 'ANNULLED'

function toLedgerOutcome(outcome: string): LedgerOutcome {
  if (outcome === 'correct') return 'YES'
  if (outcome === 'wrong') return 'NO'
  return 'ANNULLED'  // void | unresolvable
}

export function notifyNewsIndexerResolution(forecastId: string, outcome: string): void {
  if (!env.NEWS_INDEXER_URL || !env.NEWS_INDEXER_API_KEY) return

  const ledgerOutcome = toLedgerOutcome(outcome)
  void fetch(`${env.NEWS_INDEXER_URL}/resolve`, {
    method: 'POST',
    headers: {
      'x-api-key': env.NEWS_INDEXER_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ forecastId, outcome: ledgerOutcome }),
  }).catch((err: unknown) => {
    log.warn({ err }, 'news-indexer /resolve call failed')
  })
}
