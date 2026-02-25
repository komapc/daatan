import { NextRequest, NextResponse } from 'next/server'
import { apiError, handleRouteError } from '@/lib/api-error'
import { withAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'
import { getContextUpdatePrompt } from '@/lib/llm/prompts'
import { llmService } from '@/lib/llm'
import { searchArticles } from '@/lib/utils/webSearch'

export const dynamic = 'force-dynamic'

type RouteParams = {
    params: Record<string, string>
}

// GET — public endpoint returning context timeline
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const prediction = await prisma.prediction.findUnique({
            where: { id: params.id },
            select: {
                id: true,
                detailsText: true,
                contextUpdatedAt: true,
                contextSnapshots: {
                    orderBy: { createdAt: 'desc' },
                },
            },
        })

        if (!prediction) {
            return apiError('Prediction not found', 404)
        }

        return NextResponse.json({
            currentContext: prediction.detailsText,
            contextUpdatedAt: prediction.contextUpdatedAt,
            snapshots: prediction.contextSnapshots,
        })
    } catch (error) {
        return handleRouteError(error, 'Failed to fetch context timeline')
    }
}

export const POST = withAuth(async (request: NextRequest, user, { params }: RouteParams) => {
    try {
        const prediction = await prisma.prediction.findUnique({
            where: { id: params.id },
            include: { newsAnchor: true }
        })

        if (!prediction) {
            return apiError('Prediction not found', 404)
        }

        // Only Author or ADMIN can update context
        if (prediction.authorId !== user.id && user.role !== 'ADMIN') {
            return apiError('Forbidden. Only author or admin can update context.', 403)
        }

        if (prediction.status !== 'ACTIVE') {
            return apiError('Context can only be updated for active predictions', 400)
        }

        // Rate Limiting (Once per 24 hours per forecast)
        if (prediction.contextUpdatedAt) {
            const now = new Date()
            const timeDiffHours = (now.getTime() - new Date(prediction.contextUpdatedAt).getTime()) / (1000 * 60 * 60)
            if (timeDiffHours < 24) {
                return apiError('Context was updated recently. Please wait 24 hours between updates.', 429)
            }
        }

        // 1. Search for recent articles
        const searchQuery = prediction.newsAnchor?.title || prediction.claimText
        const searchResults = await searchArticles(searchQuery, 4)

        if (searchResults.length === 0) {
            return apiError('Failed to find recent context. No articles found.', 404)
        }

        // Build sources array
        const sources = searchResults.map((article: any) => ({
            title: article.title,
            url: article.url,
            source: article.source || null,
            publishedDate: article.publishedDate || null,
        }))

        const articlesText = searchResults
            .map((article: any, i: number) => {
                return `[Article ${i + 1}]\nTitle: ${article.title}\nSource: ${article.source || 'Unknown'}\nPublished: ${article.publishedDate || 'Unknown'}\nSnippet: ${article.snippet}\n`
            })
            .join('\n')

        // 2. Query LLM to summarize new context
        const currentYear = new Date().getFullYear()
        const prompt = getContextUpdatePrompt(
            prediction.claimText,
            articlesText,
            currentYear,
            prediction.detailsText
        )

        const result = await llmService.generateContent({
            prompt,
            temperature: 0.2,
        })

        const newContextSummary = result.text.trim()
        const now = new Date()

        // 3. Create snapshot + update prediction in a transaction
        const [snapshot] = await prisma.$transaction([
            prisma.contextSnapshot.create({
                data: {
                    predictionId: prediction.id,
                    summary: newContextSummary,
                    sources,
                },
            }),
            prisma.prediction.update({
                where: { id: prediction.id },
                data: {
                    detailsText: newContextSummary,
                    contextUpdatedAt: now,
                },
            }),
        ])

        // Fetch full timeline
        const snapshots = await prisma.contextSnapshot.findMany({
            where: { predictionId: prediction.id },
            orderBy: { createdAt: 'desc' },
        })

        return NextResponse.json({
            success: true,
            newContext: newContextSummary,
            contextUpdatedAt: now,
            snapshot,
            timeline: snapshots,
        })

    } catch (error) {
        return handleRouteError(error, 'Failed to update prediction context')
    }
})
