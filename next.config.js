const { version } = require('./package.json')
const createNextIntlPlugin = require('next-intl/plugin')

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

// Prefer build-arg / env so Docker/CI can bake the correct version (e.g. from tag v1.4.10 -> 1.4.10)
const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || version

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
  },
  // Ensure next-auth is properly bundled
  transpilePackages: ['next-auth'],
  // Allow external images from Google OAuth
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },
    ],
  },
}

module.exports = withNextIntl(nextConfig)
