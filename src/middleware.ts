import NextAuth from "next-auth"
import authConfig from "./auth.config"
import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'
import { NextResponse } from "next/server"

const { auth } = NextAuth(authConfig)
const intlMiddleware = createMiddleware(routing)

export default auth((req) => {
  const isAuth = !!req.auth
  const pathname = req.nextUrl.pathname

  // Split path to check for locale and actual route
  const pathParts = pathname.split('/').filter(Boolean)
  const isLocalePrefixed = routing.locales.includes(pathParts[0] as any)
  const actualPath = isLocalePrefixed ? `/${pathParts.slice(1).join('/')}` : pathname

  // Admin routes require ADMIN role
  if (actualPath.startsWith('/admin')) {
    if (!isAuth || req.auth?.user?.role !== 'ADMIN') {
      const signInUrl = new URL('/auth/signin', req.url)
      // If we're on a locale-prefixed admin route, redirect to localized signin
      if (isLocalePrefixed) {
        signInUrl.pathname = `/${pathParts[0]}/auth/signin`
      }
      return NextResponse.redirect(signInUrl)
    }
  }

  // Handle i18n routing
  return intlMiddleware(req)
})

export const config = {
  // Matcher for all routes including those starting with locale prefix
  // but excluding those that shouldn't be processed by i18n middleware
  matcher: [
    // Enable a redirect to a matching locale at the root
    '/',

    // Set a cookie to remember the last locale for these paths
    '/(en|he|ru)/:path*',

    // Enable localized routing for everything except static files and APIs
    '/((?!api|_next|_vercel|.*\\..*).*)',
    
    // Explicitly include admin routes for auth check
    "/admin/:path*",
    "/(en|he|ru)/admin/:path*"
  ]
}
