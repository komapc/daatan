import type { MetadataRoute } from 'next'
import { env } from '@/env'

export const dynamic = 'force-dynamic'

export default function robots(): MetadataRoute.Robots {
  const isProd = env.NEXT_PUBLIC_ENV === 'production'
  const baseUrl = 'https://daatan.com'

  if (!isProd) {
    return {
      rules: {
        userAgent: '*',
        disallow: '/',
      },
    }
  }

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin/',
        '/api/',
        '/settings/',
        '/auth/',
        '/notifications/',
        '/commitments/',
        '/create/',
        '/forecasts/new/',
        '/forecasts/express/',
        '/retroanalysis/',
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
