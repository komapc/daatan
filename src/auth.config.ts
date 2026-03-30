import type { NextAuthConfig } from "next-auth"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { env } from "@/env"
import { prisma } from "@/lib/prisma"

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
    Credentials({
      id: "credentials",
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: { email: String(credentials.email) }
        })

        if (!user || !user.password) {
          return null
        }

        const isValid = await bcrypt.compare(String(credentials.password), user.password)

        if (!isValid) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role as any,
          username: user.username,
          rs: user.rs,
          cuAvailable: user.cuAvailable,
          cuLocked: user.cuLocked,
        }
      }
    }),
    // Playwright test provider: only available in test mode
    ...(isTest ? [
      Credentials({
        id: "playwright",
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
