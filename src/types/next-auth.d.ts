import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      username?: string | null
      isAdmin?: boolean
      brierScore?: number
    }
  }

  interface User {
    id: string
    username?: string | null
    isAdmin?: boolean
    brierScore?: number
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    sub: string
  }
}

