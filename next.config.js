const { version } = require('./package.json')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
}

module.exports = nextConfig

