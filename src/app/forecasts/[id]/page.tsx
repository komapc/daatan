import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import ForecastDetailClient from './ForecastDetailClient'
import { Loader2 } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

async function getPrediction(id: string) {
  const prediction = await prisma.prediction.findUnique({
    where: { id },
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
  const { id } = await params
  const prediction = await prisma.prediction.findUnique({
    where: { id },
    select: { id: true, claimText: true, detailsText: true, slug: true },
  })

  if (!prediction) {
    return {
      title: 'Forecast Not Found',
    }
  }

  const slug = prediction.slug || prediction.id

  return {
    title: prediction.claimText,
    description: prediction.detailsText || 'Make your prediction on DAATAN.',
    alternates: {
      canonical: `/forecasts/${slug}`,
    },
    openGraph: {
      title: prediction.claimText,
      description: prediction.detailsText || 'Make your prediction on DAATAN.',
      type: 'article',
      url: `/forecasts/${slug}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: prediction.claimText,
      description: prediction.detailsText || 'Make your prediction on DAATAN.',
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
      name: (prediction.author as any).name || (prediction.author as any).username,
      url: `https://daatan.com/profile/${(prediction.author as any).username}`,
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
