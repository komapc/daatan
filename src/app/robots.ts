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
        '/forecasts/*/edit/',
        '/retroanalysis/',
        // Internal architecture docs served as static HTML (also carry a
        // noindex meta tag) — not indexable content.
        '/docs/',
        // OG image generation routes — image/png responses, not indexable pages.
        // Social platforms (Twitter, LinkedIn, etc.) ignore robots.txt so sharing
        // previews are unaffected; this stops Google treating them as soft-404 pages.
        '/opengraph-image',
        '/*/opengraph-image',
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
