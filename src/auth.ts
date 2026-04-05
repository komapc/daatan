import NextAuth from "next-auth"
import type { Session } from "next-auth"
import type { JWT } from "next-auth/jwt"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import { createLogger } from "@/lib/logger"
import { env } from "@/env"
import authConfig from "./auth.config"
import type { Adapter } from "next-auth/adapters"
import Credentials from "next-auth/providers/credentials"
import { notifyNewUserRegistered } from "@/lib/services/telegram"

const log = createLogger('auth')

const isTest = process.env.PLAYWRIGHT_TEST === 'true'
const isStaging = env.NEXT_PUBLIC_ENV === 'staging'
const isHosted = env.NEXT_PUBLIC_ENV === 'staging' || env.NEXT_PUBLIC_ENV === 'production'

// Merge Edge-compatible config with Node.js-only features (Prisma)
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma) as Adapter,
  debug: isStaging || env.NEXTAUTH_DEBUG === 'true',
  providers: [
    ...authConfig.providers.filter(p => !['credentials', 'playwright'].includes(p.id)),
    // Re-add standard credentials provider (already has full logic in authConfig for this app)
    ...authConfig.providers.filter(p => p.id === 'credentials'),
    // Override Playwright Credentials provider with DB logic if in test mode
    ...(isTest ? [
      Credentials({
        id: 'playwright',
        name: 'Playwright Test',
        credentials: {
          userId: { label: "User ID", type: "text" },
          role: { label: "Role", type: "text" }
        },
        async authorize(credentials) {
          if (!credentials?.userId) return null

          const user = await prisma.user.upsert({
            where: { id: credentials.userId as string },
            update: { role: (credentials.role as any) || 'USER' },
            create: {
              id: credentials.userId as string,
              email: `${credentials.userId}@test.daatan.com`,
              name: `Test User ${credentials.userId}`,
              username: `testuser_${credentials.userId}`,
              role: (credentials.role as any) || 'USER',
            }
          })

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
            role: user.role as any,
            username: user.username,
            rs: user.rs,
          }
        }
      })
    ] : [])
  ],
  callbacks: {
    ...authConfig.callbacks,
    async session({ session, token }: { session: Session; token: JWT }) {
      // First call base session callback
      if (authConfig.callbacks?.session) {
        session = await (authConfig.callbacks.session as any)({ session, token })
      }

      if (session.user && token.sub) {
        if (token.userDeleted) {
          log.warn({ userId: token.sub }, 'Session user not found in DB — invalidating session')
          session.expires = new Date(0).toISOString() as any
          return session
        }
      }
      return session
    },
    async jwt({ token, user, trigger, session, account, profile }) {
      // First call base jwt callback
      if (authConfig.callbacks?.jwt) {
        token = await (authConfig.callbacks.jwt as any)({ token, user, trigger, session, account, profile })
      }

      const TTL = 5 * 60 * 1000 // 5 minutes
      const isSignIn = !!user
      const cachedAt = token.cachedAt as number | undefined
      const stale = !cachedAt || Date.now() - cachedAt > TTL

      if ((isSignIn || stale) && token.sub) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.sub },
            select: { role: true, username: true, name: true, image: true, avatarUrl: true, rs: true },
          })

          if (!dbUser) {
            token.userDeleted = true
            return token
          }

          token.role = dbUser.role as any
          token.username = dbUser.username
          token.name = dbUser.name ?? token.name
          token.picture = dbUser.avatarUrl || dbUser.image || token.picture
          token.rs = dbUser.rs
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

        // Notify Telegram about new user registration
        notifyNewUserRegistered({
          email: user.email!,
          name: user.name,
          provider: 'google', // createUser event is usually for OAuth providers
        })
      } catch (error) {
        log.error({ err: error }, 'Failed to create initial grant or notify registration')
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
})
