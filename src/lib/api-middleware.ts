import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { apiError, handleRouteError } from '@/lib/api-error'
import type { UserRole } from '@prisma/client'
import { createLogger } from '@/lib/logger'

const log = createLogger('api-middleware')

/** Authenticated session user (from NextAuth JWT callback). */
interface AuthUser {
  id: string
  email: string
  name?: string | null
  image?: string | null
  role: UserRole
  rs: number
  cuAvailable: number
  cuLocked: number
}

/** Route handler context with typed params. */
interface RouteContext {
  params: Record<string, string>
}

/** Options for the withAuth wrapper. */
interface WithAuthOptions {
  /** Allowed roles. If empty/undefined, any authenticated user is allowed. */
  roles?: UserRole[]
}

/**
 * Wrap a route handler with authentication and optional role checks.
 * Eliminates the getServerSession + null check + role check boilerplate.
 *
 * Usage:
 *   export const POST = withAuth(async (req, user, ctx) => {
 *     // user is guaranteed to exist and have the right role
 *     return NextResponse.json({ ok: true })
 *   }, { roles: ['ADMIN', 'RESOLVER'] })
 */
export function withAuth(
  handler: (
    request: NextRequest,
    user: AuthUser,
    context: RouteContext,
  ) => Promise<NextResponse | Response>,
  options?: WithAuthOptions,
) {
  return async (request: NextRequest, context: RouteContext) => {
    let session: any = null
    try {
      session = await getServerSession(authOptions)

      if (!session?.user?.id) {
        return apiError('Unauthorized', 401)
      }

      const user = session.user as AuthUser

      if (options?.roles && options.roles.length > 0) {
        if (!options.roles.includes(user.role)) {
          return apiError('Forbidden: Insufficient permissions', 403)
        }
      }

      return await handler(request, user, context)
    } catch (error) {
      log.error({
        err: error,
        url: request.nextUrl.pathname,
        userId: session?.user?.id,
      }, 'API route error caught in withAuth middleware')
      return handleRouteError(error)
    }
  }
}
