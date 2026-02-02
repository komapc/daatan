const { version } = require('./package.json')

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
    NEXT_PUBLIC_APP_VERSION: version,
  },
  // Ensure next-auth is properly bundled
  transpilePackages: ['next-auth'],
}

module.exports = nextConfig

