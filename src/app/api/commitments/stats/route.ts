import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/commitments/stats - Get commitment stats for the current user
export const GET = withAuth(async (_request, user) => {
  const commitments = await prisma.commitment.findMany({
    where: { userId: user.id },
    include: {
      prediction: {
        select: { status: true },
      },
    },
  })

  const total = commitments.length
  const totalCuCommitted = commitments.reduce((sum, c) => sum + c.cuCommitted, 0)
  const totalCuReturned = commitments.reduce((sum, c) => sum + (c.cuReturned ?? 0), 0)
  const totalRsChange = commitments.reduce((sum, c) => sum + (c.rsChange ?? 0), 0)

  // Count by outcome
  const resolved = commitments.filter(c =>
    c.prediction.status === 'RESOLVED_CORRECT' || c.prediction.status === 'RESOLVED_WRONG'
  )
  const correct = resolved.filter(c => (c.cuReturned ?? 0) > c.cuCommitted)
  const wrong = resolved.filter(c => (c.cuReturned ?? 0) === 0)
  const pending = commitments.filter(c =>
    c.prediction.status === 'ACTIVE' || c.prediction.status === 'PENDING'
  )

  const accuracy = resolved.length > 0
    ? Math.round((correct.length / resolved.length) * 100)
    : null

  const netCu = totalCuReturned - totalCuCommitted

  return NextResponse.json({
    total,
    resolved: resolved.length,
    correct: correct.length,
    wrong: wrong.length,
    pending: pending.length,
    accuracy,
    totalCuCommitted,
    totalCuReturned,
    netCu,
    totalRsChange: Math.round(totalRsChange * 100) / 100,
  })
})
