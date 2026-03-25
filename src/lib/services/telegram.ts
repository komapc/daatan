import { createLogger } from '@/lib/logger'

const log = createLogger('telegram')

const TELEGRAM_API = 'https://api.telegram.org/bot'

/**
 * Send a message to the configured Telegram channel.
 * Fire-and-forget: never throws, logs errors.
 */
async function sendChannelNotification(message: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID

  if (!token || !chatId) {
    log.warn({ hasToken: !!token, hasChatId: !!chatId }, 'Telegram not configured')
    return
  }

  const env = process.env.APP_ENV || process.env.NEXT_PUBLIC_APP_ENV || 'staging'
  const prefix = env === 'production' ? 'prod' : 'staging'
  const prefixed = `[${prefix}] ${message}`

  log.debug({ chatId, prefix }, 'Sending Telegram notification')

  try {
    const res = await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: prefixed,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      log.error({ status: res.status, body, chatId }, 'Telegram API error')
    } else {
      log.info({ chatId }, 'Telegram notification sent successfully')
    }
  } catch (err) {
    log.error({ err, chatId }, 'Failed to send Telegram notification')
  }
}

// ============================================
// Error notifications (rate-limited)
// ============================================

const errorCooldowns = new Map<string, number>()
const ERROR_COOLDOWN_MS = 5 * 60 * 1000 // 5 minutes — avoid flooding the channel

function canNotify(key: string): boolean {
  const last = errorCooldowns.get(key)
  if (last && Date.now() - last < ERROR_COOLDOWN_MS) return false
  errorCooldowns.set(key, Date.now())
  return true
}

function isDevEnv(): boolean {
  const env = process.env.APP_ENV || process.env.NEXT_PUBLIC_APP_ENV || 'staging'
  return env === 'development'
}

export function notifyServerError(route: string, error: Error): void {
  if (isDevEnv()) return
  const key = `server-error:${route}:${error.constructor.name}`
  if (!canNotify(key)) return

  const msg = [
    `🚨 <b>Server Error</b>`,
    `Route: <code>${route}</code>`,
    `Error: <code>${truncate(error.message, 200)}</code>`,
  ].join('\n')

  sendChannelNotification(msg)
}

export function notifyAllSearchProvidersFailed(query?: string): void {
  if (isDevEnv()) return
  if (!canNotify('search-all-providers-failed')) return

  const msg = [
    `⚠️ <b>All search providers failed</b>`,
    query ? `Query: <code>${truncate(query, 100)}</code>` : '',
    `Check Serper and SerpAPI credits — express forecast generation is degraded`,
  ].filter(Boolean).join('\n')

  sendChannelNotification(msg)
}

export function notifySearchCreditsLow(provider: string, remaining: number): void {
  if (isDevEnv()) return
  if (!canNotify(`search-credits-low:${provider}`)) return

  const msg = [
    `⚠️ <b>Search credits low: ${provider}</b>`,
    `Remaining: <b>${remaining}</b>`,
    `Top up to avoid express forecast generation degradation`,
  ].join('\n')

  sendChannelNotification(msg)
}

// ============================================
// Event-specific notification helpers
// ============================================

interface ForecastInfo {
  id: string
  claimText: string
}

interface UserInfo {
  name: string | null
  username: string | null
}

function userName(user: UserInfo): string {
  return user.name || user.username || 'Someone'
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.substring(0, max) + '...' : text
}

function forecastUrl(prediction: ForecastInfo): string {
  const base = process.env.NEXTAUTH_URL || 'https://daatan.com'
  return `${base}/forecasts/${prediction.id}`
}

export function notifyForecastPublished(prediction: ForecastInfo, author: UserInfo): void {
  const msg = [
    `📢 <b>New forecast published</b>`,
    `"${truncate(prediction.claimText, 120)}"`,
    `by ${userName(author)}`,
    `<a href="${forecastUrl(prediction)}">View forecast →</a>`,
  ].join('\n')

  sendChannelNotification(msg)
}

export function notifyNewCommitment(
  prediction: ForecastInfo,
  user: UserInfo,
  cuCommitted: number,
  choice: string,
): void {
  const msg = [
    `🎯 <b>New commitment</b>`,
    `${userName(user)} committed ${cuCommitted} CU (${choice}) on:`,
    `"${truncate(prediction.claimText, 120)}"`,
    `<a href="${forecastUrl(prediction)}">View forecast →</a>`,
  ].join('\n')

  sendChannelNotification(msg)
}

export function notifyNewComment(
  prediction: ForecastInfo,
  author: UserInfo,
  text: string,
): void {
  const msg = [
    `💬 <b>New comment</b>`,
    `${userName(author)} on "${truncate(prediction.claimText, 80)}":`,
    `"${truncate(text, 150)}"`,
    `<a href="${forecastUrl(prediction)}">View forecast →</a>`,
  ].join('\n')

  sendChannelNotification(msg)
}

export function notifyForecastResolved(
  prediction: ForecastInfo,
  outcome: string,
  commitmentCount: number,
): void {
  const outcomeLabel = outcome.toUpperCase()
  const msg = [
    `⚖️ <b>Forecast resolved: ${outcomeLabel}</b>`,
    `"${truncate(prediction.claimText, 120)}"`,
    `${commitmentCount} commitment${commitmentCount !== 1 ? 's' : ''} processed`,
    `<a href="${forecastUrl(prediction)}">View forecast →</a>`,
  ].join('\n')

  sendChannelNotification(msg)
}

export function notifyBotForecastApproved(
  prediction: ForecastInfo,
  botAuthor: UserInfo,
  approver: UserInfo,
): void {
  const msg = [
    `✅ <b>Bot forecast approved</b>`,
    `"${truncate(prediction.claimText, 120)}"`,
    `Bot: ${userName(botAuthor)} → approved by ${userName(approver)}`,
    `<a href="${forecastUrl(prediction)}">View forecast →</a>`,
  ].join('\n')

  sendChannelNotification(msg)
}

export function notifyBotForecastRejected(
  prediction: ForecastInfo,
  botAuthor: UserInfo,
  rejector: UserInfo,
): void {
  const msg = [
    `❌ <b>Bot forecast rejected</b>`,
    `"${truncate(prediction.claimText, 120)}"`,
    `Bot: ${userName(botAuthor)} → rejected by ${userName(rejector)}`,
    `<a href="${forecastUrl(prediction)}">View forecast →</a>`,
  ].join('\n')

  sendChannelNotification(msg)
}
