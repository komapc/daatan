import { NextRequest, NextResponse } from 'next/server'
import { apiError, handleRouteError } from '@/lib/api-error'
import { translatePrediction } from '@/lib/services/translation'
import { locales } from '@/i18n/config'
import { checkRateLimit, rateLimitResponse, clientIp } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const TRANSLATE_LIMIT = 20
const TRANSLATE_WINDOW = 60 * 60_000 // 1 hour

// POST /api/forecasts/[id]/translate
// Body: { language: string }
// Returns translated fields for the prediction
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rl = checkRateLimit(`translate:${clientIp(request)}`, TRANSLATE_LIMIT, TRANSLATE_WINDOW)
  if (!rl.allowed) return rateLimitResponse(rl.resetAt)

  try {
    const { id } = await params
    const body = await request.json()
    const { language } = body

    if (!language || !locales.includes(language as (typeof locales)[number])) {
      return apiError('Invalid or unsupported language', 400)
    }

    const translations = await translatePrediction(id, language)
    return NextResponse.json(translations)
  } catch (err) {
    return handleRouteError(err, 'translate prediction')
  }
}
