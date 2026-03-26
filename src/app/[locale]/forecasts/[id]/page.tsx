import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { getCachedPredictionTranslation } from '@/lib/services/translation'
import ForecastDetailClient from '@/app/forecasts/[id]/ForecastDetailClient'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ locale: string; id: string }>
}

async function getPrediction(idOrSlug: string) {
  const prediction = await prisma.prediction.findFirst({
    where: {
      OR: [{ id: idOrSlug }, { slug: idOrSlug }],
    },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          username: true,
          image: true,
          rs: true,
          role: true,
        },
      },
      newsAnchor: true,
      options: { orderBy: { displayOrder: 'asc' } },
      commitments: {
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, username: true, image: true } },
          option: { select: { id: true, text: true } },
        },
      },
      _count: { select: { commitments: true } },
    },
  })

  if (!prediction) return null

  return {
    ...prediction,
    resolveByDatetime: prediction.resolveByDatetime.toISOString(),
    contextUpdatedAt: prediction.contextUpdatedAt?.toISOString(),
    publishedAt: prediction.publishedAt?.toISOString(),
    resolvedAt: prediction.resolvedAt?.toISOString(),
    lockedAt: prediction.lockedAt?.toISOString(),
    commitments: prediction.commitments.map((c) => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
    })),
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id: idOrSlug } = await params

  const prediction = await prisma.prediction.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    select: { id: true, claimText: true, detailsText: true, slug: true },
  })

  if (!prediction) return { title: 'Forecast Not Found' }

  const slug = prediction.slug || prediction.id
  const translations = await getCachedPredictionTranslation(prediction.id, locale)
  const title = translations.claimText || prediction.claimText
  const description =
    translations.detailsText || prediction.detailsText || 'Make your prediction on DAATAN.'

  return {
    title,
    description,
    alternates: {
      canonical: `https://daatan.com/forecasts/${slug}`,
      languages: {
        'x-default': `https://daatan.com/forecasts/${slug}`,
        en: `https://daatan.com/forecasts/${slug}`,
        he: `https://daatan.com/he/forecasts/${slug}`,
        ru: `https://daatan.com/ru/forecasts/${slug}`,
      },
    },
    openGraph: {
      title,
      description,
      type: 'article',
      url: `https://daatan.com/${locale}/forecasts/${slug}`,
      locale,
    },
  }
}

function ForecastLoading() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
    </div>
  )
}

export default async function LocaleForecastDetailPage({ params }: Props) {
  const { locale, id: idOrSlug } = await params
  const prediction = await getPrediction(idOrSlug)

  if (!prediction) {
    notFound()
  }

  // Apply cached translations — never triggers Gemini, read-only
  const translations = await getCachedPredictionTranslation(prediction.id, locale)
  const localizedPrediction = {
    ...prediction,
    claimText: translations.claimText || prediction.claimText,
    detailsText: translations.detailsText || prediction.detailsText,
    resolutionRules: translations.resolutionRules || prediction.resolutionRules,
  }

  return (
    <Suspense fallback={<ForecastLoading />}>
      <ForecastDetailClient initialData={localizedPrediction as any} />
    </Suspense>
  )
}
