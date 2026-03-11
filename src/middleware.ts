import { auth } from "@/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  const isAuth = !!req.auth
  const pathname = req.nextUrl.pathname

  // Admin routes require ADMIN role
  if (pathname.startsWith('/admin')) {
    if (!isAuth || req.auth?.user?.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/auth/signin', req.url))
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    "/admin/:path*",
  ]
}
