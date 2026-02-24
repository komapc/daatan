import { NextResponse } from 'next/server'
import { suggestTags } from '@/lib/llm/gemini'
import { apiError } from '@/lib/api-error'
import { withAuth } from '@/lib/api-middleware'

export const dynamic = 'force-dynamic'

export const POST = withAuth(async (req) => {
    const { claim, details } = await req.json()

    if (!claim) {
        return apiError('Claim is required', 400)
    }

    try {
        const tags = await suggestTags(claim, details)
        return NextResponse.json({ tags })
    } catch (error) {
        return apiError('Failed to suggest tags', 500)
    }
})
