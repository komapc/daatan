import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      username?: string | null
      role: 'USER' | 'RESOLVER' | 'APPROVER' | 'ADMIN'
      rs?: number
    }
  }

  interface User {
    id: string
    username?: string | null
    role: 'USER' | 'RESOLVER' | 'APPROVER' | 'ADMIN'
    rs?: number
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    sub: string
    role?: 'USER' | 'RESOLVER' | 'APPROVER' | 'ADMIN'
    username?: string | null
    rs?: number
    /** Date.now() ms when the DB data was last fetched */
    cachedAt?: number
    /** Set to true when the user was not found in DB */
    userDeleted?: boolean
  }
}

