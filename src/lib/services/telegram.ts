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
