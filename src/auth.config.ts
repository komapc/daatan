import type { NextAuthConfig } from "next-auth"
import Google from "next-auth/providers/google"
import { env } from "@/env"

// NOTE: This file is imported by `src/middleware.ts`, which runs in the Edge
// runtime. It MUST NOT import Prisma, bcrypt, or any other Node-only module.
// The Credentials provider (and the Playwright test provider) both need DB
// access and therefore live in `src/auth.ts`, which runs on Node.
const isHosted = env.NEXT_PUBLIC_ENV === 'staging' || env.NEXT_PUBLIC_ENV === 'production'

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
  },
  // Must live here (not only in auth.ts) so the Edge middleware reads the same
  // cookie names that the Node.js handler writes.
  ...(isHosted && {
    cookies: {
      sessionToken: {
        name: `__Secure-next-auth.session-token`,
        options: { httpOnly: true, sameSite: 'lax' as const, path: '/', secure: true },
      },
      callbackUrl: {
        name: `__Secure-next-auth.callback-url`,
        options: { sameSite: 'lax' as const, path: '/', secure: true },
      },
      csrfToken: {
        name: `__Secure-next-auth.csrf-token`,
        options: { httpOnly: true, sameSite: 'lax' as const, path: '/', secure: true },
      },
      pkceCodeVerifier: {
        name: `__Secure-next-auth.pkce.code_verifier`,
        options: { httpOnly: true, sameSite: 'lax' as const, path: '/', secure: true, maxAge: 900 },
      },
      state: {
        name: `__Secure-next-auth.state`,
        options: { httpOnly: true, sameSite: 'lax' as const, path: '/', secure: true, maxAge: 900 },
      },
      nonce: {
        name: `__Secure-next-auth.nonce`,
        options: { httpOnly: true, sameSite: 'lax' as const, path: '/', secure: true },
      },
    },
  }),
} satisfies NextAuthConfig
