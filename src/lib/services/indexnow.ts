import { env } from '@/env'
import { createLogger } from '@/lib/logger'

const log = createLogger('indexnow')
const HOST = 'https://daatan.com'

export function notifyIndexNow(slug: string): void {
  const key = env.INDEXNOW_KEY
  if (!key) return
  const url = `${HOST}/forecasts/${slug}`
  fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: 'daatan.com', key, keyLocation: `${HOST}/${key}.txt`, urlList: [url] }),
  })
    .then((res) => {
      if (!res.ok) log.warn({ status: res.status, url }, 'IndexNow ping failed')
      else log.info({ url }, 'IndexNow ping sent')
    })
    .catch((err) => log.warn({ err, url }, 'IndexNow ping error'))
}
