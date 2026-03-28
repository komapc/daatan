import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'
import { env } from '@/env'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const isProd = env.NEXT_PUBLIC_ENV === 'production'
  const baseUrl = 'https://daatan.com'

  // If not production, return empty sitemap to avoid indexing staging
  if (!isProd) {
    return []
  }

  // 1. Static Routes
  const staticRoutes = [
    { route: '', lastModified: new Date(), frequency: 'daily' as const, priority: 1 },
    { route: '/about', lastModified: new Date('2026-03-26'), frequency: 'daily' as const, priority: 0.8 },
    { route: '/forecasts', lastModified: new Date(), frequency: 'daily' as const, priority: 0.8 },
    { route: '/leaderboard', lastModified: new Date(), frequency: 'daily' as const, priority: 0.8 },
    { route: '/activity', lastModified: new Date(), frequency: 'daily' as const, priority: 0.8 },
    { route: '/privacy', lastModified: new Date('2026-03-26'), frequency: 'monthly' as const, priority: 0.3 },
    { route: '/terms', lastModified: new Date('2026-03-26'), frequency: 'monthly' as const, priority: 0.3 },
  ].map(({ route, lastModified, frequency, priority }) => ({
    url: `${baseUrl}${route}`,
    lastModified,
    changeFrequency: frequency,
    priority,
  }))

  // 2. Dynamic Forecasts
  const predictions = await prisma.prediction.findMany({
    where: {
      isPublic: true,
      status: {
        in: ['ACTIVE', 'PENDING', 'RESOLVED_CORRECT', 'RESOLVED_WRONG'],
      },
    },
    select: {
      id: true,
      slug: true,
      status: true,
      updatedAt: true,
    },
  })

  const resolvedStatuses = ['RESOLVED_CORRECT', 'RESOLVED_WRONG']
  const forecastRoutes = predictions.map((p) => {
    const isResolved = resolvedStatuses.includes(p.status)
    return {
      url: `${baseUrl}/forecasts/${p.slug || p.id}`,
      lastModified: p.updatedAt,
      changeFrequency: (isResolved ? 'monthly' : 'hourly') as 'monthly' | 'hourly',
      priority: isResolved ? 0.5 : 0.7,
    }
  })

  // 2b. Locale forecast variants — only for predictions with cached translations
  const translatedPredictionIds = await prisma.predictionTranslation.findMany({
    where: { language: { in: ['he', 'ru', 'eo'] } },
    select: { predictionId: true, language: true },
    distinct: ['predictionId', 'language'],
  })

  const translatedSet = new Set(
    translatedPredictionIds.map((t) => `${t.predictionId}:${t.language}`),
  )

  const localeForecastRoutes = predictions.flatMap((p) => {
    const slug = p.slug || p.id
    const isResolved = resolvedStatuses.includes(p.status)
    return (['he', 'ru', 'eo'] as const).flatMap((locale) => {
      if (!translatedSet.has(`${p.id}:${locale}`)) return []
      return [
        {
          url: `${baseUrl}/${locale}/forecasts/${slug}`,
          lastModified: p.updatedAt,
          changeFrequency: (isResolved ? 'monthly' : 'hourly') as 'monthly' | 'hourly',
          priority: isResolved ? 0.4 : 0.6,
        },
      ]
    })
  })

  // 2c. Static locale routes
  const localeStaticRoutes = (['he', 'ru', 'eo'] as const).flatMap((locale) => [
    {
      url: `${baseUrl}/${locale}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/${locale}/forecasts`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.7,
    },
    {
      url: `${baseUrl}/${locale}/privacy`,
      lastModified: new Date('2026-03-26'),
      changeFrequency: 'monthly' as const,
      priority: 0.3,
    },
    {
      url: `${baseUrl}/${locale}/terms`,
      lastModified: new Date('2026-03-26'),
      changeFrequency: 'monthly' as const,
      priority: 0.3,
    },
  ])

  // 3. Dynamic Profiles
  const users = await prisma.user.findMany({
    where: {
      isPublic: true,
      username: { not: null },
    },
    select: {
      username: true,
      updatedAt: true,
    },
  })

  const profileRoutes = users.map((u) => ({
    url: `${baseUrl}/profile/${u.username}`,
    lastModified: u.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.5,
  }))

  return [
    ...staticRoutes,
    ...localeStaticRoutes,
    ...forecastRoutes,
    ...localeForecastRoutes,
    ...profileRoutes,
  ]
}
