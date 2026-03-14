import type { NextAuthConfig } from "next-auth"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"
import { env } from "@/env"

const isTest = process.env.PLAYWRIGHT_TEST === 'true'

export default {
  secret: env.NEXTAUTH_SECRET,
  trustHost: true,
  providers: [
    Google({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: false,
    }),
    // Playwright test provider: only available in test mode
    ...(isTest ? [
      Credentials({
        name: 'Playwright Test',
        credentials: {
          userId: { label: "User ID", type: "text" },
          role: { label: "Role", type: "text" }
        },
        async authorize(credentials) {
          // This will be overridden in the main auth.ts for DB access
          return null
        }
      })
    ] : [])
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub
        session.user.role = (token.role as any) ?? 'USER'
        session.user.username = token.username as string | undefined
        session.user.rs = token.rs as number | undefined
        session.user.cuAvailable = token.cuAvailable as number | undefined
        session.user.cuLocked = token.cuLocked as number | undefined
        if (token.name) session.user.name = token.name
        if (token.picture) session.user.image = token.picture as string
      }
      return session
    },
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role
        token.username = (user as any).username
        token.rs = (user as any).rs
        token.cuAvailable = (user as any).cuAvailable
        token.cuLocked = (user as any).cuLocked
      }
      return token
    },
  }
} satisfies NextAuthConfig
