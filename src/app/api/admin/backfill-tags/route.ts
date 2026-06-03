import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-middleware'
import { handleRouteError } from '@/lib/api-error'
import { backfillForecastTags } from '@/lib/services/tag-backfill'

/**
 * Assign LLM-suggested topic tags to forecasts that currently have none.
 *
 * ADMIN-only. Cursor-paginated: call repeatedly, passing back `nextCursor`,
 * until it returns null. Pass `dryRun: true` to preview proposed tags without
 * writing anything.
 *
 * Body: { dryRun?: boolean; limit?: number; cursor?: string }
 */
export const POST = withAuth(async (req) => {
  try {
    const body = await req.json().catch(() => ({}))
    const result = await backfillForecastTags({
      dryRun: body.dryRun === true,
      limit: typeof body.limit === 'number' ? body.limit : undefined,
      cursor: typeof body.cursor === 'string' ? body.cursor : undefined,
    })
    return NextResponse.json(result)
  } catch (err) {
    return handleRouteError(err, 'Failed to backfill forecast tags')
  }
}, { roles: ['ADMIN'] })
