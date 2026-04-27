import type { NextAuthConfig } from "next-auth"
import Google from "next-auth/providers/google"
import { env } from "@/env"

// NOTE: This file is imported by `src/middleware.ts`, which runs in the Edge
// runtime. It MUST NOT import Prisma, bcrypt, or any other Node-only module.
// The Credentials provider (and the Playwright test provider) both need DB
// access and therefore live in `src/auth.ts`, which runs on Node.
export default {
  secret: env.NEXTAUTH_SECRET,
  trustHost: true,
  providers: [
    Google({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: false,
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub
        session.user.role = token.role ?? 'USER'
        session.user.username = token.username ?? undefined
        session.user.rs = token.rs
        if (token.name) session.user.name = token.name
        if (token.picture) session.user.image = token.picture as string
      }
      return session
    },
    async jwt({ token, user }) {
      if (user) {
        // user is NextAuth User — augmented to include role, username, rs
        token.role = user.role
        token.username = user.username
        token.rs = user.rs
      }
      return token
    },
  }
} satisfies NextAuthConfig
