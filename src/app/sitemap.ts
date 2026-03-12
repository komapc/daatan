import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'
import { env } from '@/env'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const isProd = env.NEXT_PUBLIC_ENV === 'production'
  const baseUrl = 'https://daatan.com'

  // If not production, return empty sitemap to avoid indexing staging
  if (!isProd) {
    return []
  }

  // 1. Static Routes
  const staticRoutes = [
    '',
    '/about',
    '/leaderboard',
    '/activity',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: route === '' ? 1 : 0.8,
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
      updatedAt: true,
    },
  })

  const forecastRoutes = predictions.map((p) => ({
    url: `${baseUrl}/forecasts/${p.slug || p.id}`,
    lastModified: p.updatedAt,
    changeFrequency: 'hourly' as const,
    priority: 0.7,
  }))

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

  return [...staticRoutes, ...forecastRoutes, ...profileRoutes]
}
