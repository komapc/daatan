import { NextRequest, NextResponse } from 'next/server'
import { apiError, handleRouteError } from '@/lib/api-error'
import { translatePrediction } from '@/lib/services/translation'
import { locales } from '@/i18n/config'

export const dynamic = 'force-dynamic'

// POST /api/forecasts/[id]/translate
// Body: { language: string }
// Returns translated fields for the prediction
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
