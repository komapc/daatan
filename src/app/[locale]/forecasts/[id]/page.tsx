import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { translatePrediction } from '@/lib/services/translation'
import { defaultLocale, type Locale } from '@/i18n/config'
import ForecastDetailClient from './ForecastDetailClient'
import { Loader2 } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string; locale?: string }>
}

async function getPrediction(idOrSlug: string, locale?: string) {
  const prediction = await prisma.prediction.findFirst({
    where: {
      OR: [
        { id: idOrSlug },
        { slug: idOrSlug }
      ]
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
      options: {
        orderBy: { displayOrder: 'asc' },
      },
      commitments: {
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, name: true, username: true, image: true },
          },
          option: {
            select: { id: true, text: true },
          },
        },
      },
      _count: {
        select: { commitments: true },
      },
    },
  })

  if (!prediction) return null

  // If we have a non-default locale, merge translations
  let claimText = prediction.claimText
  let detailsText = prediction.detailsText

  if (locale && locale !== defaultLocale) {
    const translations = await translatePrediction(prediction.id, locale)
    if (translations.claimText) claimText = translations.claimText
    if (translations.detailsText) detailsText = translations.detailsText
  }

  // Format date to ISO string for JSON serialization
  return {
    ...prediction,
    claimText,
    detailsText,
    resolveByDatetime: prediction.resolveByDatetime.toISOString(),
    contextUpdatedAt: prediction.contextUpdatedAt?.toISOString(),
    publishedAt: prediction.publishedAt?.toISOString(),
    resolvedAt: prediction.resolvedAt?.toISOString(),
    lockedAt: prediction.lockedAt?.toISOString(),
    commitments: prediction.commitments.map(c => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
    })),
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id: idOrSlug, locale } = await params
  const prediction = await prisma.prediction.findFirst({
    where: {
      OR: [
        { id: idOrSlug },
        { slug: idOrSlug }
      ]
    },
    select: { id: true, claimText: true, detailsText: true, slug: true },
  })

  if (!prediction) {
    return {
      title: 'Forecast Not Found',
    }
  }

  const slug = prediction.slug || prediction.id
  let claimText = prediction.claimText
  let detailsText = prediction.detailsText

  if (locale && locale !== defaultLocale) {
    const translations = await translatePrediction(prediction.id, locale)
    if (translations.claimText) claimText = translations.claimText
    if (translations.detailsText) detailsText = translations.detailsText
  }

  return {
    title: claimText,
    description: detailsText || 'Make your prediction on DAATAN.',
    alternates: {
      canonical: `https://daatan.com/forecasts/${slug}`,
    },
    openGraph: {
      title: claimText,
      description: detailsText || 'Make your prediction on DAATAN.',
      type: 'article',
      url: `https://daatan.com/forecasts/${slug}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: claimText,
      description: detailsText || 'Make your prediction on DAATAN.',
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

export default async function ForecastDetailPage({ params }: Props) {
  const { id, locale } = await params
  const prediction = await getPrediction(id, locale)

  if (!prediction) {
    notFound()
  }

  // Structured Data (JSON-LD)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: prediction.claimText,
    description: prediction.detailsText,
    datePublished: prediction.publishedAt,
    dateModified: prediction.updatedAt,
    author: {
      '@type': 'Person',
      name: prediction.author.name || prediction.author.username,
      url: `https://daatan.com/profile/${prediction.author.username}`,
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Suspense fallback={<ForecastLoading />}>
        <ForecastDetailClient initialData={prediction as any} />
      </Suspense>
    </>
  )
}
