import NextAuth from "next-auth"
import authConfig from "./auth.config"
import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const { auth } = NextAuth(authConfig)
const intlMiddleware = createMiddleware(routing)

export default auth((req) => {
  const { pathname } = req.nextUrl
  
  // 1. Determine if this is an admin route (potentially with locale prefix)
  const pathParts = pathname.split('/').filter(Boolean)
  const isLocalePrefixed = routing.locales.includes(pathParts[0] as any)
  const actualPath = isLocalePrefixed ? `/${pathParts.slice(1).join('/')}` : pathname

  // 2. Auth Logic - ONLY if it's an admin route
  if (actualPath.startsWith('/admin')) {
    const isAuth = !!req.auth
    if (!isAuth || req.auth?.user?.role !== 'ADMIN') {
      const locale = isLocalePrefixed ? pathParts[0] : 'en'
      const signInUrl = new URL(locale === 'en' ? '/auth/signin' : `/${locale}/auth/signin`, req.url)
      return NextResponse.redirect(signInUrl)
    }
  }

  // 3. I18n Logic - Handle all other cases
  return intlMiddleware(req)
})

export const config = {
  // Skip internal paths and static files
  matcher: ['/((?!api|_next|_vercel|static|.*\\..*).*)']
}
