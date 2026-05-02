import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'
import { env } from '@/env'

export const revalidate = 3600

const BASE_URL = 'https://daatan.com'

// Locales actively submitted to Google (eo intentionally excluded — low-value traffic)
const SITEMAP_LOCALES = ['he', 'ru'] as const

/** Build hreflang alternates for a path that has he/ru locale versions. */
function localizedAlternates(path: string) {
  return {
    'x-default': `${BASE_URL}${path}`,
    en: `${BASE_URL}${path}`,
    he: `${BASE_URL}/he${path}`,
    ru: `${BASE_URL}/ru${path}`,
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const isProd = env.NEXT_PUBLIC_ENV === 'production'

  // If not production, return empty sitemap to avoid indexing staging
  if (!isProd) {
    return []
  }

  // 1. Static routes (English)
  // Routes tagged with localized:true have /he and /ru counterparts in the sitemap.
  const staticRouteDefs = [
    { route: '',          lastModified: new Date(),              frequency: 'daily'   as const, priority: 1.0, localized: true  },
    { route: '/forecasts',lastModified: new Date(),              frequency: 'daily'   as const, priority: 0.8, localized: true  },
    { route: '/about',    lastModified: new Date('2026-03-26'), frequency: 'monthly' as const, priority: 0.8, localized: false },
    { route: '/leaderboard', lastModified: new Date(),           frequency: 'daily'   as const, priority: 0.8, localized: false },
    { route: '/activity', lastModified: new Date(),              frequency: 'daily'   as const, priority: 0.8, localized: false },
    { route: '/privacy',  lastModified: new Date('2026-03-26'), frequency: 'monthly' as const, priority: 0.3, localized: true  },
    { route: '/terms',    lastModified: new Date('2026-03-26'), frequency: 'monthly' as const, priority: 0.3, localized: true  },
  ]

  const staticRoutes: MetadataRoute.Sitemap = staticRouteDefs.map(({ route, lastModified, frequency, priority, localized }) => ({
    url: `${BASE_URL}${route}`,
    lastModified,
    changeFrequency: frequency,
    priority,
    ...(localized ? { alternates: { languages: localizedAlternates(route) } } : {}),
  }))

  // 2. Locale static routes (he + ru only — eo excluded)
  const localeStaticRoutes: MetadataRoute.Sitemap = SITEMAP_LOCALES.flatMap((locale) => [
    {
      url: `${BASE_URL}/${locale}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.8,
      alternates: { languages: localizedAlternates('') },
    },
    {
      url: `${BASE_URL}/${locale}/forecasts`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.7,
      alternates: { languages: localizedAlternates('/forecasts') },
    },
    {
      url: `${BASE_URL}/${locale}/privacy`,
      lastModified: new Date('2026-03-26'),
      changeFrequency: 'monthly' as const,
      priority: 0.3,
      alternates: { languages: localizedAlternates('/privacy') },
    },
    {
      url: `${BASE_URL}/${locale}/terms`,
      lastModified: new Date('2026-03-26'),
      changeFrequency: 'monthly' as const,
      priority: 0.3,
      alternates: { languages: localizedAlternates('/terms') },
    },
  ])

  // 3. Dynamic forecast routes
  const predictions = await prisma.prediction.findMany({
    where: {
      isPublic: true,
      status: { in: ['ACTIVE', 'PENDING', 'RESOLVED_CORRECT', 'RESOLVED_WRONG'] },
    },
    select: { id: true, slug: true, status: true, updatedAt: true },
  })

  // Translations that exist in the DB (only he/ru — eo excluded from sitemap)
  const translatedPredictionIds = await prisma.predictionTranslation.findMany({
    where: { language: { in: ['he', 'ru'] } },
    select: { predictionId: true, language: true },
    distinct: ['predictionId', 'language'],
  })

  const translatedSet = new Set(
    translatedPredictionIds.map((t) => `${t.predictionId}:${t.language}`),
  )

  const resolvedStatuses = ['RESOLVED_CORRECT', 'RESOLVED_WRONG']

  const forecastRoutes: MetadataRoute.Sitemap = predictions.map((p) => {
    const slug = p.slug || p.id
    const isResolved = resolvedStatuses.includes(p.status)
    const hasHe = translatedSet.has(`${p.id}:he`)
    const hasRu = translatedSet.has(`${p.id}:ru`)
    return {
      url: `${BASE_URL}/forecasts/${slug}`,
      lastModified: p.updatedAt,
      changeFrequency: (isResolved ? 'monthly' : 'hourly') as 'monthly' | 'hourly',
      priority: isResolved ? 0.5 : 0.7,
      alternates: {
        languages: {
          'x-default': `${BASE_URL}/forecasts/${slug}`,
          en: `${BASE_URL}/forecasts/${slug}`,
          ...(hasHe ? { he: `${BASE_URL}/he/forecasts/${slug}` } : {}),
          ...(hasRu ? { ru: `${BASE_URL}/ru/forecasts/${slug}` } : {}),
        },
      },
    }
  })

  // 4. Locale forecast routes — only when a translation exists
  const localeForecastRoutes: MetadataRoute.Sitemap = predictions.flatMap((p) => {
    const slug = p.slug || p.id
    const isResolved = resolvedStatuses.includes(p.status)
    const hasHe = translatedSet.has(`${p.id}:he`)
    const hasRu = translatedSet.has(`${p.id}:ru`)
    return SITEMAP_LOCALES.flatMap((locale) => {
      if (!translatedSet.has(`${p.id}:${locale}`)) return []
      return [{
        url: `${BASE_URL}/${locale}/forecasts/${slug}`,
        lastModified: p.updatedAt,
        changeFrequency: (isResolved ? 'monthly' : 'hourly') as 'monthly' | 'hourly',
        priority: isResolved ? 0.4 : 0.6,
        alternates: {
          languages: {
            'x-default': `${BASE_URL}/forecasts/${slug}`,
            en: `${BASE_URL}/forecasts/${slug}`,
            ...(hasHe ? { he: `${BASE_URL}/he/forecasts/${slug}` } : {}),
            ...(hasRu ? { ru: `${BASE_URL}/ru/forecasts/${slug}` } : {}),
          },
        },
      }]
    })
  })

  // 5. Public profile routes (no locale variants)
  const users = await prisma.user.findMany({
    where: { isPublic: true, username: { not: null } },
    select: { username: true, updatedAt: true },
  })

  const profileRoutes: MetadataRoute.Sitemap = users.map((u) => ({
    url: `${BASE_URL}/profile/${u.username}`,
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
