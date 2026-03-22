import { NextResponse } from 'next/server'
import { resolvePredictionSchema } from '@/lib/validations/prediction'
import { handleRouteError } from '@/lib/api-error'
import { withAuth } from '@/lib/api-middleware'
import { notifyForecastResolved } from '@/lib/services/telegram'
import { createNotification } from '@/lib/services/notification'
import { resolvePrediction } from '@/lib/services/prediction-resolution'

export const POST = withAuth(async (request, user, { params }) => {
  const body = await request.json()
  const { outcome, evidenceLinks, resolutionNote, correctOptionId } = resolvePredictionSchema.parse(body)

  const { result, prediction } = await resolvePrediction(params.id, {
    outcome,
    resolvedById: user.id,
    evidenceLinks,
    resolutionNote,
    correctOptionId,
  })

  notifyForecastResolved(prediction, outcome, prediction.commitments.length)

  const forecastLink = `/forecasts/${prediction.slug || prediction.id}`
  for (const commitment of prediction.commitments) {
    createNotification({
      userId: commitment.userId,
      type: 'COMMITMENT_RESOLVED',
      title: 'Your committed forecast was resolved',
      message: `"${prediction.claimText.substring(0, 80)}" was resolved as ${outcome}`,
      link: forecastLink,
      predictionId: prediction.id,
      actorId: user.id,
    })
  }

  return NextResponse.json(result)
}, { roles: ['ADMIN', 'RESOLVER'] })
