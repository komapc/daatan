import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { NextResponse } from "next/server"
import type { UserRole } from "@prisma/client"

export async function checkAuth(allowedRoles?: UserRole[]) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user) {
    return { error: "Unauthorized", status: 401, user: null }
  }
  
  if (allowedRoles && !allowedRoles.includes(session.user.role)) {
    return { error: "Forbidden: Insufficient permissions", status: 403, user: session.user }
  }
  
  return { error: null, status: 200, user: session.user }
}

/**
 * Middleware wrapper for API route handlers to enforce role-based access control.
 * @param allowedRoles Array of roles allowed to access the route
 * @param handler The route handler function
 */
export function withRole(
  allowedRoles: UserRole[],
  handler: (req: Request, context: any) => Promise<NextResponse>
) {
  return async (req: Request, context: any) => {
    const { error, status } = await checkAuth(allowedRoles)
    
    if (error) {
      return NextResponse.json({ error }, { status })
    }
    
    return handler(req, context)
  }
}
