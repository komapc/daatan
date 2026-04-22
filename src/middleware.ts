import NextAuth from "next-auth"
import authConfig from "./auth.config"
import { NextResponse } from "next/server"

const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const isAuth = !!req.auth
  const pathname = req.nextUrl.pathname

  // Admin routes require ADMIN role
  if (pathname.startsWith('/admin')) {
    if (!isAuth) {
      // Not logged in (or stale/invalid JWT) — send to signin.
      // No callbackUrl: avoids a bounce loop when the client session appears
      // valid but the Edge JWT can't be decoded (e.g. after a secret rotation).
      return NextResponse.redirect(new URL('/auth/signin', req.url))
    }
    if (req.auth?.user?.role !== 'ADMIN') {
      // Authenticated but not an admin — go home, not signin (avoids bounce loop)
      return NextResponse.redirect(new URL('/', req.url))
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    "/admin/:path*",
  ]
}
