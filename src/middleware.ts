import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  function middleware(req) {
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ req, token }) => {
        const pathname = req.nextUrl.pathname
        
        // Admin routes require ADMIN role
        if (pathname.startsWith('/admin')) {
          return token?.role === 'ADMIN'
        }

        // Default: require authentication for matched routes
        return !!token
      },
    },
  }
)

export const config = {
  matcher: [
    "/admin/:path*",
  ]
}
