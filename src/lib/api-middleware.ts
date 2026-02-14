import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { apiError, handleRouteError } from '@/lib/api-error'
import type { UserRole } from '@prisma/client'

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
  ) => Promise<NextResponse>,
  options?: WithAuthOptions,
) {
  return async (request: NextRequest, context: RouteContext) => {
    try {
      const session = await getServerSession(authOptions)

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
      return handleRouteError(error)
    }
  }
}

/**
 * @deprecated Use `withAuth()` wrapper instead for new routes.
 * Legacy helper that returns auth status without wrapping the handler.
 */
export async function checkAuth(allowedRoles?: UserRole[]) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user) {
    return { error: 'Unauthorized', status: 401, user: null }
  }
  
  if (allowedRoles && !allowedRoles.includes(session.user.role)) {
    return { error: 'Forbidden: Insufficient permissions', status: 403, user: session.user }
  }
  
  return { error: null, status: 200, user: session.user }
}

/**
 * @deprecated Use `withAuth({ roles })` wrapper instead for new routes.
 * Legacy role-based wrapper used by admin routes.
 */
export function withRole(
  allowedRoles: UserRole[],
  handler: (req: Request, context: RouteContext) => Promise<NextResponse>
) {
  return async (req: Request, context: RouteContext) => {
    const { error, status } = await checkAuth(allowedRoles)
    
    if (error) {
      return NextResponse.json({ error }, { status })
    }
    
    return handler(req, context)
  }
}
