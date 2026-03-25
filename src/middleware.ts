import NextAuth from "next-auth"
import authConfig from "./auth.config"
import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const { auth } = NextAuth(authConfig)
const intlMiddleware = createMiddleware(routing)

export default auth((req) => {
  const isAuth = !!req.auth
  const { pathname } = req.nextUrl

  // Check if the current route is a locale-prefixed route
  const pathParts = pathname.split('/').filter(Boolean)
  const isLocalePrefixed = routing.locales.includes(pathParts[0] as any)
  const actualPath = isLocalePrefixed ? `/${pathParts.slice(1).join('/')}` : pathname

  // Protection for admin routes
  if (actualPath.startsWith('/admin')) {
    if (!isAuth || req.auth?.user?.role !== 'ADMIN') {
      const locale = isLocalePrefixed ? pathParts[0] : 'en'
      const signInUrl = new URL(locale === 'en' ? '/auth/signin' : `/${locale}/auth/signin`, req.url)
      return NextResponse.redirect(signInUrl)
    }
  }

  return intlMiddleware(req)
})

export const config = {
  // Match all pathnames except for
  // - /api (API routes)
  // - /_next (Next.js internals)
  // - /_vercel (Vercel internals)
  // - /static (static files)
  // - all files (e.g. favicon.ico, logo.png)
  matcher: ['/((?!api|_next|_vercel|static|.*\\..*).*)']
}
