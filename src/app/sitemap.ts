import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'
import { env } from '@/env'
import { locales } from '@/i18n/config'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const isProd = env.NEXT_PUBLIC_ENV === 'production'
  const baseUrl = 'https://daatan.com'

  // If not production, return empty sitemap to avoid indexing staging
  if (!isProd) {
    return []
  }

  const paths = [
    '',
    '/about',
    '/forecasts',
    '/leaderboard',
    '/activity',
  ]

  // 1. Static Routes (Localized)
  const staticRoutes: MetadataRoute.Sitemap = []
  for (const locale of locales) {
    const prefix = locale === 'en' ? '' : `/${locale}`
    for (const path of paths) {
      staticRoutes.push({
        url: `${baseUrl}${prefix}${path}`,
        lastModified: new Date(),
        changeFrequency: 'daily' as const,
        priority: path === '' ? 1 : 0.8,
      })
    }
  }

  // 2. Dynamic Forecasts (Localized)
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
  const forecastRoutes: MetadataRoute.Sitemap = []
  
  for (const locale of locales) {
    const prefix = locale === 'en' ? '' : `/${locale}`
    for (const p of predictions) {
      const isResolved = resolvedStatuses.includes(p.status)
      forecastRoutes.push({
        url: `${baseUrl}${prefix}/forecasts/${p.slug || p.id}`,
        lastModified: p.updatedAt,
        changeFrequency: (isResolved ? 'monthly' : 'hourly') as 'monthly' | 'hourly',
        priority: isResolved ? 0.5 : 0.7,
      })
    }
  }

  // 3. Dynamic Profiles (Localized)
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

  const profileRoutes: MetadataRoute.Sitemap = []
  for (const locale of locales) {
    const prefix = locale === 'en' ? '' : `/${locale}`
    for (const u of users) {
      profileRoutes.push({
        url: `${baseUrl}${prefix}/profile/${u.username}`,
        lastModified: u.updatedAt,
        changeFrequency: 'weekly' as const,
        priority: 0.5,
      })
    }
  }

  return [...staticRoutes, ...forecastRoutes, ...profileRoutes]
}
