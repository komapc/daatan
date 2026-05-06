import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { buildForecastDescription } from '@/lib/forecast-seo'
import ForecastDetailClient from './ForecastDetailClient'
import { Loader2 } from 'lucide-react'

export const revalidate = 60

interface Props {
  params: Promise<{ id: string }>
}

async function getPrediction(idOrSlug: string) {
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

  // Format date to ISO string for JSON serialization
  return {
    ...prediction,
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
  const { id: idOrSlug } = await params
  const prediction = await prisma.prediction.findFirst({
    where: {
      OR: [
        { id: idOrSlug },
        { slug: idOrSlug }
      ]
    },
    select: { id: true, claimText: true, detailsText: true, slug: true, isPublic: true, status: true },
  })

  if (!prediction) {
    return {
      title: 'Forecast Not Found',
    }
  }

  const slug = prediction.slug || prediction.id
  const noIndexStatuses = ['DRAFT', 'PENDING_APPROVAL', 'VOID', 'UNRESOLVABLE']
  const shouldNoIndex = !prediction.isPublic || noIndexStatuses.includes(prediction.status)
  const description = buildForecastDescription(prediction.claimText, prediction.detailsText)

  if (shouldNoIndex) {
    return {
      title: prediction.claimText,
      description,
      robots: { index: false, follow: false },
    }
  }

  const translatedLocales = await prisma.predictionTranslation.findMany({
    where: { predictionId: prediction.id, language: { in: ['he', 'ru'] } },
    select: { language: true },
    distinct: ['language'],
  })
  const translatedLangs = new Set(translatedLocales.map((t) => t.language))

  return {
    title: prediction.claimText,
    description,
    alternates: {
      canonical: `https://daatan.com/forecasts/${slug}`,
      languages: {
        'x-default': `https://daatan.com/forecasts/${slug}`,
        en: `https://daatan.com/forecasts/${slug}`,
        ...(translatedLangs.has('he') ? { he: `https://daatan.com/he/forecasts/${slug}` } : {}),
        ...(translatedLangs.has('ru') ? { ru: `https://daatan.com/ru/forecasts/${slug}` } : {}),
      },
    },
    openGraph: {
      title: prediction.claimText,
      description,
      type: 'article',
      url: `https://daatan.com/forecasts/${slug}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: prediction.claimText,
      description,
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
  const { id } = await params
  const prediction = await getPrediction(id)

  if (!prediction) {
    notFound()
  }

  const slug = prediction.slug || prediction.id
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: prediction.claimText,
    description: prediction.detailsText || undefined,
    url: `https://daatan.com/forecasts/${slug}`,
    image: `https://daatan.com/forecasts/${slug}/opengraph-image`,
    datePublished: prediction.publishedAt,
    dateModified: prediction.updatedAt,
    author: {
      '@type': 'Person',
      name: prediction.author.name || prediction.author.username,
      url: `https://daatan.com/profile/${prediction.author.username}`,
    },
    publisher: {
      '@type': 'Organization',
      name: 'DAATAN',
      url: 'https://daatan.com',
      logo: { '@type': 'ImageObject', url: 'https://daatan.com/logo-icon.png' },
    },
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://daatan.com' },
      { '@type': 'ListItem', position: 2, name: 'Forecasts', item: 'https://daatan.com/forecasts' },
      { '@type': 'ListItem', position: 3, name: prediction.claimText, item: `https://daatan.com/forecasts/${slug}` },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <Suspense fallback={<ForecastLoading />}>
        <ForecastDetailClient initialData={prediction as any} />
      </Suspense>
    </>
  )
}
