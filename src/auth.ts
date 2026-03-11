import NextAuth from "next-auth"
import type { NextAuthConfig, Session } from "next-auth"
import type { JWT } from "next-auth/jwt"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import { createLogger } from "@/lib/logger"
import { env } from "@/env"
import type { Adapter } from "next-auth/adapters"

const log = createLogger('auth')

const isTest = process.env.PLAYWRIGHT_TEST === 'true'
const isStaging = env.NEXT_PUBLIC_ENV === 'staging'
const isHosted = env.NEXT_PUBLIC_ENV === 'staging' || env.NEXT_PUBLIC_ENV === 'production'

export const authOptions: NextAuthConfig = {
  adapter: PrismaAdapter(prisma) as Adapter,
  secret: env.NEXTAUTH_SECRET,
  debug: isStaging || env.NEXTAUTH_DEBUG === 'true',
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
          if (!credentials?.userId) return null
          
          // Find or create the test user
          const user = await prisma.user.upsert({
            where: { id: credentials.userId as string },
            update: { role: (credentials.role as any) || 'USER' },
            create: {
              id: credentials.userId as string,
              email: `${credentials.userId}@test.daatan.com`,
              name: `Test User ${credentials.userId}`,
              username: `testuser_${credentials.userId}`,
              role: (credentials.role as any) || 'USER',
              cuAvailable: 1000,
            }
          })
          
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
            role: user.role,
          }
        }
      })
    ] : [])
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async signIn({ user, account }) {
      if (isStaging || env.NEXTAUTH_DEBUG === 'true') {
        log.info({ userId: user?.id, email: user?.email, provider: account?.provider }, 'signIn callback')
      }
      return true
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (session.user && token.sub) {
        session.user.id = token.sub

        if (token.userDeleted) {
          log.warn({ userId: token.sub }, 'Session user not found in DB — invalidating session')
          session.expires = new Date(0).toISOString() as any
          return session
        }

        // Read cached values from JWT
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
      const TTL = 5 * 60 * 1000 // 5 minutes
      const isSignIn = !!user
      const cachedAt = token.cachedAt as number | undefined
      const stale = !cachedAt || Date.now() - cachedAt > TTL

      if ((isSignIn || stale) && token.sub) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.sub },
            select: { role: true, username: true, name: true, image: true, avatarUrl: true, rs: true, cuAvailable: true, cuLocked: true },
          })

          if (!dbUser) {
            token.userDeleted = true
            return token
          }

          token.role = dbUser.role
          token.username = dbUser.username
          token.name = dbUser.name ?? token.name
          token.picture = dbUser.avatarUrl || dbUser.image || token.picture
          token.rs = dbUser.rs
          token.cuAvailable = dbUser.cuAvailable
          token.cuLocked = dbUser.cuLocked
          token.cachedAt = Date.now()
          token.userDeleted = undefined
        } catch (error) {
          log.error({ err: error }, 'Error fetching user for JWT cache')
        }
      }
      return token
    },
  },
  events: {
    createUser: async ({ user }) => {
      try {
        await prisma.cuTransaction.create({
          data: {
            userId: user.id!,
            type: 'INITIAL_GRANT',
            amount: 100,
            balanceAfter: 100,
            note: 'Welcome bonus',
          },
        })
      } catch (error) {
        log.error({ err: error }, 'Failed to create initial grant transaction')
      }
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  ...(isHosted && {
    cookies: {
      sessionToken: {
        name: `__Secure-next-auth.session-token`,
        options: {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          secure: true,
        },
      },
      callbackUrl: {
        name: `__Secure-next-auth.callback-url`,
        options: {
          sameSite: 'lax',
          path: '/',
          secure: true,
        },
      },
      csrfToken: {
        name: `__Secure-next-auth.csrf-token`,
        options: {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          secure: true,
        },
      },
      pkceCodeVerifier: {
        name: `__Secure-next-auth.pkce.code_verifier`,
        options: {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          secure: true,
          maxAge: 900,
        },
      },
      state: {
        name: `__Secure-next-auth.state`,
        options: {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          secure: true,
          maxAge: 900,
        },
      },
      nonce: {
        name: `__Secure-next-auth.nonce`,
        options: {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          secure: true,
        },
      },
    },
  }),
}

export const { handlers, auth, signIn, signOut } = NextAuth(authOptions)
