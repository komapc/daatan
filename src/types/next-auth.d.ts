import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      username?: string | null
      role: 'USER' | 'RESOLVER' | 'ADMIN'
      rs?: number
      cuAvailable?: number
      cuLocked?: number
    }
  }

  interface User {
    id: string
    username?: string | null
    role: 'USER' | 'RESOLVER' | 'ADMIN'
    rs?: number
    cuAvailable?: number
    cuLocked?: number
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    sub: string
    role?: 'USER' | 'RESOLVER' | 'ADMIN'
  }
}

